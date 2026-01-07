/**
 * Centralized Environment Configuration for BambiSleep Chat
 * Standardizes environment variable access across the entire codebase
 */

const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config();

/**
 * Environment Mode Detection
 */
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";
const isDevelopment = NODE_ENV === "development";
const isTest = NODE_ENV === "test";

/**
 * Server Configuration
 */
const SERVER = {
  PORT: parseInt(process.env.PORT),
  HOST: process.env.SERVER_HOST,
  NODE_ENV,
  isProduction,
  isDevelopment,
  isTest,

  // Computed URLs
  get URL() {
    return `http://${this.HOST}:${this.PORT}`;
  },

  get isConfigured() {
    return !!(this.HOST && this.PORT);
  },
};

/**
 * LM Studio AI Configuration
 * Automatically selects host based on environment
 */
const LMS = {
  HOST: isProduction
    ? process.env.LMS_HOST_PRODUCTION
    : process.env.LMS_HOST_DEVELOPMENT,
  PORT: parseInt(process.env.LMS_PORT),

  // Model Configuration
  TARGET_MODEL_NAME: process.env.TARGET_MODEL_NAME,
  MAX_SEARCH_ATTEMPTS: parseInt(process.env.MAX_SEARCH_ATTEMPTS),

  // Timeouts (milliseconds)
  MODEL_LOAD_TIMEOUT: parseInt(process.env.LMS_MODEL_LOAD_TIMEOUT),
  API_CALL_TIMEOUT: parseInt(process.env.LMS_API_CALL_TIMEOUT),
  REST_API_TIMEOUT: parseInt(process.env.LMS_REST_API_TIMEOUT),
  SESSION_TIMEOUT_MINUTES: parseInt(process.env.SESSION_TIMEOUT_MINUTES),

  // Context Window
  MAX_CONTEXT_TOKENS: parseInt(process.env.MAX_CONTEXT_TOKENS),
  MAX_COMPLETION_TOKENS: parseInt(process.env.MAX_COMPLETION_TOKENS),

  // Derived values
  get URL() {
    return this.HOST ? `http://${this.HOST}:${this.PORT}` : null;
  },

  get isConfigured() {
    return !!(this.HOST && this.PORT);
  },
};

/**
 * TTS Express Server Configuration (Coqui TTS)
 * Primary TTS service - Automatically selects host based on environment
 */
const TTS_EXPRESS = {
  HOST: isProduction
    ? process.env.TTS_EXPRESS_HOST_PRODUCTION
    : process.env.TTS_EXPRESS_HOST_DEVELOPMENT,
  PORT: parseInt(process.env.TTS_EXPRESS_PORT) || 8880,

  DEFAULT_VOICE: process.env.TTS_EXPRESS_DEFAULT_VOICE || "af_bella",
  DEFAULT_MODEL:
    process.env.TTS_EXPRESS_DEFAULT_MODEL || "tts_models/en/ljspeech/glow-tts",
  TIMEOUT: parseInt(process.env.TTS_TIMEOUT) || 15000,

  // All available female voices (TTS Express Server)
  AVAILABLE_VOICES: [
    "af_alloy",
    "af_aoede",
    "af_bella",
    "af_heart",
    "af_jadzia",
    "af_jessica",
    "af_kore",
    "af_nicole",
    "af_nova",
    "af_river",
    "af_sarah",
    "af_sky",
  ],

  // All available TTS models (Coqui TTS)
  AVAILABLE_MODELS: [
    {
      name: "tts_models/en/ljspeech/glow-tts",
      description: "Glow-TTS model trained on LJ Speech dataset",
      language: "en",
      multiSpeaker: false,
      multiLingual: false,
      quality: "high",
      speed: "medium",
    },
    {
      name: "tts_models/en/ljspeech/tacotron2-DDC",
      description: "Tacotron2 model with DDC vocoder",
      language: "en",
      multiSpeaker: false,
      multiLingual: false,
      quality: "very_high",
      speed: "slow",
    },
    {
      name: "tts_models/multilingual/multi-dataset/xtts_v2",
      description: "XTTS v2 - Multilingual with voice cloning support",
      language: "multilingual",
      multiSpeaker: true,
      multiLingual: true,
      quality: "high",
      speed: "fast",
      cloning: true,
    },
    {
      name: "tts_models/en/ljspeech/speedyspeech",
      description: "SpeedySpeech - Fast inference TTS",
      language: "en",
      multiSpeaker: false,
      multiLingual: false,
      quality: "medium",
      speed: "very_fast",
    },
    {
      name: "tts_models/en/ljspeech/vits",
      description: "VITS model - High quality with fast synthesis",
      language: "en",
      multiSpeaker: false,
      multiLingual: false,
      quality: "high",
      speed: "fast",
    },
  ],

  // Derived values
  get URL() {
    return this.HOST ? `http://${this.HOST}:${this.PORT}` : null;
  },

  get isConfigured() {
    return !!(this.HOST && this.PORT);
  },
};

/**
 * Chat Configuration
 */
const CHAT = {
  MAX_MESSAGE_LENGTH: parseInt(process.env.MAX_MESSAGE_LENGTH),
  HISTORY_LIMIT: parseInt(process.env.CHAT_HISTORY_LIMIT),
};

/**
 * Debug & Logging Configuration
 */
const DEBUG = {
  MODE: process.env.DEBUG_MODE === "true",
  LOG_LEVEL: process.env.LOG_LEVEL,
};

/**
 * Testing Configuration
 */
const TEST = {
  CI: process.env.CI === "true",
  SERVER_TIMEOUT: parseInt(process.env.TEST_SERVER_TIMEOUT),
};

/**
 * Security Configuration
 */
