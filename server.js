// server.js
// Express + Socket.io + TTS + Triggers + LM Studio chat server
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Worker } = require("worker_threads");
const path = require("path");

// Centralized environment configuration
const ENV = require("./config/env");

// Legacy config object for backward compatibility
const config = {
  KOKORO_API_URL: ENV.KOKORO.URL,
  KOKORO_API_KEY: ENV.KOKORO.API_KEY,
  KOKORO_DEFAULT_VOICE: ENV.KOKORO.DEFAULT_VOICE,
  TTS_TIMEOUT: ENV.KOKORO.TIMEOUT,
};

// Comprehensive Environment Variable Validation System
class EnvironmentValidator {
  constructor() {
    this.warnings = [];
    this.errors = [];
    this.envVars = {
      // Required variables (application will fail without these)
      required: [],

      // Optional but recommended variables
      optional: [
        { name: "PORT", default: 6969, type: "port" },
        { name: "NODE_ENV", default: "development", type: "string" },
      ],

      // Service-specific configurations
      lmStudio: [
        { name: "LMS_HOST_PRODUCTION", required: false, type: "host" },
        { name: "LMS_HOST_DEVELOPMENT", required: false, type: "host" },
        { name: "LMS_PORT", default: 7777, type: "port" },
        { name: "TARGET_MODEL_NAME", required: false, type: "string" },
        { name: "MAX_SEARCH_ATTEMPTS", default: 3, type: "number" },
        { name: "LMS_MODEL_LOAD_TIMEOUT", default: 30000, type: "number" },
        { name: "LMS_API_CALL_TIMEOUT", default: 120000, type: "number" },
        { name: "LMS_REST_API_TIMEOUT", default: 5000, type: "number" },
        { name: "SESSION_TIMEOUT_MINUTES", default: 15, type: "number" },
      ],

      // TTS (Kokoro) configurations
      kokoro: [
        { name: "KOKORO_HOST_PRODUCTION", required: false, type: "host" },
        { name: "KOKORO_HOST_DEVELOPMENT", required: false, type: "host" },
        { name: "KOKORO_PORT", default: 8880, type: "port" },
        {
          name: "KOKORO_DEFAULT_VOICE",
          default: "af_sky+af_bella",
          type: "string",
        },
        { name: "TTS_TIMEOUT", default: 300000, type: "number" },
      ],

      // Application configurations
      application: [
        { name: "MAX_CONTEXT_TOKENS", default: 6144, type: "number" },
        { name: "MAX_COMPLETION_TOKENS", default: 2048, type: "number" },
        { name: "MAX_MESSAGE_LENGTH", default: 500, type: "number" },
        { name: "CHAT_HISTORY_LIMIT", default: 100, type: "number" },
        { name: "DEBUG_MODE", default: "true", type: "boolean" },
        { name: "LOG_LEVEL", default: "info", type: "string" },
      ],
    };
  }

  validate() {
    console.log("🔧 Comprehensive Environment Validation Starting...");

    // Validate each category
    this.validateCategory("optional", "Basic Configuration");
    this.validateCategory("lmStudio", "LM Studio AI Configuration");
    this.validateCategory("kokoro", "Kokoro TTS Configuration");
    this.validateCategory("application", "Application Configuration");

    // Service-specific validation
    this.validateServiceConfigurations();

    // Report results
    this.reportResults();

    return this.getValidationSummary();
  }

  validateCategory(category, displayName) {
    console.log(`📋 Validating ${displayName}...`);

    const variables = this.envVars[category];
    if (!variables) return;

    variables.forEach((varConfig) => {
      this.validateVariable(varConfig, category);
    });
  }

  validateVariable(config, category) {
    const { name, required, default: defaultValue, type } = config;
    const value = process.env[name];

    // Check if variable exists
    if (!value) {
      if (required) {
        this.errors.push({
          category,
          variable: name,
          message: `Missing required environment variable: ${name}`,
          suggestion: `Add ${name}=<value> to your .env file`,
        });
      } else if (defaultValue !== undefined) {
        this.warnings.push({
          category,
          variable: name,
          message: `${name} not set, using default: ${defaultValue}`,
          suggestion: `Consider setting ${name}=${defaultValue} in .env file`,
        });
        // Set default value
        process.env[name] = String(defaultValue);
      } else {
        this.warnings.push({
          category,
          variable: name,
          message: `${name} not configured - related features may be limited`,
          suggestion: `Add ${name}=<value> to enable full functionality`,
        });
      }
      return;
    }

    // Type validation
    if (!this.validateType(value, type, name)) {
      this.warnings.push({
        category,
        variable: name,
        message: `${name} has unexpected format for type ${type}: ${value}`,
        suggestion: `Check ${name} format in .env file`,
      });
    }
  }

  validateType(value, type, varName) {
    switch (type) {
      case "port":
        const port = parseInt(value);
        return !isNaN(port) && port > 0 && port <= 65535;

      case "number":
        return !isNaN(parseFloat(value));

      case "boolean":
        return ["true", "false", "1", "0"].includes(value.toLowerCase());

      case "host":
        // Basic host validation (IP or hostname)
        return /^[a-zA-Z0-9.-]+$/.test(value) || value === "localhost";

      case "string":
      default:
        return typeof value === "string" && value.length > 0;
    }
  }

  validateServiceConfigurations() {
    // LM Studio service validation
    this.validateLMStudioConfig();

    // Kokoro TTS service validation
    this.validateKokoroConfig();
  }

  validateLMStudioConfig() {
    const isProduction = process.env.NODE_ENV === "production";
    const hostVar = isProduction
      ? "LMS_HOST_PRODUCTION"
      : "LMS_HOST_DEVELOPMENT";
    const host = process.env[hostVar];

    if (!host) {
      this.warnings.push({
        category: "lmStudio",
        variable: hostVar,
        message: `LM Studio host not configured for ${process.env.NODE_ENV} environment`,
        suggestion: `Set ${hostVar} in .env file to enable AI chat features`,
      });
    }

    // Check if model configuration is complete
    if (!process.env.TARGET_MODEL_NAME) {
      this.warnings.push({
        category: "lmStudio",
        variable: "TARGET_MODEL_NAME",
        message: "AI model name not specified - auto-loading may fail",
        suggestion: "Set TARGET_MODEL_NAME to specify preferred AI model",
      });
    }
  }

  validateKokoroConfig() {
    const isProduction = process.env.NODE_ENV === "production";
    const hostVar = isProduction
      ? "KOKORO_HOST_PRODUCTION"
      : "KOKORO_HOST_DEVELOPMENT";
    const host = process.env[hostVar];

    if (!host) {
      this.warnings.push({
        category: "kokoro",
        variable: hostVar,
        message: `Kokoro TTS host not configured for ${process.env.NODE_ENV} environment`,
        suggestion: `Set ${hostVar} in .env file to enable advanced TTS features`,
      });
    }

    // Validate voice configuration
    const voice = process.env.KOKORO_DEFAULT_VOICE;
    if (voice && !this.isValidKokoroVoice(voice)) {
      this.warnings.push({
        category: "kokoro",
        variable: "KOKORO_DEFAULT_VOICE",
        message: `Unrecognized voice format: ${voice}`,
        suggestion:
          'Use format like "af_bella" or "af_sky+af_bella" for voice mixing',
      });
    }
  }

  isValidKokoroVoice(voice) {
    // Basic voice validation for Kokoro format
    const validVoicePattern = /^[a-z]{2}_[a-z]+(\+[a-z]{2}_[a-z]+)*$/;
    return validVoicePattern.test(voice);
  }

