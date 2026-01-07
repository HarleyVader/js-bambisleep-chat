// workers/tts-express.js
// TTS Express Worker - Handles text-to-speech via TTS Express Server (Coqui TTS)
const { parentPort } = require("worker_threads");
const http = require("http");
const https = require("https");
const ENV = require("../config/env");

// HTTP Keep-Alive agents for connection reuse (faster subsequent requests)
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

class TTSExpressWorker {
  constructor() {
    this.isHealthy = false;
    this.fallbackMode = false;
    this.outputFormat = "wav"; // TTS Express outputs WAV

    // OPTIMIZATION: Audio cache for repeated phrases (LRU-style)
    this.audioCache = new Map();
    this.maxCacheSize = 50;
    this.cacheHits = 0;
    this.cacheMisses = 0;

    // OPTIMIZATION: Request queue for batch processing
    this.pendingRequests = new Map();
    this.processingBatch = false;

    try {
      this.initializeTTSExpressConfig();
    } catch (error) {
      console.warn("⚠️ TTS Express configuration incomplete:", error.message);
      console.warn(
        "🔄 Running in fallback mode - TTS will use Web Speech API only"
      );
      this.fallbackMode = true;
      this.isHealthy = false;
    }

    this.init();
  }

  initializeTTSExpressConfig() {
    if (!ENV.TTS_EXPRESS.isConfigured) {
      throw new Error(
        `Missing TTS Express host config for ${ENV.NODE_ENV} environment`
      );
    }

    this.ttsExpressUrl = ENV.TTS_EXPRESS.URL;
    this.defaultVoice = ENV.TTS_EXPRESS.DEFAULT_VOICE;
    this.defaultModel = ENV.TTS_EXPRESS.DEFAULT_MODEL;
    this.isHealthy = true;

    console.log("✅ TTS Express configured:", this.ttsExpressUrl);
  }

  async init() {
    console.log("🎤 TTS Express Worker initializing...");
    if (this.fallbackMode) {
      console.log("🎤 TTS Express running in fallback mode");
    } else {
      console.log(`🎤 TTS Express service URL: ${this.ttsExpressUrl}`);
      // Check health on startup
      await this.checkHealth();
    }

    if (parentPort) {
      parentPort.on("message", this.handleMessage.bind(this));
    }
  }

