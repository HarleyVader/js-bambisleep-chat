// workers/openvoice.js
// OpenVoice V1 TTS Worker - every request is voice-cloned from the default
// reference sample (public/bambi-reference.wav) via POST /v1/audio/clone.
const { parentPort } = require("worker_threads");
const fs = require("fs");
const path = require("path");
const ENV = require("../config/env");

class OpenVoiceTTSWorker {
  constructor() {
    this.isHealthy = false;
    this.fallbackMode = false;
    this.outputFormat = "wav";
    this.defaultVoice = ENV.OPENVOICE.DEFAULT_VOICE;
    this.referenceAudio = null;
    this.referenceName = path.basename(ENV.OPENVOICE.REFERENCE_PATH);

    // LRU-style cache for repeated phrases (default voice only)
    this.audioCache = new Map();
    this.maxCacheSize = 50;
    this.cacheHits = 0;
    this.cacheMisses = 0;

    // OpenVoice synthesis is heavy - process requests one at a time
    this.queue = Promise.resolve();

    try {
      this.initializeConfig();
    } catch (error) {
      console.warn("⚠️ OpenVoice TTS configuration incomplete:", error.message);
      console.warn(
        "🔄 Running in fallback mode - TTS will use Web Speech API only"
      );
      this.fallbackMode = true;
      this.isHealthy = false;
    }

    this.init();
  }

  initializeConfig() {
    if (!ENV.OPENVOICE.isConfigured) {
      throw new Error(
        `Missing OpenVoice host config for ${ENV.NODE_ENV} environment`
      );
    }

    // Loaded once: the default voice is cloned from this sample on every request
    this.referenceAudio = fs.readFileSync(ENV.OPENVOICE.REFERENCE_PATH);
    this.openVoiceUrl = ENV.OPENVOICE.URL;
    this.cloneUrl = ENV.OPENVOICE.CLONE_URL;
    this.isHealthy = true;

    console.log("✅ OpenVoice TTS configured:", this.openVoiceUrl);
    console.log(
      `🎤 Default voice "${this.defaultVoice}" cloned from ${this.referenceName} (${this.referenceAudio.length} bytes)`
    );
  }

  async init() {
    console.log("🎤 OpenVoice TTS Worker initializing...");
    if (this.fallbackMode) {
      console.log("🎤 OpenVoice TTS running in fallback mode");
    }

    if (parentPort) {
      parentPort.on("message", this.handleMessage.bind(this));
    }
  }

  async handleMessage(msg) {
    try {
      if (this.fallbackMode && (msg.type === "tts" || msg.type === "voice_clone")) {
        if (msg.type === "voice_clone") {
          this.sendCloneError(
            "Voice cloning not available - OpenVoice TTS is not configured",
            msg.socketId
          );
        } else {
          this.sendError(
            "OpenVoice TTS not available - using Web Speech API fallback",
            msg.socketId
          );
        }
        return;
      }

      switch (msg.type) {
        case "tts":
          await this.enqueue(() => this.generateSpeech(msg));
          break;

        case "tts_batch":
          await this.enqueue(() => this.generateSpeechBatch(msg));
          break;

        case "voice_clone":
          await this.enqueue(() => this.cloneVoice(msg));
          break;

        case "cache_stats":
          this.sendResponse(
            "cache_stats",
            {
              size: this.audioCache.size,
              hits: this.cacheHits,
              misses: this.cacheMisses,
              hitRate:
                this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
            },
            msg.socketId
          );
          break;

        case "clear_cache":
          this.audioCache.clear();
          this.cacheHits = 0;
          this.cacheMisses = 0;
          console.log("🧹 TTS cache cleared");
          break;

        case "health":
          this.sendResponse(
            "health_response",
            {
              healthy: this.isHealthy,
              fallbackMode: this.fallbackMode,
              url: this.openVoiceUrl || "not-configured",
              lastCheck: new Date().toISOString(),
            },
            msg.socketId
          );
          break;

        default:
          console.warn(`Unknown message type: ${msg.type}`);
      }
    } catch (error) {
      console.error("OpenVoice worker error:", error);
      this.sendError(error.message, msg.socketId);
    }
  }

  // Serialize synthesis jobs; a failed job must not break the chain
  enqueue(task) {
    const run = this.queue.then(task);
    this.queue = run.catch(() => {});
    return run;
  }

  getCacheKey(text, speed) {
    return `${speed}:${text.substring(0, 200)}`;
  }

  addToCache(key, audioBase64, format) {
    if (this.audioCache.size >= this.maxCacheSize) {
      const firstKey = this.audioCache.keys().next().value;
      this.audioCache.delete(firstKey);
    }
    this.audioCache.set(key, {
      data: audioBase64,
      format,
      timestamp: Date.now(),
    });
  }

  // Map a response Content-Type header to a short format label for the client
  formatFromContentType(contentType) {
    if (!contentType) return this.outputFormat;
    if (contentType.includes("wav")) return "wav";
    if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
    if (contentType.includes("ogg")) return "ogg";
    return this.outputFormat;
  }

  // Identify the real audio format from magic bytes (servers sometimes mislabel it)
  sniffFormat(buffer) {
    if (buffer.length >= 12 && buffer.toString("latin1", 0, 4) === "RIFF" && buffer.toString("latin1", 8, 12) === "WAVE") return "wav";
    if (buffer.length >= 4 && buffer.toString("latin1", 0, 4) === "OggS") return "ogg";
    if (buffer.length >= 4 && buffer.toString("latin1", 0, 4) === "fLaC") return "flac";
    if (buffer.length >= 3 && buffer.toString("latin1", 0, 3) === "ID3") return "mp3";
    if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return "mp3";
    return null;
  }