  reportResults() {
    // Report errors first
    if (this.errors.length > 0) {
      console.error("❌ Configuration Errors:");
      this.errors.forEach((error) => {
        console.error(`   • ${error.message}`);
        console.error(`     💡 ${error.suggestion}`);
      });
    }

    // Report warnings
    if (this.warnings.length > 0) {
      console.warn("⚠️  Configuration Warnings:");
      this.warnings.forEach((warning) => {
        console.warn(`   • ${warning.message}`);
        console.warn(`     💡 ${warning.suggestion}`);
      });
    }

    // Success message if no errors
    if (this.errors.length === 0) {
      console.log("✅ Environment validation completed successfully");
      if (this.warnings.length === 0) {
        console.log("🎉 Perfect configuration - all variables properly set!");
      }
    }
  }

  getValidationSummary() {
    const summary = {
      success: this.errors.length === 0,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      errors: this.errors,
      warnings: this.warnings,
      servicesAvailable: {
        lmStudio: this.isServiceConfigured("lmStudio"),
        kokoro: this.isServiceConfigured("kokoro"),
      },
    };

    // Exit if critical errors exist
    if (this.errors.length > 0) {
      console.error(
        "💥 Configuration validation failed. Please fix the errors above.",
      );
      console.error(
        "📖 Refer to .env.example for proper configuration format.",
      );
      process.exit(1);
    }

    return summary;
  }

  isServiceConfigured(service) {
    const isProduction = process.env.NODE_ENV === "production";

    switch (service) {
      case "lmStudio":
        const lmsHost = isProduction
          ? process.env.LMS_HOST_PRODUCTION
          : process.env.LMS_HOST_DEVELOPMENT;
        return !!(lmsHost && process.env.LMS_PORT);

      case "kokoro":
        const kokoroHost = isProduction
          ? process.env.KOKORO_HOST_PRODUCTION
          : process.env.KOKORO_HOST_DEVELOPMENT;
        return !!(kokoroHost && process.env.KOKORO_PORT);

      default:
        return false;
    }
  }
}