const SECURITY = {
  HTTPS_REDIRECT: process.env.HTTPS_REDIRECT === "true",
  SSL_CERT_PATH: process.env.SSL_CERT_PATH || "",
  SSL_KEY_PATH: process.env.SSL_KEY_PATH || "",
  CORS_ORIGIN: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : [`http://${SERVER.HOST}:${SERVER.PORT}`],
};

/**
 * External Services & URLs
 * Official documentation and resource URLs
 */
const EXTERNAL = {
  BAMBISLEEP_WIKI: "https://bambisleep.info",
  BAMBISLEEP_TRIGGERS: "https://bambisleep.info/Triggers",
  TTS_EXPRESS_DOCS: "https://github.com/BambiSleepChurch/tts-express-server",
  SOCKETIO_CDN: "https://cdn.socket.io/4.7.5/socket.io.min.js",
  MARKDOWN_CDN:
    "https://cdn.jsdelivr.net/npm/markdown-it@13.0.1/dist/markdown-it.min.js",
};

/**
 * Validation Helper
 * Checks if required services are properly configured
 */
const validation = {
  validateLMS() {
    const missing = [];
    if (!LMS.HOST)
      missing.push("LMS_HOST_" + (isProduction ? "PRODUCTION" : "DEVELOPMENT"));
    if (!LMS.PORT) missing.push("LMS_PORT");

    return {
      valid: missing.length === 0,
      missing,
      configured: LMS.isConfigured,
    };
  },

  validateTTSExpress() {
    const missing = [];
    if (!TTS_EXPRESS.HOST)
      missing.push(
        "TTS_EXPRESS_HOST_" + (isProduction ? "PRODUCTION" : "DEVELOPMENT")
      );
    if (!TTS_EXPRESS.PORT) missing.push("TTS_EXPRESS_PORT");

    return {
      valid: missing.length === 0,
      missing,
      configured: TTS_EXPRESS.isConfigured,
    };
  },

  validateAll() {
    return {
      lms: this.validateLMS(),
      ttsExpress: this.validateTTSExpress(),
      server: {
        valid: true,
        configured: true,
      },
    };
  },
};

/**
 * Configuration Summary
 * Returns a safe summary of the configuration (no sensitive data)
 */
function getSummary() {
  return {
    environment: NODE_ENV,
    server: {
      port: SERVER.PORT,
      host: SERVER.HOST,
    },
    services: {
      lms: {
        configured: LMS.isConfigured,
        url: LMS.URL || "not-configured",
      },
      ttsExpress: {
        configured: TTS_EXPRESS.isConfigured,
        url: TTS_EXPRESS.URL || "not-configured",
        defaultVoice: TTS_EXPRESS.DEFAULT_VOICE,
        defaultModel: TTS_EXPRESS.DEFAULT_MODEL,
      },
    },
    debug: DEBUG.MODE,
    test: TEST.CI,
  };
}

/**
 * Print Configuration Summary
 * Logs configuration to console in a readable format
 */
function printSummary() {
  console.log("\n🔧 BambiSleep Chat Configuration");
  console.log("═".repeat(50));
  console.log(`📍 Environment: ${NODE_ENV.toUpperCase()}`);
  console.log(`🌐 Server: http://${SERVER.HOST}:${SERVER.PORT}`);
  console.log("\n🤖 Services:");
  console.log(
    `   LM Studio: ${LMS.isConfigured ? "✅ " + LMS.URL : "❌ Not Configured"}`
  );
  console.log(
    `   TTS Express: ${
      TTS_EXPRESS.isConfigured ? "✅ " + TTS_EXPRESS.URL : "❌ Not Configured"
    }`
  );
  console.log(`   Default Voice: ${TTS_EXPRESS.DEFAULT_VOICE}`);
  console.log(`   Default Model: ${TTS_EXPRESS.DEFAULT_MODEL}`);

  console.log("\n📊 Limits:");
  console.log(`   Max Message Length: ${CHAT.MAX_MESSAGE_LENGTH}`);
  console.log(`   Chat History: ${CHAT.HISTORY_LIMIT}`);
  console.log(`   LMS Timeout: ${LMS.API_CALL_TIMEOUT}ms`);
  console.log(`   TTS Timeout: ${TTS_EXPRESS.TIMEOUT}ms`);
  console.log("\n🔍 Debug Mode: " + (DEBUG.MODE ? "✅ ON" : "❌ OFF"));
  console.log("═".repeat(50) + "\n");
}

// Export all configuration
module.exports = {
  // Main config objects
  SERVER,
  LMS,
  TTS_EXPRESS,
  KOKORO,
  CHAT,
  DEBUG,
  TEST,
  SECURITY,
  EXTERNAL,

  // Environment flags
  NODE_ENV,
  isProduction,
  isDevelopment,
  isTest,

  // Utilities
  validation,
  getSummary,
  printSummary,

  // Legacy compatibility - export individual values
  PORT: SERVER.PORT,
  SERVER_HOST: SERVER.HOST,

  // TTS Express (primary)
  TTS_EXPRESS_URL: TTS_EXPRESS.URL,
  TTS_EXPRESS_DEFAULT_VOICE: TTS_EXPRESS.DEFAULT_VOICE,
  TTS_EXPRESS_DEFAULT_MODEL: TTS_EXPRESS.DEFAULT_MODEL,
  TTS_TIMEOUT: TTS_EXPRESS.TIMEOUT,

  // Kokoro legacy
  KOKORO_API_URL: KOKORO.URL,
  KOKORO_API_KEY: KOKORO.API_KEY,
  KOKORO_DEFAULT_VOICE: KOKORO.DEFAULT_VOICE,
};