  // Clone `reference` and speak `text` with it. Defaults to the bambi reference sample.
  async synthesize(text, { speed = 1.0, reference, mimeType, fileName } = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ENV.OPENVOICE.TIMEOUT);

    try {
      const form = new FormData();
      form.append("text", text);
      form.append(
        "reference",
        new Blob([reference || this.referenceAudio], {
          type: mimeType || "audio/wav",
        }),
        fileName || this.referenceName
      );
      form.append("speed", String(speed));

      const headers = {};
      if (ENV.OPENVOICE.API_KEY) {
        headers.Authorization = `Bearer ${ENV.OPENVOICE.API_KEY}`;
      }

      const response = await fetch(this.cloneUrl, {
        method: "POST",
        headers,
        body: form,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenVoice API error (${response.status}): ${errorText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const buffer = Buffer.from(await response.arrayBuffer());

      // A 200 that isn't audio (e.g. a JSON error body) would otherwise surface as a playback error
      if (/json|text|html/i.test(contentType) || buffer.length === 0) {
        throw new Error(
          `OpenVoice returned non-audio response (${contentType || "no content-type"}, ${buffer.length} bytes): ${buffer.toString("utf8", 0, 200)}`
        );
      }

      const format =
        this.sniffFormat(buffer) || this.formatFromContentType(contentType);
      return { buffer, base64: buffer.toString("base64"), format };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateSpeech(msg) {
    const { text, socketId, speed = 1.0 } = msg;

    if (!text || typeof text !== "string") {
      throw new Error("Invalid text input for TTS");
    }

    const cacheKey = this.getCacheKey(text, speed);
    const cached = this.audioCache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      console.log(
        `⚡ Cache hit for: "${text.substring(0, 30)}..." (${this.cacheHits} hits)`
      );
      this.sendResponse(
        "tts_success",
        {
          audioData: cached.data,
          format: cached.format,
          voice: this.defaultVoice,
          text,
          size: cached.data.length * 0.75, // Approximate size from base64
          cached: true,
          timestamp: new Date().toISOString(),
        },
        socketId
      );
      return;
    }
    this.cacheMisses++;

    console.log(`🎤 Generating speech: "${text.substring(0, 50)}..."`);

    try {
      const { buffer, base64, format } = await this.synthesize(text, { speed });
      this.addToCache(cacheKey, base64, format);

      console.log(`✅ Speech generated successfully (${buffer.length} bytes)`);

      this.sendResponse(
        "tts_success",
        {
          audioData: base64,
          format,
          voice: this.defaultVoice,
          text,
          size: buffer.length,
          cached: false,
          timestamp: new Date().toISOString(),
        },
        socketId
      );
    } catch (error) {
      console.error("OpenVoice TTS generation failed:", error);
      this.sendError(`TTS generation failed: ${error.message}`, socketId);
    }
  }

  async generateSpeechBatch(msg) {
    const { texts, socketId } = msg;

    if (!Array.isArray(texts) || texts.length === 0) {
      this.sendError("Invalid texts array for batch TTS", socketId);
      return;
    }

    console.log(`🎤 Batch generating ${texts.length} speeches`);
    const startTime = Date.now();
    const results = [];

    for (let index = 0; index < texts.length; index++) {
      const text = texts[index];
      try {
        const { buffer, base64, format } = await this.synthesize(text);
        results.push({
          index,
          success: true,
          audioData: base64,
          format,
          voice: this.defaultVoice,
          text,
          size: buffer.length,
        });
      } catch (error) {
        results.push({ index, success: false, error: error.message });
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `✅ Batch complete: ${results.filter((r) => r.success).length}/${texts.length} in ${elapsed}ms`
    );

    this.sendResponse(
      "tts_batch_success",
      {
        results,
        totalTime: elapsed,
        timestamp: new Date().toISOString(),
      },
      socketId
    );
  }

  // One-shot clone of a user-supplied reference sample (3-30s) speaking `text`
  async cloneVoice(msg) {
    const { audioData, mimeType, fileName, text, speed = 1.0, socketId } = msg;

    if (!audioData || typeof audioData !== "string") {
      this.sendCloneError("Invalid reference audio sample for voice cloning", socketId);
      return;
    }

    const trimmedText = typeof text === "string" ? text.trim() : "";
    if (!trimmedText) {
      this.sendCloneError("Text to speak is required for voice cloning", socketId);
      return;
    }

    console.log(`🧬 Cloning voice for text: "${trimmedText.substring(0, 50)}..."`);

    try {
      const { buffer, base64, format } = await this.synthesize(trimmedText, {
        speed,
        reference: Buffer.from(audioData, "base64"),
        mimeType,
        fileName: fileName || "reference.wav",
      });

      console.log(`✅ Voice clone audio generated (${buffer.length} bytes)`);

      this.sendResponse(
        "voice_clone_success",
        {
          audioData: base64,
          format,
          text: trimmedText,
          timestamp: new Date().toISOString(),
        },
        socketId
      );
    } catch (error) {
      console.error("OpenVoice voice cloning failed:", error);
      this.sendCloneError(`Voice cloning failed: ${error.message}`, socketId);
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

  sendCloneError(error, socketId = null) {
    if (parentPort) {
      parentPort.postMessage({
        type: "voice_clone_error",
        error,
        socketId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  sendError(error, socketId = null) {
    if (parentPort) {
      parentPort.postMessage({
        type: "error",
        error,
        socketId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

// Initialize worker
const worker = new OpenVoiceTTSWorker();

// Handle worker shutdown
process.on("SIGTERM", () => {
  console.log("🎤 OpenVoice TTS Worker shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🎤 OpenVoice TTS Worker shutting down...");
  process.exit(0);
});