  async checkHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.ttsExpressUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        this.isHealthy = data.status === "healthy";
        console.log("✅ TTS Express health check passed");
      } else {
        this.isHealthy = false;
        console.warn("⚠️ TTS Express health check failed");
      }
    } catch (error) {
      this.isHealthy = false;
      console.warn("⚠️ TTS Express health check error:", error.message);
    }
  }

  async handleMessage(msg) {
    try {
      if (this.fallbackMode && msg.type === "tts") {
        this.sendError(
          "TTS Express not available - using Web Speech API fallback",
          msg.socketId
        );
        return;
      }

      switch (msg.type) {
        case "tts":
          await this.generateSpeech(msg);
          break;

        case "tts_batch":
          // OPTIMIZATION: Process multiple texts in parallel
          await this.generateSpeechBatch(msg);
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
          await this.checkHealth();
          this.sendResponse(
            "health_response",
            {
              healthy: this.isHealthy,
              fallbackMode: this.fallbackMode,
              url: this.ttsExpressUrl || "not-configured",
              lastCheck: new Date().toISOString(),
            },
            msg.socketId
          );
          break;

        case "set_voice":
          if (this.fallbackMode) {
            this.sendError(
              "Voice setting not available in fallback mode",
              msg.socketId
            );
            return;
          }
          this.defaultVoice = msg.voice || this.defaultVoice;
          this.sendResponse(
            "voice_updated",
            {
              voice: this.defaultVoice,
            },
            msg.socketId
          );
          break;

        case "get_voices":
          await this.getAvailableVoices(msg.socketId);
          break;

        case "get_models":
          await this.getAvailableModels(msg.socketId);
          break;

        default:
          console.warn(`Unknown message type: ${msg.type}`);
      }
    } catch (error) {
      console.error("TTS Express worker error:", error);
      this.sendError(error.message, msg.socketId);
    }
  }

  // OPTIMIZATION: Generate cache key for audio caching
  getCacheKey(text, voice, model) {
    return `${voice}:${model}:${text.substring(0, 200)}`; // Limit key length
  }

  // OPTIMIZATION: Add to cache with LRU eviction
  addToCache(key, audioBase64) {
    // Evict oldest entries if cache is full
    if (this.audioCache.size >= this.maxCacheSize) {
      const firstKey = this.audioCache.keys().next().value;
      this.audioCache.delete(firstKey);
    }
    this.audioCache.set(key, {
      data: audioBase64,
      timestamp: Date.now(),
    });
  }

  async generateSpeech(msg) {
    const { text, voice, model, socketId, speed = 1.0 } = msg;

    if (!text || typeof text !== "string") {
      throw new Error("Invalid text input for TTS");
    }

    const selectedVoice = voice || this.defaultVoice;
    const selectedModel = model || this.defaultModel;
    const cacheKey = this.getCacheKey(text, selectedVoice, selectedModel);

    // OPTIMIZATION: Check cache first
    const cached = this.audioCache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      console.log(
        `⚡ Cache hit for: "${text.substring(0, 30)}..." (${
          this.cacheHits
        } hits)`
      );
      this.sendResponse(
        "tts_success",
        {
          audioData: cached.data,
          format: "wav",
          voice: selectedVoice,
          model: selectedModel,
          text: text,
          size: cached.data.length * 0.75, // Approximate size from base64
          cached: true,
          timestamp: new Date().toISOString(),
        },
        socketId
      );
      return;
    }
    this.cacheMisses++;

    console.log(
      `🎤 Generating speech: "${text.substring(
        0,
        50
      )}..." with voice: ${selectedVoice}`
    );

    try {
      // OPTIMIZATION: Reduced timeout from 30s to 15s for faster failure detection
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // Use the /tts streaming endpoint for direct audio
      const url = new URL(`${this.ttsExpressUrl}/tts`);
      url.searchParams.set("text", text);
      url.searchParams.set("voice", selectedVoice);
      url.searchParams.set("speed", speed.toString());
      url.searchParams.set("model", selectedModel);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "audio/wav",
          Connection: "keep-alive",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `TTS Express API error (${response.status}): ${errorText}`
        );
      }

      // Get audio buffer
      const audioBuffer = await response.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      // OPTIMIZATION: Cache the result
      this.addToCache(cacheKey, audioBase64);

      console.log(
        `✅ Speech generated successfully (${audioBuffer.byteLength} bytes)`
      );

      this.sendResponse(
        "tts_success",
        {
          audioData: audioBase64,
          format: "wav",
          voice: selectedVoice,
          model: selectedModel,
          text: text,
          size: audioBuffer.byteLength,
          cached: false,
          timestamp: new Date().toISOString(),
        },
        socketId
      );
    } catch (error) {
      console.error("TTS Express generation failed:", error);
      this.sendError(`TTS generation failed: ${error.message}`, socketId);
    }
  }

  // Alternative method using POST /api/tts/generate for more control
  async generateSpeechWithPost(msg) {
    const { text, voice, model, socketId, speed = 1.0 } = msg;

    if (!text || typeof text !== "string") {
      throw new Error("Invalid text input for TTS");
    }

    const selectedVoice = voice || this.defaultVoice;
    const selectedModel = model || this.defaultModel;

    console.log(
      `🎤 Generating speech (POST): "${text.substring(
        0,
        50
      )}..." with model: ${selectedModel}`
    );

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(`${this.ttsExpressUrl}/api/tts/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Connection: "keep-alive",
        },
        body: JSON.stringify({
          text: text,
          model: selectedModel,
          speed: speed,
          language: "en",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `TTS Express API error (${response.status}): ${errorText}`
        );
      }

      const result = await response.json();

      if (result.success && result.audioFile) {
        // Fetch the generated audio file
        const audioResponse = await fetch(
          `${this.ttsExpressUrl}${result.audioFile.url}`
        );
        const audioBuffer = await audioResponse.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString("base64");

        console.log(
          `✅ Speech generated successfully (${audioBuffer.byteLength} bytes)`
        );

        this.sendResponse(
          "tts_success",
          {
            audioData: audioBase64,
            format: "wav",
            voice: selectedVoice,
            model: selectedModel,
            text: text,
            size: audioBuffer.byteLength,
            audioUrl: `${this.ttsExpressUrl}${result.audioFile.url}`,
            cached: false,
            timestamp: new Date().toISOString(),
          },
          socketId
        );
      } else {
        throw new Error("TTS generation returned no audio file");
      }
    } catch (error) {
      console.error("TTS Express generation failed:", error);
      this.sendError(`TTS generation failed: ${error.message}`, socketId);
    }
  }

  // OPTIMIZATION: Batch process multiple texts in parallel
  async generateSpeechBatch(msg) {
    const { texts, voice, model, socketId } = msg;

    if (!Array.isArray(texts) || texts.length === 0) {
      this.sendError("Invalid texts array for batch TTS", socketId);
      return;
    }

    console.log(`🎤 Batch generating ${texts.length} speeches`);
    const startTime = Date.now();

    // Process up to 3 requests in parallel for optimal performance
    const batchSize = 3;
    const results = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map((text, idx) =>
        this.generateSpeechInternal(text, voice, model)
          .then((result) => ({ index: i + idx, success: true, ...result }))
          .catch((error) => ({
            index: i + idx,
            success: false,
            error: error.message,
          }))
      );
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `✅ Batch complete: ${results.filter((r) => r.success).length}/${
        texts.length
      } in ${elapsed}ms`
    );

    this.sendResponse(
      "tts_batch_success",
      {
        results: results,
        totalTime: elapsed,
        timestamp: new Date().toISOString(),
      },
      socketId
    );
  }

  // Internal speech generation without socket response (for batch processing)
  async generateSpeechInternal(text, voice, model) {
    const selectedVoice = voice || this.defaultVoice;
    const selectedModel = model || this.defaultModel;
    const cacheKey = this.getCacheKey(text, selectedVoice, selectedModel);

    // Check cache
    const cached = this.audioCache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return {
        audioData: cached.data,
        format: "wav",
        voice: selectedVoice,
        model: selectedModel,
        text,
        cached: true,
      };
    }
    this.cacheMisses++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const url = new URL(`${this.ttsExpressUrl}/tts`);
    url.searchParams.set("text", text);
    url.searchParams.set("voice", selectedVoice);
    url.searchParams.set("speed", "1.0");
    url.searchParams.set("model", selectedModel);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "audio/wav", Connection: "keep-alive" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok)
      throw new Error(`TTS Express API error: ${response.status}`);

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");
    this.addToCache(cacheKey, audioBase64);

    return {
      audioData: audioBase64,
      format: "wav",
      voice: selectedVoice,
      model: selectedModel,
      text,
      cached: false,
      size: audioBuffer.byteLength,
    };
  }

  async getAvailableVoices(socketId) {
    try {
      const response = await fetch(`${this.ttsExpressUrl}/api/tts/voices`);
      if (response.ok) {
        const data = await response.json();
        this.sendResponse(
          "voices_list",
          { voices: data.voices, default: data.default },
          socketId
        );
      } else {
        // Return default voices if API fails
        this.sendResponse(
          "voices_list",
          {
            voices: ENV.TTS_EXPRESS.AVAILABLE_VOICES,
            default: this.defaultVoice,
          },
          socketId
        );
      }
    } catch (error) {
      console.error("Failed to fetch voices:", error);
      this.sendResponse(
        "voices_list",
        {
          voices: ENV.TTS_EXPRESS.AVAILABLE_VOICES,
          default: this.defaultVoice,
        },
        socketId
      );
    }
  }

  async getAvailableModels(socketId) {
    try {
      const response = await fetch(`${this.ttsExpressUrl}/api/tts/models`);
      if (response.ok) {
        const data = await response.json();
        this.sendResponse("models_list", data, socketId);
      } else {
        // Return default models from ENV config if API fails
        this.sendResponse(
          "models_list",
          {
            total: ENV.TTS_EXPRESS.AVAILABLE_MODELS.length,
            models: ENV.TTS_EXPRESS.AVAILABLE_MODELS,
            categories: {
              singleSpeaker: ENV.TTS_EXPRESS.AVAILABLE_MODELS.filter(m => !m.multiSpeaker).length,
              multiSpeaker: ENV.TTS_EXPRESS.AVAILABLE_MODELS.filter(m => m.multiSpeaker).length,
              multiLingual: ENV.TTS_EXPRESS.AVAILABLE_MODELS.filter(m => m.multiLingual).length,
            },
          },
          socketId
        );
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
      this.sendResponse(
        "models_list",
        {
          total: ENV.TTS_EXPRESS.AVAILABLE_MODELS.length,
          models: ENV.TTS_EXPRESS.AVAILABLE_MODELS,
          categories: {
            singleSpeaker: ENV.TTS_EXPRESS.AVAILABLE_MODELS.filter(m => !m.multiSpeaker).length,
            multiSpeaker: ENV.TTS_EXPRESS.AVAILABLE_MODELS.filter(m => m.multiSpeaker).length,
            multiLingual: ENV.TTS_EXPRESS.AVAILABLE_MODELS.filter(m => m.multiLingual).length,
          },
          error: error.message,
        },
        socketId
      );
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
        type: "error",
        error,
        socketId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

// Initialize worker
const worker = new TTSExpressWorker();

// Handle worker shutdown
process.on("SIGTERM", () => {
  console.log("🎤 TTS Express Worker shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🎤 TTS Express Worker shutting down...");
  process.exit(0);
});
