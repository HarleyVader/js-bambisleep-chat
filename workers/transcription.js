// workers/transcription.js
// Transcription (Speech-to-Text) Worker - sends recorded audio to the external
// transcription service (OpenAI-compatible /v1/audio/transcriptions endpoint)
const { parentPort } = require("worker_threads");
const http = require("http");
const https = require("https");
const ENV = require("../config/env");

// HTTP Keep-Alive agents for connection reuse
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 15000,
});
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 15000,
});

class TranscriptionWorker {
  constructor() {
    this.isHealthy = false;
    this.fallbackMode = false;

    try {
      this.initializeConfig();
    } catch (error) {
      console.warn("⚠️ Transcription configuration incomplete:", error.message);
      this.fallbackMode = true;
      this.isHealthy = false;
    }

    this.init();
  }

  initializeConfig() {
    if (!ENV.TRANSCRIPTION.isConfigured) {
      throw new Error(
        `Missing transcription host config for ${ENV.NODE_ENV} environment`
      );
    }

    this.transcriptionUrl = ENV.TRANSCRIPTION.URL;
    this.apiUrl = ENV.TRANSCRIPTION.API_URL;
    this.timeout = ENV.TRANSCRIPTION.TIMEOUT;
    this.isHealthy = true;

    console.log("✅ Transcription service configured:", this.transcriptionUrl);
  }

  async init() {
    console.log("🎙️ Transcription Worker initializing...");
    if (this.fallbackMode) {
      console.log("🎙️ Transcription running in fallback mode (not configured)");
    } else {
      console.log(`🎙️ Transcription service URL: ${this.transcriptionUrl}`);
    }

    if (parentPort) {
      parentPort.on("message", this.handleMessage.bind(this));
    }
  }

  async handleMessage(msg) {
    try {
      if (this.fallbackMode && msg.type === "transcribe") {
        this.sendError("Transcription service not configured", msg.socketId);
        return;
      }

      switch (msg.type) {
        case "transcribe":
          await this.transcribeAudio(msg);
          break;

        case "health":
          this.sendResponse(
            "health_response",
            {
              healthy: this.isHealthy,
              fallbackMode: this.fallbackMode,
              url: this.transcriptionUrl || "not-configured",
              lastCheck: new Date().toISOString(),
            },
            msg.socketId
          );
          break;

        default:
          console.warn(`Unknown message type: ${msg.type}`);
      }
    } catch (error) {
      console.error("Transcription worker error:", error);
      this.sendError(error.message, msg.socketId);
    }
  }

  async transcribeAudio(msg) {
    const { audioData, mimeType, fileName, language, socketId } = msg;

    if (!audioData || typeof audioData !== "string") {
      this.sendError("Invalid audio data for transcription", socketId);
      return;
    }

    console.log(`🎙️ Transcribing audio sample for ${socketId}...`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const isHttps = this.transcriptionUrl.startsWith("https");
      const agent = isHttps ? httpsAgent : httpAgent;

      const audioBuffer = Buffer.from(audioData, "base64");
      const audioBlob = new Blob([audioBuffer], {
        type: mimeType || "audio/webm",
      });

      const form = new FormData();
      form.append("file", audioBlob, fileName || "recording.webm");
      if (language && typeof language === "string") {
        form.append("language", language);
      }

      const response = await fetch(this.apiUrl, {
        method: "POST",
        body: form,
        signal: controller.signal,
        agent,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Transcription API error (${response.status}): ${errorText}`
        );
      }

      const result = await response.json();
      const text = (result.text || "").trim();

      console.log(`✅ Transcription complete: "${text.substring(0, 60)}..."`);

      this.sendResponse(
        "transcription_success",
        {
          text,
          timestamp: new Date().toISOString(),
        },
        socketId
      );
    } catch (error) {
      console.error("Transcription failed:", error);
      this.sendError(`Transcription failed: ${error.message}`, socketId);
    }
  }

  sendResponse(type, data, socketId = null) {
    if (parentPort) {
      parentPort.postMessage({
        type,
        socketId,
        ...data,
      });
    }
  }

  sendError(error, socketId = null) {
    if (parentPort) {
      parentPort.postMessage({
        type: "transcription_error",
        error,
        socketId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

// Initialize worker
const worker = new TranscriptionWorker();

// Handle worker shutdown
process.on("SIGTERM", () => {
  console.log("🎙️ Transcription Worker shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🎙️ Transcription Worker shutting down...");
  process.exit(0);
});