// Configuration validation function (maintaining compatibility)
function validateConfiguration() {
  // Use centralized environment validation
  const validationResults = ENV.validation.validateAll();

  // Print configuration summary
  ENV.printSummary();

  const result = {
    ttsAvailable: validationResults.kokoro.configured,
    lmStudioConfigured: validationResults.lms.configured,
    servicesAvailable: {
      lmStudio: validationResults.lms.configured,
      kokoro: validationResults.kokoro.configured,
    },
    warnings: [],
    errors: [],
    errorCount: 0,
    warningCount: 0,
  };

  // Add warnings for missing services
  if (!validationResults.lms.configured) {
    result.warnings.push(
      "LM Studio not configured - AI chat will be unavailable",
    );
    result.warningCount++;
  }

  if (!validationResults.kokoro.configured) {
    result.warnings.push(
      "Kokoro TTS not configured - voice features will be unavailable",
    );
    result.warningCount++;
  }

  return result;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Validate configuration on startup
const configStatus = validateConfiguration();

// Security Middleware - Content Security Policy
app.use((req, res, next) => {
  // Dynamically include external service hosts
  const kokoroHost = ENV.KOKORO.HOST || "localhost";
  const kokoroPort = ENV.KOKORO.PORT || 8880;
  const lmsHost = ENV.LMS.HOST || "localhost";
  const lmsPort = ENV.LMS.PORT || 7777;

  // Content Security Policy for enhanced security (environment-aware)
  const isDevelopment = process.env.NODE_ENV !== "production";

  const cspDirectives = [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
    "font-src 'self' fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ];

  // Script sources
  if (isDevelopment) {
    cspDirectives.push(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' cdn.socket.io cdn.jsdelivr.net unpkg.com localhost:* ws://localhost:*",
    );
  } else {
    cspDirectives.push(
      "script-src 'self' 'unsafe-inline' cdn.socket.io cdn.jsdelivr.net unpkg.com",
    );
  }

  // Connect sources - single directive with all sources
  const connectSources = [
    "'self'",
    "ws:",
    "wss:",
    "https://cdn.socket.io",
    `http://${kokoroHost}:${kokoroPort}`,
    `http://${lmsHost}:${lmsPort}`,
  ];

  if (isDevelopment) {
    connectSources.push("ws://localhost:*", "http://localhost:*");
  }

  cspDirectives.push(`connect-src ${connectSources.join(" ")}`);

  const cspHeader = cspDirectives.join("; ");

  res.setHeader("Content-Security-Policy", cspHeader);

  // Additional security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "microphone=(), camera=(), geolocation=(), payment=()",
  );

  next();
});

// Middleware
app.use(express.json());
const cookieParser = require("cookie-parser");
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Unified Chat History Management System
class ChatHistoryManager {
  constructor() {
    this.messages = new Map(); // Store messages by type
    this.maxLimits = {
      aigf: 100, // AI chat responses
      legacy: 200, // Legacy compatibility
      all: 500, // Overall message limit
    };

    // Initialize message arrays by type
    this.messages.set("aigf", []);
    this.messages.set("legacy", []);
  }

  // Add message to specific history type(s)
  addMessage(messageData, types = ["legacy"]) {
    const timestamp = new Date().toISOString();
    const enhancedMessage = {
      ...messageData,
      id: this.generateMessageId(),
      serverTimestamp: timestamp,
      types: types, // Track which histories this message belongs to
    };

    // Add to specified types
    types.forEach((type) => {
      if (this.messages.has(type)) {
        const history = this.messages.get(type);
        history.push(enhancedMessage);

        // Maintain size limits
        const limit = this.maxLimits[type] || this.maxLimits.legacy;
        if (history.length > limit) {
          history.shift();
        }
      }
    });

    console.log(
      `📝 Added message to histories: [${types.join(", ")}] - "${
        messageData.message?.substring(0, 50) || "N/A"
      }..."`,
    );
    return enhancedMessage;
  }

  // Get history for specific type
  getHistory(type, limit = null) {
    const history = this.messages.get(type) || [];
    if (limit) {
      return history.slice(-limit);
    }
    return [...history]; // Return copy
  }

  // Get combined history (all types)
  getAllHistory(limit = null) {
    const allMessages = [];

    // Collect all messages from all types
    this.messages.forEach((history, type) => {
      allMessages.push(...history);
    });

    // Remove duplicates based on message ID and sort by timestamp
    const uniqueMessages = [
      ...new Map(allMessages.map((msg) => [msg.id, msg])).values(),
    ];

    uniqueMessages.sort(
      (a, b) => new Date(a.serverTimestamp) - new Date(b.serverTimestamp),
    );

    return limit ? uniqueMessages.slice(-limit) : uniqueMessages;
  }

  // Legacy compatibility methods
  getAIGFHistory(limit = 20) {
    return this.getHistory("aigf", limit);
  }

  getLegacyHistory(limit = 20) {
    return this.getHistory("legacy", limit);
  }

  // Statistics and management
  getStats() {
    const stats = {
      totalMessages: 0,
      byType: {},
    };

    this.messages.forEach((history, type) => {
      stats.byType[type] = history.length;
      stats.totalMessages += history.length;
    });

    return stats;
  }

  // Generate unique message ID
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Clear specific history type
  clearHistory(type) {
    if (this.messages.has(type)) {
      this.messages.get(type).length = 0;
      console.log(`🗑️ Cleared ${type} chat history`);
    }
  }

  // Clear all histories
  clearAllHistory() {
    this.messages.forEach((history, type) => {
      history.length = 0;
    });
    console.log("🗑️ Cleared all chat histories");
  }
}

// Initialize unified chat history system
const chatHistoryManager = new ChatHistoryManager();

// Legacy compatibility - maintain existing variable names for backward compatibility
let triggerWords = []; // Will be loaded from official triggers.json
let triggerData = {}; // Full trigger data for API endpoints
let connectedUsers = 0;
let uniqueUsers = new Set(); // Track unique users by IP/session

// Load OFFICIAL BambiSleep triggers from JSON file with enhanced data
function loadOfficialTriggers() {
  try {
    const fs = require("fs");
    const path = require("path");
    const triggersPath = path.join(__dirname, "workers", "triggers.json");

    const data = JSON.parse(fs.readFileSync(triggersPath, "utf8"));

    // Extract trigger names and full data from official source
    triggerWords = [];
    triggerData = data; // Store complete trigger data

    if (data.triggers && Array.isArray(data.triggers)) {
      data.triggers.forEach((trigger) => {
        const triggerName = trigger.name.toLowerCase();
        triggerWords.push(triggerName);
      });
    }

    console.log("🎯 Loaded OFFICIAL BambiSleep triggers:", triggerWords);
    console.log("📋 Source:", data.source, "| Version:", data.version);
    console.log("🏷️ Categories available:", Object.keys(data.categories || {}));
    console.log("⚡ Full trigger data loaded for API endpoints");
  } catch (error) {
    console.error(
      "CRITICAL: Failed to load official BambiSleep triggers:",
      error,
    );
    // NO FALLBACK - Only use official triggers
    triggerWords = [];
    triggerData = {};
  }
}

// Initialize official triggers on startup
loadOfficialTriggers();

// Worker Management
let lmWorker = null;
let kokoroWorker = null;
let workerUsers = new Map(); // Track which users are using AI
let collarActive = false;
let collarText = "";

// Initialize Workers
function initializeLMWorker() {
  try {
    lmWorker = new Worker(path.join(__dirname, "workers", "lmstudio.js"));

    lmWorker.on("message", (msg) => {
      handleLMWorkerMessage(msg);
    });

    lmWorker.on("error", (error) => {
      console.error("❌ LM Studio worker error:", error);
      lmWorker = null; // Mark as unavailable
    });

    lmWorker.on("exit", (code) => {
      console.log(`❌ LM Studio worker exited with code ${code}`);
      lmWorker = null; // Mark as unavailable
      if (code !== 0) {
        console.log("🔄 Restarting LM Studio worker in 5 seconds...");
        setTimeout(initializeLMWorker, 5000);
      }
    });

    // Send initial triggers and full trigger data to worker (safely)
    if (lmWorker) {
      lmWorker.postMessage({
        type: "triggers",
        triggers: triggerWords,
        triggerData: triggerData, // Send full trigger data to worker
      });
    }

    console.log("✅ LM Studio worker initialized");
  } catch (error) {
    console.error("❌ Failed to initialize LM Studio worker:", error);
    lmWorker = null; // Ensure it's marked as unavailable
  }
}

function initializeKokoroWorker() {
  try {
    kokoroWorker = new Worker(path.join(__dirname, "workers", "kokoro.js"));

    kokoroWorker.on("message", (msg) => {
      handleKokoroWorkerMessage(msg);
    });

    kokoroWorker.on("error", (error) => {
      console.error("❌ Kokoro TTS worker error:", error);
      kokoroWorker = null; // Mark as unavailable
    });

    kokoroWorker.on("exit", (code) => {
      console.log(`❌ Kokoro TTS worker exited with code ${code}`);
      kokoroWorker = null; // Mark as unavailable
      if (code !== 0) {
        console.log("🔄 Restarting Kokoro TTS worker in 5 seconds...");
        setTimeout(initializeKokoroWorker, 5000);
      }
    });

    console.log("✅ Kokoro TTS worker initialized");
  } catch (error) {
    console.error("❌ Failed to initialize Kokoro TTS worker:", error);
    kokoroWorker = null; // Ensure it's marked as unavailable
  }
}

// Helper functions to safely interact with workers
function sendToLMWorker(message, fallbackCallback = null) {
  if (lmWorker) {
    try {
      lmWorker.postMessage(message);
      return true;
    } catch (error) {
      console.error("❌ Failed to send message to LM worker:", error);
      lmWorker = null;
    }
  }

  // Worker unavailable - handle gracefully
  console.warn("⚠️ LM Studio worker unavailable, using fallback");
  if (fallbackCallback) {
    fallbackCallback();
  }
  return false;
}

function sendToKokoroWorker(message, fallbackCallback = null) {
  if (kokoroWorker) {
    try {
      kokoroWorker.postMessage(message);
      return true;
    } catch (error) {
      console.error("❌ Failed to send message to Kokoro worker:", error);
      kokoroWorker = null;
    }
  }

  // Worker unavailable - handle gracefully
  console.warn("⚠️ Kokoro TTS worker unavailable, using fallback");
  if (fallbackCallback) {
    fallbackCallback();
  }
  return false;
}

// Handle messages from LM Studio worker
function handleLMWorkerMessage(msg) {
  switch (msg.type) {
    case "response":
      // Check if this is an API request
      if (
        global.pendingAPIRequests &&
        global.pendingAPIRequests[msg.socketId]
      ) {
        const { res, timeout } = global.pendingAPIRequests[msg.socketId];
        clearTimeout(timeout);
        res.json({
          response: msg.response,
          wordCount: msg.wordCount || 0,
          timestamp: new Date().toISOString(),
        });
        delete global.pendingAPIRequests[msg.socketId];
        return;
      }

      // Send AI response to specific socket for regular chat
      if (msg.socketId) {
        io.to(msg.socketId).emit("ai-response", {
          message: msg.response,
          timestamp: new Date().toISOString(),
          wordCount: msg.wordCount || 0,
        });

        // Add to AIGF chat history only (not global)
        const messageData = {
          id: Date.now(),
          message: msg.response,
          timestamp: new Date().toISOString(),
          user: "BambiSleep",
          isAI: true,
          type: "aigf",
        };

        // Add to unified chat history system
        chatHistoryManager.addMessage(messageData, ["aigf", "legacy"]);
      }
      break;

    case "error":
      console.error("Worker error:", msg.error);

      // Check if this is an API request
      if (
        global.pendingAPIRequests &&
        global.pendingAPIRequests[msg.socketId]
      ) {
        const { res, timeout } = global.pendingAPIRequests[msg.socketId];
        clearTimeout(timeout);
        res.status(500).json({ error: msg.error || "AI processing error" });
        delete global.pendingAPIRequests[msg.socketId];
        return;
      }

      // Handle regular socket error
      if (msg.socketId) {
        io.to(msg.socketId).emit("ai-error", {
          error: msg.error,
          timestamp: new Date().toISOString(),
        });
      }
      break;

    case "health_response":
      console.log(
        `Worker health: ${msg.healthy}, sessions: ${msg.sessionCount}`,
      );
      break;

    case "model_loaded":
      console.log(`✅ Model loaded: ${msg.modelId} (${msg.modelSize})`);
      io.emit("model-status", {
        loaded: true,
        modelId: msg.modelId,
        modelSize: msg.modelSize,
        timestamp: new Date().toISOString(),
      });
      break;
  }
}

// Handle messages from Kokoro TTS worker
function handleKokoroWorkerMessage(msg) {
  switch (msg.type) {
    case "tts_success":
      // Send TTS audio to specific socket
      if (msg.socketId) {
        io.to(msg.socketId).emit("tts-response", {
          audioData: msg.audioData,
          format: msg.format,
          voice: msg.voice,
          text: msg.text,
          size: msg.size,
          timestamp: msg.timestamp,
        });
      }
      console.log(`✅ TTS generated for ${msg.socketId}: ${msg.size} bytes`);
      break;

    case "error":
      console.error("Kokoro TTS error:", msg.error);
      if (msg.socketId) {
        io.to(msg.socketId).emit("tts-error", {
          error: msg.error,
          timestamp: msg.timestamp,
        });
      }
      break;

    case "health_response":
      console.log(`🎤 Kokoro TTS health: ${msg.healthy}, URL: ${msg.url}`);
      break;

    case "voice_updated":
      console.log(`🎤 Voice updated to: ${msg.voice}`);
      break;
  }
}

// Initialize workers on startup
initializeLMWorker();
initializeKokoroWorker();

// Setup TTS Routes with configuration validation
setupTTSRoutes(app, configStatus);

// Socket.io connection handling
io.on("connection", (socket) => {
  connectedUsers++;

  // Track unique users by IP address for more accurate counting
  const clientIP =
    socket.handshake.address || socket.request.connection.remoteAddress;
  const userAgent = socket.handshake.headers["user-agent"] || "unknown";
  const userKey = `${clientIP}-${userAgent.substring(0, 50)}`;

  uniqueUsers.add(userKey);

  console.log(
    `User connected. Total connections: ${connectedUsers}, Unique users: ${uniqueUsers.size}`,
  );
  console.log(`🔍 New connection ID: ${socket.id}`);
  console.log(`🔍 Client IP: ${clientIP}`);
  console.log(`🔍 User Agent: ${userAgent?.substring(0, 100)}`);
  console.log(`🔍 Connection origin:`, socket.handshake.headers.origin);

  // Send recent chat history to new user
  socket.emit("chat-history", chatHistoryManager.getLegacyHistory(20));

  // Check for existing Patreon session via cookie
  let tierInfo;
  const cookies = socket.handshake.headers.cookie || "";
  const patreonUserIdMatch = cookies.match(/patreon_user_id=([^;]+)/);
  const patreonUserId = patreonUserIdMatch ? patreonUserIdMatch[1] : null;

  if (patreonUserId) {
    // Try to restore tier from persistent storage
    const persistedTier = patreonService.linkSocketToPatreonUser(
      socket.id,
      patreonUserId,
    );
    if (persistedTier) {
      console.log(
        `🔄 Restored Patreon session for ${persistedTier.fullName} (${persistedTier.tier})`,
      );
      tierInfo = persistedTier;
    } else {
      console.log(
        `⚠️ Patreon cookie found but no persisted tier for user ${patreonUserId}`,
      );
      tierInfo = patreonService.getUserTier(socket.id);
    }
  } else {
    tierInfo = patreonService.getUserTier(socket.id);
  }

  // Send Patreon membership tier info on connection
  socket.emit("membership-tier", {
    tier: tierInfo.tier,
    features: tierInfo.features,
    fullName: tierInfo.fullName,
    avatarUrl: tierInfo.avatarUrl,
    thumbUrl: tierInfo.thumbUrl,
    patreonConfigured: patreonService.isConfigured(),
  });

  // Broadcast connection count (use unique users for display)
  io.emit("user-count", uniqueUsers.size);

  // Handle AI chat requests
  socket.on("ai-chat", (data) => {
    if (!lmWorker) {
      socket.emit("ai-error", {
        error: "AI worker not available",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const username = data.username || `User_${socket.id}`;
    const userTriggers = data.triggers || []; // Get user-selected triggers

    console.log(`AI chat request from ${username}: ${data.message}`);
    console.log(`🎯 User selected triggers:`, userTriggers);

    // Track this user as using AI
    workerUsers.set(socket.id, username);

    // Send message to worker with user-selected triggers
    const success = sendToLMWorker(
      {
        type: "chat",
        prompt: data.message,
        socketId: socket.id,
        username: username,
        triggers: userTriggers, // Pass user-selected triggers to worker
      },
      () => {
        // Fallback: Send error response to client
        socket.emit("ai-response", {
          content:
            "AI chat is currently unavailable. Please check your LM Studio configuration.",
          triggers: [],
          isError: true,
        });
      },
    );
  });

  // Handle trigger updates
  socket.on("update-triggers", (data) => {
    if (data.triggers && Array.isArray(data.triggers)) {
      // Update triggers for this socket
      sendToLMWorker({
        type: "triggers",
        triggers: data.triggers,
        socketId: socket.id,
      });
      console.log(
        `Updated triggers for ${socket.id}: ${data.triggers.join(", ")}`,
      );
    }
  });

  // Handle TTS requests
  socket.on("tts-request", (data) => {
    if (!kokoroWorker) {
      socket.emit("tts-error", {
        error: "Kokoro TTS worker not available",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { text, voice, format } = data;

    if (!text || typeof text !== "string") {
      socket.emit("tts-error", {
        error: "Invalid text input for TTS",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Clean and lowercase text for TTS (same cleaning as HTTP endpoint)
    const cleanedText = cleanTextForTTS(text);

    console.log(
      `🎤 TTS request from ${socket.id}: "${text.substring(
        0,
        50,
      )}..." -> cleaned: "${cleanedText.substring(0, 50)}..."`,
    );

    // Send to Kokoro worker
    sendToKokoroWorker(
      {
        type: "tts",
        text: cleanedText, // Send cleaned lowercase text
        voice: voice,
        format: format,
        socketId: socket.id,
      },
      () => {
        socket.emit("tts-error", {
          error:
            "Kokoro TTS service unavailable. Please check your configuration.",
          timestamp: new Date().toISOString(),
        });
      },
    );
  });

  // Handle voice setting updates
  socket.on("set-voice", (data) => {
    if (!kokoroWorker) {
      socket.emit("tts-error", {
        error: "Kokoro TTS worker not available",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { voice } = data;

    if (!voice || typeof voice !== "string") {
      socket.emit("tts-error", {
        error: "Invalid voice parameter",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    console.log(`🎤 Voice update from ${socket.id}: ${voice}`);

    sendToKokoroWorker({
      type: "set_voice",
      voice: voice,
      socketId: socket.id,
    });
  });

  // Handle collar activation
  socket.on("activate-collar", (data) => {
    collarActive = true;
    collarText =
      data.text || "Collar activated for deeper submission and control.";

    sendToLMWorker({
      type: "collar",
      data: collarText,
      socketId: socket.id,
    });

    console.log(
      `Collar activated for ${socket.id}: "${collarText.substring(0, 30)}..."`,
    );

    // Notify client
    socket.emit("collar-activated", {
      active: true,
      text: collarText,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle collar deactivation
  socket.on("deactivate-collar", () => {
    collarActive = false;
    collarText = "";

    console.log(`Collar deactivated for ${socket.id}`);

    // Notify client
    socket.emit("collar-activated", {
      active: false,
      timestamp: new Date().toISOString(),
    });
  });

  // Manual model loading trigger
  socket.on("load-model", () => {
    console.log(`Manual model load requested by ${socket.id}`);
    const success = sendToLMWorker(
      {
        type: "auto_load_model",
      },
      () => {
        socket.emit("model-status", {
          error: true,
          message: "LM Studio worker not available",
          timestamp: new Date().toISOString(),
        });
      },
    );

    if (success) {
      socket.emit("model-status", {
        loading: true,
        message: "Searching for best l3-sthenomaidblackroot-8b-v1 model...",
        timestamp: new Date().toISOString(),
      });
    }
  });

  socket.on("disconnect", () => {
    connectedUsers--;
    workerUsers.delete(socket.id);

    // Clean up unique user tracking on disconnect
    const clientIP =
      socket.handshake.address || socket.request.connection.remoteAddress;
    const userAgent = socket.handshake.headers["user-agent"] || "unknown";
    const userKey = `${clientIP}-${userAgent.substring(0, 50)}`;

    // Only remove unique user if no other connections from same user exist
    const hasOtherConnections = Array.from(io.sockets.sockets.values()).some(
      (s) => {
        if (s.id === socket.id) return false;
        const otherIP =
          s.handshake.address || s.request.connection.remoteAddress;
        const otherAgent = s.handshake.headers["user-agent"] || "unknown";
        const otherKey = `${otherIP}-${otherAgent.substring(0, 50)}`;
        return otherKey === userKey;
      },
    );

    if (!hasOtherConnections) {
      uniqueUsers.delete(userKey);
    }

    console.log(
      `User disconnected. Total connections: ${connectedUsers}, Unique users: ${uniqueUsers.size}`,
    );
    console.log(`🔍 Disconnected ID: ${socket.id}`);

    // Broadcast unique user count
    io.emit("user-count", uniqueUsers.size);
  });
});

// API Routes

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    users: connectedUsers,
    configuration: {
      ttsAvailable: configStatus.ttsAvailable,
      lmStudioConfigured: configStatus.lmStudioConfigured,
      warnings: configStatus.warnings,
      errors: configStatus.errors,
    },
  });
});

// Live reachability probe for LM Studio and Kokoro TTS
app.get("/api/services/status", async (req, res) => {
  function probe(hostname, port, path, timeoutMs) {
    return new Promise((resolve) => {
      const start = Date.now();
      const options = { hostname, port, path, method: "GET" };
      const r = http.request(options, (response) => {
        response.resume(); // drain
        resolve({ reachable: true, status: response.statusCode, latencyMs: Date.now() - start });
      });
      r.setTimeout(timeoutMs, () => { r.destroy(); });
      r.on("error", (e) => resolve({ reachable: false, error: e.message, latencyMs: Date.now() - start }));
      r.end();
    });
  }

  const [lms, kokoro] = await Promise.all([
    ENV.LMS.isConfigured
      ? probe(ENV.LMS.HOST, ENV.LMS.PORT, "/v1/models", 5000)
      : Promise.resolve({ reachable: false, error: "not configured" }),
    ENV.KOKORO.isConfigured
      ? probe(ENV.KOKORO.HOST, ENV.KOKORO.PORT, "/health", 5000)
      : Promise.resolve({ reachable: false, error: "not configured" }),
  ]);

  res.json({
    timestamp: new Date().toISOString(),
    lmstudio: {
      configured: ENV.LMS.isConfigured,
      endpoint: ENV.LMS.URL,
      model: ENV.LMS.TARGET_MODEL_NAME,
      ...lms,
    },
    kokoro: {
      configured: ENV.KOKORO.isConfigured,
      endpoint: ENV.KOKORO.URL,
      voice: ENV.KOKORO.DEFAULT_VOICE,
      ...kokoro,
    },
  });
});

// Serve docs folder for markdown documentation
app.use("/docs", express.static(path.join(__dirname, "public", "docs")));

// List all markdown documentation files
app.get("/api/docs/list", (req, res) => {
  const fs = require("fs");
  const docsPath = path.join(__dirname, "public", "docs");

  try {
    const files = fs
      .readdirSync(docsPath)
      .filter((file) => file.endsWith(".md"))
      .sort((a, b) => {
        // Sort README first, then alphabetically
        if (a === "README.md") return -1;
        if (b === "README.md") return 1;
        return a.localeCompare(b);
      });

    res.json({ files });
  } catch (error) {
    console.error("Error reading docs directory:", error);
    res.status(500).json({ error: "Failed to list documentation files" });
  }
});

// Chat history (legacy - combined)
app.get("/api/history", (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const messages = chatHistoryManager.getLegacyHistory(limit);
  res.json({
    messages: messages,
    total: chatHistoryManager.getHistory("legacy").length,
  });
});

// AIGF chat history
app.get("/api/aigf/history", (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const messages = chatHistoryManager.getAIGFHistory(limit);
  res.json({
    messages: messages,
    total: chatHistoryManager.getHistory("aigf").length,
    type: "aigf",
  });
});

// Unified chat history management endpoints
app.get("/api/chat/stats", (req, res) => {
  const stats = chatHistoryManager.getStats();
  res.json({
    success: true,
    statistics: stats,
    limits: chatHistoryManager.maxLimits,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/chat/all", (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const messages = chatHistoryManager.getAllHistory(limit);
  res.json({
    success: true,
    messages: messages,
    total: messages.length,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/chat/clear/:type", (req, res) => {
  const { type } = req.params;
  const validTypes = ["aigf", "legacy", "all"];

  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      error: `Invalid chat type. Valid types: ${validTypes.join(", ")}`,
    });
  }

  const originalCount =
    type === "all"
      ? chatHistoryManager.getStats().totalMessages
      : chatHistoryManager.getHistory(type).length;

  if (type === "all") {
    chatHistoryManager.clearAllHistory();
  } else {
    chatHistoryManager.clearHistory(type);
  }

  res.json({
    success: true,
    clearedType: type,
    clearedMessages: originalCount,
    timestamp: new Date().toISOString(),
  });

  console.log(
    `🗑️ Chat history cleared - Type: ${type}, Messages: ${originalCount}`,
  );
});

// Trigger management with full official data
app.get("/api/triggers", (req, res) => {
  res.json({
    triggers: triggerWords,
    data: triggerData,
    source: triggerData.source || "Unknown",
    version: triggerData.version || "Unknown",
    categories: triggerData.categories || {},
    count: triggerWords.length,
  });
});

// Serve the raw triggers.json file
app.get("/api/triggers/json", (req, res) => {
  res.json(triggerData);
});

// Get triggers by category
app.get("/api/triggers/category/:category", (req, res) => {
  const { category } = req.params;

  if (!triggerData.triggers) {
    return res.status(404).json({ error: "Trigger data not loaded" });
  }

  const categoryTriggers = triggerData.triggers.filter(
    (trigger) => trigger.category === category,
  );

  res.json({
    category,
    triggers: categoryTriggers,
    count: categoryTriggers.length,
    description: triggerData.categories
      ? triggerData.categories[category]
      : "No description",
  });
});

// Get specific trigger details
app.get("/api/triggers/details/:triggerName", (req, res) => {
  const { triggerName } = req.params;

  if (!triggerData.triggers) {
    return res.status(404).json({ error: "Trigger data not loaded" });
  }

  const trigger = triggerData.triggers.find(
    (t) => t.name.toLowerCase() === triggerName.toLowerCase(),
  );

  if (trigger) {
    res.json(trigger);
  } else {
    res.status(404).json({ error: "Trigger not found" });
  }
});

app.post("/api/triggers", (req, res) => {
  res.status(403).json({
    error:
      "Trigger modification disabled - Only official BambiSleep triggers are supported",
    message:
      "This system uses exclusively official triggers from https://bambisleep.info/Triggers",
  });
});

// AI Chat endpoint
app.post("/api/chat", (req, res) => {
  const { message, username, triggers, collar } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Invalid message input" });
  }

  if (!lmWorker) {
    return res.status(503).json({ error: "AI worker not available" });
  }

  // Generate a temporary socket ID for API requests
  const tempSocketId = `api_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  // Send to worker
  const success = sendToLMWorker(
    {
      type: "chat",
      prompt: message,
      socketId: tempSocketId,
      username: username || "Anonymous",
      triggers: triggers || [], // Pass triggers to worker
    },
    () => {
      res.status(503).json({
        error:
          "LM Studio worker not available. Please check your configuration.",
        configurable: true,
      });
      if (
        global.pendingAPIRequests &&
        global.pendingAPIRequests[tempSocketId]
      ) {
        clearTimeout(global.pendingAPIRequests[tempSocketId].timeout);
        delete global.pendingAPIRequests[tempSocketId];
      }
    },
  );

  if (!success) {
    return; // Fallback already handled the response
  }

  // Set a timeout to respond
  const timeout = setTimeout(() => {
    res.status(504).json({ error: "AI response timeout" });
    delete pendingAPIRequests[tempSocketId];
  }, 60000); // 1 minute timeout

  // Store the response object for this request
  if (!global.pendingAPIRequests) {
    global.pendingAPIRequests = {};
  }
  global.pendingAPIRequests[tempSocketId] = { res, timeout };
});

// Collar management
app.post("/api/collar", (req, res) => {
  const { active, text } = req.body;

  collarActive = Boolean(active);
  collarText = active
    ? text || "Collar activated for deeper submission and control."
    : "";

  if (active) {
    sendToLMWorker({
      type: "collar",
      data: collarText,
    });
  }

  res.json({
    success: true,
    active: collarActive,
    text: collarText,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/collar", (req, res) => {
  res.json({
    active: collarActive,
    text: collarText,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// PATREON OAUTH ROUTES
// ============================================================================
const patreonService = require("./services/patreon");

const ALLOWED_PATREON_IMAGE_HOSTS = new Set([
  "c10.patreonusercontent.com",
  "c6.patreonusercontent.com",
  "c5.patreonusercontent.com",
  "c4.patreonusercontent.com",
  "c3.patreonusercontent.com",
  "c2.patreonusercontent.com",
  "c1.patreonusercontent.com",
  "c0.patreonusercontent.com",
]);

async function fetchRemoteImageAsDataUrl(url) {
  try {
    if (typeof url !== "string" || !url.startsWith("https://")) {
      return null;
    }

    const parsedUrl = new URL(url);
    if (!ALLOWED_PATREON_IMAGE_HOSTS.has(parsedUrl.hostname)) {
      throw new Error(`Unsupported avatar host: ${parsedUrl.hostname}`);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch remote image: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.warn("⚠️ Patreon avatar proxy failed:", error.message);
    return null;
  }
}

async function normalizePatreonAvatarUrls({ avatarUrl, thumbUrl }) {
  return {
    avatarUrl: avatarUrl ? await fetchRemoteImageAsDataUrl(avatarUrl) : null,
    thumbUrl: thumbUrl ? await fetchRemoteImageAsDataUrl(thumbUrl) : null,
  };
}

// Patreon OAuth initiation
app.get("/auth/patreon", (req, res) => {
  try {
    const socketId = req.query.socket_id || "default";
    const authUrl = patreonService.getAuthorizationUrl(socketId);
    res.redirect(authUrl);
  } catch (error) {
    console.error("❌ Patreon auth error:", error);
    res.status(503).json({
      error: "Patreon not configured",
      message: error.message,
    });
  }
});

// Get Patreon login URL (for client-side redirect)
app.get("/api/patreon/login-url", (req, res) => {
  try {
    const socketId = req.query.socketId || "default";

    if (!patreonService.isConfigured()) {
      return res.json({
        error: "Patreon not configured",
        authUrl: null,
      });
    }

    const authUrl = patreonService.getAuthorizationUrl(socketId);
    res.json({ authUrl });
  } catch (error) {
    console.error("❌ Patreon login URL error:", error);
    res.status(503).json({
      error: "Failed to generate Patreon login URL",
      message: error.message,
    });
  }
});

// Patreon OAuth callback
app.get("/auth/patreon/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
  }

  try {
    // Exchange code for tokens
    const tokenData = await patreonService.exchangeCodeForToken(code);

    // Get user identity and membership
    const identity = await patreonService.getUserIdentity(
      tokenData.access_token,
    );
    const tier = patreonService.determineMembershipTier(identity);

    // Get session data from state
    const sessionData = patreonService.sessionStore.get(state);
    const socketId = sessionData?.socketId || "default";

    console.log(`🔐 Patreon callback - state: ${state}, socketId: ${socketId}`);
    console.log(`📊 Session data found: ${sessionData ? "yes" : "no"}`);

    // Store tier info with avatar
    const userAttributes = identity.data.attributes;
    const normalizedAvatars = await normalizePatreonAvatarUrls({
      avatarUrl: userAttributes.image_url || null,
      thumbUrl: userAttributes.thumb_url || null,
    });

    patreonService.setUserTier(socketId, {
      tier,
      userId: identity.data.id,
      fullName: userAttributes.full_name,
      email: userAttributes.email,
      avatarUrl: normalizedAvatars.avatarUrl,
      thumbUrl: normalizedAvatars.thumbUrl,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
    });

    console.log(
      `✅ Patreon auth successful for ${userAttributes.full_name} (${tier})`,
    );
    if (userAttributes.image_url) {
      console.log(`🖼️ Avatar URL: ${userAttributes.image_url}`);
    }

    // Emit membership tier to connected socket
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      const tierInfo = patreonService.getUserTier(socketId);
      socket.emit("patreon-authenticated", {
        tier: tierInfo.tier,
        features: tierInfo.features,
        fullName: tierInfo.fullName,
        avatarUrl: tierInfo.avatarUrl,
        thumbUrl: tierInfo.thumbUrl,
        message: `Welcome back, ${tierInfo.fullName}! You have ${tierInfo.tier} tier access.`,
      });
    }

    // Set persistent cookie with Patreon user ID (30 day expiry)
    const patreonUserId = identity.data.id;
    res.cookie("patreon_user_id", patreonUserId, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: ENV.SERVER.IS_PRODUCTION,
      sameSite: "lax",
    });
    console.log(`🍪 Set patreon_user_id cookie: ${patreonUserId}`);

    // Redirect to success page with tier info
    res.redirect(`/?auth_success=true&tier=${tier}`);
  } catch (error) {
    console.error("❌ Patreon callback error:", error);
    res.redirect(`/?auth_error=${encodeURIComponent(error.message)}`);
  }
});

// Check authentication status
app.get("/api/patreon/status", (req, res) => {
  const socketId = req.query.socket_id;
  if (!socketId) {
    return res.status(400).json({ error: "socket_id required" });
  }

  const tierInfo = patreonService.getUserTier(socketId);
  res.json({
    authenticated: tierInfo.tier !== "FREE",
    tier: tierInfo.tier,
    features: tierInfo.features,
    fullName: tierInfo.fullName,
    avatarUrl: tierInfo.avatarUrl,
    thumbUrl: tierInfo.thumbUrl,
  });
});

// Check feature access
app.get("/api/patreon/check/:feature", (req, res) => {
  const socketId = req.query.socket_id;
  const feature = req.params.feature;

  if (!socketId) {
    return res.status(400).json({ error: "socket_id required" });
  }

  const hasAccess = patreonService.hasFeatureAccess(socketId, feature);
  const tierInfo = patreonService.getUserTier(socketId);

  res.json({
    feature,
    hasAccess,
    tier: tierInfo?.tier || "FREE",
    requiresTier: hasAccess ? null : "GOOD_GIRL",
  });
});

// Tier statistics (admin only)
app.get("/api/patreon/stats", (req, res) => {
  const stats = patreonService.getTierStatistics();
  res.json(stats);
});

// Setup TTS Routes with configuration validation
function setupTTSRoutes(app, configStatus = { ttsAvailable: true }) {
  // Check if Kokoro API is configured
  if (!config.KOKORO_API_URL || !kokoroWorker || !configStatus.ttsAvailable) {
    console.warn(
      "🎤 Kokoro API or worker not configured, TTS routes will return 503",
    );

    // Return service unavailable for all TTS endpoints
    app.get("/api/tts/voices", (req, res) => {
      res.status(503).json({
        error: "TTS service not configured",
        message: "Kokoro TTS worker is not available or properly configured.",
        fallback: "Web Speech API may be available in browser",
      });
    });

    app.get("/api/tts", (req, res) => {
      res.status(503).json({
        error: "TTS service not configured",
        message: "Kokoro TTS worker is not available or properly configured.",
        fallback: "Please use Web Speech API or configure Kokoro TTS",
      });
    });

    app.post("/api/tts", (req, res) => {
      res.status(503).json({
        error: "TTS service not configured",
        message: "Kokoro TTS worker is not available or properly configured.",
        fallback: "Please use Web Speech API or configure Kokoro TTS",
      });
    });

    return;
  }

  // Get voice list
  app.get("/api/tts/voices", async (req, res) => {
    try {
      // All female voices from Kokoro-FastAPI
      // Reference: https://github.com/remsky/Kokoro-FastAPI
      const femaleVoices = [
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
      ];

      // Generate all possible combinations (maximum 2 voices per Kokoro docs)
      const voiceCombinations = [];

      // Add individual voices
      femaleVoices.forEach((voice) => {
        voiceCombinations.push({
          value: voice,
          name: voice.replace("af_", "").replace(/^\w/, (c) => c.toUpperCase()),
          type: "single",
          voices: [voice],
        });
      });

      // Add dual combinations
      for (let i = 0; i < femaleVoices.length; i++) {
        for (let j = i + 1; j < femaleVoices.length; j++) {
          const combination = `${femaleVoices[i]}+${femaleVoices[j]}`;
          const name1 = femaleVoices[i]
            .replace("af_", "")
            .replace(/^\w/, (c) => c.toUpperCase());
          const name2 = femaleVoices[j]
            .replace("af_", "")
            .replace(/^\w/, (c) => c.toUpperCase());

          voiceCombinations.push({
            value: combination,
            name: `${name1} + ${name2}`,
            type: "combination",
            voices: [femaleVoices[i], femaleVoices[j]],
          });
        }
      }

      res.json({
        voices: voiceCombinations,
        femaleOnly: femaleVoices,
        defaultVoice: config.KOKORO_DEFAULT_VOICE,
        description:
          "Available Kokoro-FastAPI female voices. BambiSleep enforces female-only voices. Use + to combine up to 2 voices.",
        maxCombination: 2,
        language: "en",
        kokoro_server: config.KOKORO_API_URL,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`🎤 Voice listing error: ${error.message}`);
      res.status(500).json({
        error: "Error fetching voice list",
        details: process.env.NODE_ENV === "production" ? null : error.message,
      });
    }
  });

  // Generate speech (GET method for compatibility)
  app.get("/api/tts", async (req, res) => {
    const text = req.query.text;
    const voice = req.query.voice || config.KOKORO_DEFAULT_VOICE;

    if (typeof text !== "string" || text.trim() === "") {
      return res
        .status(400)
        .json({ error: "Invalid input: text must be a non-empty string" });
    }

    try {
      await generateTTSAudio(text, voice, res);
    } catch (error) {
      handleTTSError(error, res);
    }
  });

  // Generate speech (POST method)
  app.post("/api/tts", async (req, res) => {
    const { text, voice, format } = req.body;
    const selectedVoice = voice || config.KOKORO_DEFAULT_VOICE;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Invalid text input" });
    }

    try {
      await generateTTSAudio(text, selectedVoice, res, format);
    } catch (error) {
      handleTTSError(error, res);
    }
  });

  console.log("🎤 TTS routes configured with Kokoro integration");
}

// Clean text for TTS processing - mirrors client-side cleanTextForTTS
function cleanTextForTTS(text) {
  // Remove URLs
  text = text.replace(/https?:\/\/[^\s]+/g, "link");

  // Remove apostrophes from contractions and possessives (you'll -> youll, bambi's -> bambis)
  text = text.replace(/'/g, "");

  // Remove ALL punctuation marks that should not be spoken
  text = text.replace(/[.,;:!?"""''`~@#$%^&*()_+=\[\]{}|\\<>/\-]/g, " ");

  // Remove excessive punctuation
  text = text.replace(/[!]{2,}/g, "");
  text = text.replace(/[?]{2,}/g, "");
  text = text.replace(/[.]{3,}/g, "");

  // Replace common emoticons with words
  text = text.replace(/:\)/g, "smile");
  text = text.replace(/:\(/g, "sad");
  text = text.replace(/:D/g, "laugh");
  text = text.replace(/<3/g, "heart");

  // Remove HTML tags but preserve the text content
  text = text.replace(/<[^>]*>/g, "");

  // Remove markdown formatting
  text = text.replace(/\*\*(.*?)\*\*/g, "$1"); // Remove **bold**
  text = text.replace(/\*(.*?)\*/g, "$1"); // Remove *italic*
  text = text.replace(/__(.*?)__/g, "$1"); // Remove __underline__

  // Remove excessive whitespace and normalize
  text = text.replace(/\s+/g, " ").trim();

  // Convert to lowercase for TTS (display stays uppercase, but speech is lowercase)
  return text.toLowerCase();
}

// Generate TTS audio using Kokoro worker
async function generateTTSAudio(text, voice, res, format = "mp3") {
  return new Promise((resolve, reject) => {
    // Generate a temporary socket ID for API requests
    const tempSocketId = `api_tts_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Clean and lowercase text for TTS (same cleaning as client-side cleanTextForTTS)
    const cleanedText = cleanTextForTTS(text);

    console.log(
      `🎤 API TTS request: "${text.substring(
        0,
        50,
      )}..." -> cleaned: "${cleanedText.substring(
        0,
        50,
      )}..." with voice: ${voice}`,
    );

    // Send to Kokoro worker
    const success = sendToKokoroWorker(
      {
        type: "tts",
        text: cleanedText, // Send cleaned lowercase text
        voice: voice,
        format: format,
        socketId: tempSocketId,
      },
      () => {
        reject(
          new Error(
            "Kokoro TTS worker unavailable. Please check your configuration.",
          ),
        );
      },
    );

    if (!success) {
      return; // Fallback already handled the error
    }

    // Set a timeout to respond
    const timeout = setTimeout(() => {
      reject(new Error("TTS generation timeout"));
    }, config.TTS_TIMEOUT);

    // Listen for worker response
    const originalHandler = handleKokoroWorkerMessage;
    handleKokoroWorkerMessage = (msg) => {
      if (msg.socketId === tempSocketId) {
        clearTimeout(timeout);

        if (msg.type === "tts_success") {
          // Convert base64 to buffer and send as audio
          const audioBuffer = Buffer.from(msg.audioData, "base64");

          res.setHeader("Content-Type", "audio/mpeg");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Content-Length", audioBuffer.length);

          res.send(audioBuffer);
          resolve();
        } else if (msg.type === "error") {
          reject(new Error(msg.error));
        }

        handleKokoroWorkerMessage = originalHandler;
      } else {
        originalHandler(msg);
      }
    };
  });
}

// Handle TTS errors
function handleTTSError(error, res) {
  console.error("🎤 TTS Error:", error.message);

  if (error.message.includes("timeout")) {
    res.status(504).json({
      error: "TTS generation timeout",
      message:
        "The text-to-speech generation took too long. Please try again with shorter text.",
    });
  } else {
    res.status(500).json({
      error: "TTS generation failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// TTS Health check endpoint (enhanced) - No actual health check, just service info
app.get("/api/tts/health", async (req, res) => {
  // Determine correct Kokoro host based on NODE_ENV
  let kokoroHost;
  if (process.env.NODE_ENV === "production") {
    kokoroHost =
      process.env.KOKORO_HOST_PRODUCTION ||
      process.env.KOKORO_HOST_DEVELOPMENT ||
      "localhost";
  } else {
    kokoroHost =
      process.env.KOKORO_HOST_DEVELOPMENT ||
      process.env.KOKORO_HOST_PRODUCTION ||
      "localhost";
  }
  const kokoroPort = process.env.KOKORO_PORT || 8880;

  res.json({
    healthy: kokoroWorker ? true : false,
    service: "Kokoro TTS",
    url: `http://${kokoroHost}:${kokoroPort}`,
    config: config.KOKORO_API_URL,
    defaultVoice: config.KOKORO_DEFAULT_VOICE,
    timeout: config.TTS_TIMEOUT,
    workerAvailable: kokoroWorker ? true : false,
    timestamp: new Date().toISOString(),
  });
});

// TTS Voice management endpoint (enhanced)
app.post("/api/tts/voice", (req, res) => {
  const { voice } = req.body;

  if (!voice || typeof voice !== "string") {
    return res.status(400).json({ error: "Invalid voice parameter" });
  }

  // Validate that the voice is female only
  const femaleVoices = [
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
  ];
  const voiceParts = voice.split("+");

  for (const voicePart of voiceParts) {
    if (!femaleVoices.includes(voicePart.trim())) {
      return res.status(400).json({
        error: "Invalid voice selection - only female voices are allowed",
        allowedVoices: femaleVoices,
      });
    }
  }

  if (voiceParts.length > 2) {
    return res.status(400).json({
      error: "Voice combination limited to maximum 2 voices",
    });
  }

  const success = sendToKokoroWorker(
    {
      type: "set_voice",
      voice: voice,
    },
    () => {
      return res.status(503).json({
        error: "Kokoro TTS worker not available",
      });
    },
  );

  if (!success) {
    return; // Fallback already handled the response
  }

  res.json({
    success: true,
    voice: voice,
    timestamp: new Date().toISOString(),
  });
});

// Basic API endpoint example
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from BambiSleep Chat backend!" });
});

// Serve main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// ==================== SERVER MEMORY MANAGEMENT ====================
// 🛡️ DATA PROTECTION POLICY:
// ✅ CLEANS: Device cache, blob URLs, stale requests, technical memory
// ❌ NEVER TOUCHES: User messages, settings, localStorage, chat history
// 🎯 GOAL: Lightweight system that preserves ALL user data

class ServerMemoryManager {
  constructor() {
    this.cleanupInterval = null;
    this.memoryStats = {
      lastCleanup: new Date(),
      cleanupCount: 0,
      freedResources: 0,
    };
    this.init();
  }

  init() {
    console.log("🧹 Server memory management initialized");
    this.startCleanupCycle();
  }

  startCleanupCycle() {
    // Run cleanup every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 120000);

    console.log("🧹 Server memory cleanup cycle started (2min intervals)");
  }

  performCleanup() {
    let freedResources = 0;

    try {
      // ✅ CLEAN: Stale technical requests (device cache)
      freedResources += this.cleanupPendingRequests();

      // ❌ DISABLED: Chat history cleanup (preserves user data)
      freedResources += this.cleanupChatHistory();

      // ✅ CLEAN: Disconnected socket references (technical cleanup)
      freedResources += this.cleanupUserTracking();

      // ✅ CLEAN: Force garbage collection (device memory only)
      if (global.gc) {
        global.gc();
        freedResources += 1;
      }

      this.memoryStats.lastCleanup = new Date();
      this.memoryStats.cleanupCount++;
      this.memoryStats.freedResources += freedResources;

      if (freedResources > 0) {
        console.log(
          `🧹 Server cache cleanup: freed ${freedResources} technical resources (user data preserved)`,
        );
      }
    } catch (error) {
      console.error("❌ Server cleanup error:", error);
    }
  }
  cleanupPendingRequests() {
    if (!global.pendingAPIRequests) return 0;

    let cleaned = 0;
    const now = Date.now();
    const timeout = 60000; // 1 minute

    Object.keys(global.pendingAPIRequests).forEach((key) => {
      const request = global.pendingAPIRequests[key];
      if (now - request.timestamp > timeout) {
        clearTimeout(request.timeout);
        delete global.pendingAPIRequests[key];
        cleaned++;
      }
    });

    return cleaned;
  }

  cleanupChatHistory() {
    // ❌ DISABLED: NEVER DELETE USER CHAT DATA
    // This method intentionally does nothing to preserve user messages
    // Only technical cache/memory cleanup is allowed
    console.log("🛡️ Chat history preserved - no user data deleted");
    return 0;
  }

  cleanupUserTracking() {
    let cleaned = 0;

    // Clean up disconnected socket references
    const connectedSockets = new Set();
    io.sockets.sockets.forEach((socket, id) => {
      connectedSockets.add(id);
    });

    // Clean worker users map
    workerUsers.forEach((username, socketId) => {
      if (!connectedSockets.has(socketId)) {
        workerUsers.delete(socketId);
        cleaned++;
      }
    });

    return cleaned;
  }

  getStats() {
    return {
      ...this.memoryStats,
      pendingRequests: Object.keys(global.pendingAPIRequests || {}).length,
      connectedUsers: connectedUsers,
      uniqueUsers: uniqueUsers.size,
      chatMessages: chatHistoryManager
        ? chatHistoryManager.getStats().totalMessages
        : 0,
      workerUsers: workerUsers.size,
    };
  }

  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    console.log("✅ Server memory manager cleaned up");
  }
}

// Initialize server memory management
const serverMemoryManager = new ServerMemoryManager();

// Add memory stats endpoint
app.get("/api/memory/stats", (req, res) => {
  const stats = serverMemoryManager.getStats();

  // Add process memory info if available
  if (process.memoryUsage) {
    const memUsage = process.memoryUsage();
    stats.process = {
      heapUsed: (memUsage.heapUsed / 1048576).toFixed(1) + "MB",
      heapTotal: (memUsage.heapTotal / 1048576).toFixed(1) + "MB",
      rss: (memUsage.rss / 1048576).toFixed(1) + "MB",
    };
  }

  res.json({
    success: true,
    memoryStats: stats,
    timestamp: new Date().toISOString(),
  });
});

// Git Pull Detection and Auto-Restart System
class GitPullDetector {
  constructor() {
    this.lastCommitHash = null;
    this.checkInterval = null;
    this.gitDir = path.join(__dirname, ".git");
  }

  async getCurrentCommit() {
    try {
      const { execSync } = require("child_process");
      const commitHash = execSync("git rev-parse HEAD", {
        cwd: __dirname,
        encoding: "utf8",
      }).trim();
      return commitHash;
    } catch (error) {
      console.error("❌ Failed to get current git commit:", error.message);
      return null;
    }
  }

  async startMonitoring() {
    // Get initial commit hash
    this.lastCommitHash = await this.getCurrentCommit();

    if (!this.lastCommitHash) {
      console.warn(
        "⚠️ Git pull detection disabled - not a git repository or git unavailable",
      );
      return;
    }

    console.log(
      `🔍 Git pull detection active - monitoring commit: ${this.lastCommitHash.substring(
        0,
        7,
      )}`,
    );

    // Check every 30 seconds for changes
    this.checkInterval = setInterval(async () => {
      await this.checkForChanges();
    }, 30000);
  }

  async checkForChanges() {
    const currentCommit = await this.getCurrentCommit();

    if (!currentCommit) {
      return; // Skip this check if git command failed
    }

    if (currentCommit !== this.lastCommitHash) {
      console.log("");
      console.log("═══════════════════════════════════════════════════════");
      console.log("🔄 GIT PULL DETECTED - Repository has been updated");
      console.log(`📌 Previous commit: ${this.lastCommitHash.substring(0, 7)}`);
      console.log(`📌 Current commit:  ${currentCommit.substring(0, 7)}`);
      console.log("🛑 Initiating graceful shutdown for restart...");
      console.log("═══════════════════════════════════════════════════════");
      console.log("");

      // Trigger graceful shutdown
      await this.gracefulShutdown();
    }
  }

  async gracefulShutdown() {
    // Stop monitoring
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Notify all connected clients
    io.emit("server-restart", {
      reason: "git-pull-detected",
      message:
        "Server is restarting due to code update. Please refresh your browser.",
      timestamp: new Date().toISOString(),
    });

    console.log("📢 Notified all connected clients of restart");

    // Wait 2 seconds for messages to be delivered
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Close server
    console.log("🔌 Closing server connections...");
    server.close(() => {
      console.log("✅ Server closed successfully");
    });

    // Cleanup workers
    console.log("🧹 Cleaning up workers...");
    if (lmWorker) {
      lmWorker.terminate();
    }
    if (kokoroWorker) {
      kokoroWorker.terminate();
    }

    // Cleanup memory manager
    serverMemoryManager.cleanup();

    console.log("✅ Graceful shutdown complete");
    console.log("💡 Restart the server with: npm run dev:server");

    // Exit with code 0 for clean restart
    process.exit(0);
  }

  cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// Initialize git pull detector
const gitPullDetector = new GitPullDetector();

// Cleanup on server shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Server shutting down (SIGTERM)...");
  gitPullDetector.cleanup();
  serverMemoryManager.cleanup();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Server shutting down (SIGINT)...");
  gitPullDetector.cleanup();
  serverMemoryManager.cleanup();
  process.exit(0);
});

// Start server
const PORT = ENV.SERVER.PORT;
server.listen(PORT, () => {
  console.log(`🚀 BambiSleep Chat server running on http://localhost:${PORT}`);
  console.log(
    `📁 Serving static files from: ${path.join(__dirname, "public")}`,
  );
  console.log(`🎯 Environment: ${ENV.NODE_ENV}`);
  console.log(`⚡ Vite Dev: http://localhost:${ENV.SERVER.VITE_PORT}`);
  console.log(`🧹 Memory management: Active`);

  // Start git pull monitoring after server is ready
  gitPullDetector.startMonitoring();
});
