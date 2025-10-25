/**
 * Centralized Environment Configuration for BambiSleep Chat
 * Standardizes environment variable access across the entire codebase
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

/**
 * Environment Mode Detection
 */
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isDevelopment = NODE_ENV === 'development';
const isTest = NODE_ENV === 'test';

/**
 * Server Configuration
 */
const SERVER = {
    PORT: parseInt(process.env.PORT) || 7878,
    VITE_PORT: parseInt(process.env.VITE_PORT) || 5173,
    HOST: process.env.SERVER_HOST || 'localhost',
    NODE_ENV,
    isProduction,
    isDevelopment,
    isTest,

    // Computed URLs
    get URL() {
        return `http://${this.HOST}:${this.PORT}`;
    },

    get VITE_URL() {
        return `http://${this.HOST}:${this.VITE_PORT}`;
    }
};

/**
 * LM Studio AI Configuration
 * Automatically selects host based on environment
 */
const LMS = {
    HOST: isProduction
        ? process.env.LMS_HOST_PRODUCTION
        : process.env.LMS_HOST_DEVELOPMENT,
    PORT: parseInt(process.env.LMS_PORT) || 7777,

    // Model Configuration
    TARGET_MODEL_NAME: process.env.TARGET_MODEL_NAME || 'l3-sthenomaidblackroot-8b-v1@q4_k_s',
    MAX_SEARCH_ATTEMPTS: parseInt(process.env.MAX_SEARCH_ATTEMPTS) || 3,

    // Timeouts (milliseconds)
    MODEL_LOAD_TIMEOUT: parseInt(process.env.LMS_MODEL_LOAD_TIMEOUT) || 30000,
    API_CALL_TIMEOUT: parseInt(process.env.LMS_API_CALL_TIMEOUT) || 120000,
    REST_API_TIMEOUT: parseInt(process.env.LMS_REST_API_TIMEOUT) || 5000,
    SESSION_TIMEOUT_MINUTES: parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 15,

    // Context Window
    MAX_CONTEXT_TOKENS: parseInt(process.env.MAX_CONTEXT_TOKENS) || 6144,
    MAX_COMPLETION_TOKENS: parseInt(process.env.MAX_COMPLETION_TOKENS) || 2048,

    // Derived values
    get URL() {
        return this.HOST ? `http://${this.HOST}:${this.PORT}` : null;
    },

    get isConfigured() {
        return !!(this.HOST && this.PORT);
    }
};

/**
 * Kokoro TTS Configuration
 * Automatically selects host based on environment
 */
const KOKORO = {
    HOST: isProduction
        ? process.env.KOKORO_HOST_PRODUCTION
        : process.env.KOKORO_HOST_DEVELOPMENT,
    PORT: parseInt(process.env.KOKORO_PORT) || 8880,

    API_KEY: process.env.KOKORO_API_KEY || '',
    DEFAULT_VOICE: process.env.KOKORO_DEFAULT_VOICE || 'af_sky+af_bella',
    TIMEOUT: parseInt(process.env.TTS_TIMEOUT) || 300000,

    // All available female voices (Kokoro-FastAPI official)
    AVAILABLE_VOICES: [
        'af_alloy', 'af_aoede', 'af_bella', 'af_heart',
        'af_jadzia', 'af_jessica', 'af_kore', 'af_nicole',
        'af_nova', 'af_river', 'af_sarah', 'af_sky'
    ],

    // Derived values
    get URL() {
        return this.HOST ? `http://${this.HOST}:${this.PORT}` : null;
    },

    get API_URL() {
        return this.URL ? `${this.URL}/v1/audio/speech` : null;
    },

    get isConfigured() {
        return !!(this.HOST && this.PORT);
    }
};

/**
 * Chat Configuration
 */
const CHAT = {
    MAX_MESSAGE_LENGTH: parseInt(process.env.MAX_MESSAGE_LENGTH) || 500,
    HISTORY_LIMIT: parseInt(process.env.CHAT_HISTORY_LIMIT) || 100
};

/**
 * Debug & Logging Configuration
 */
const DEBUG = {
    MODE: process.env.DEBUG_MODE === 'true',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

/**
 * Testing Configuration
 */
const TEST = {
    CI: process.env.CI === 'true',
    SERVER_TIMEOUT: parseInt(process.env.TEST_SERVER_TIMEOUT) || 10000
};

/**
 * Security Configuration
 */
const SECURITY = {
    HTTPS_REDIRECT: process.env.HTTPS_REDIRECT === 'true',
    SSL_CERT_PATH: process.env.SSL_CERT_PATH || '',
    SSL_KEY_PATH: process.env.SSL_KEY_PATH || '',
    CORS_ORIGIN: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
        : [`http://${SERVER.HOST}:${SERVER.VITE_PORT}`, `http://${SERVER.HOST}:${SERVER.PORT}`]
};

/**
 * External Services & URLs
 * Official documentation and resource URLs
 */
const EXTERNAL = {
    BAMBISLEEP_WIKI: 'https://bambisleep.info',
    BAMBISLEEP_TRIGGERS: 'https://bambisleep.info/Triggers',
    KOKORO_DOCS: 'https://github.com/remsky/Kokoro-FastAPI',
    SOCKETIO_CDN: 'https://cdn.socket.io/4.7.5/socket.io.min.js',
    MARKDOWN_CDN: 'https://cdn.jsdelivr.net/npm/markdown-it@13.0.1/dist/markdown-it.min.js'
};

/**
 * Validation Helper
 * Checks if required services are properly configured
 */
const validation = {
    validateLMS() {
        const missing = [];
        if (!LMS.HOST) missing.push('LMS_HOST_' + (isProduction ? 'PRODUCTION' : 'DEVELOPMENT'));
        if (!LMS.PORT) missing.push('LMS_PORT');

        return {
            valid: missing.length === 0,
            missing,
            configured: LMS.isConfigured
        };
    },

    validateKokoro() {
        const missing = [];
        if (!KOKORO.HOST) missing.push('KOKORO_HOST_' + (isProduction ? 'PRODUCTION' : 'DEVELOPMENT'));
        if (!KOKORO.PORT) missing.push('KOKORO_PORT');

        return {
            valid: missing.length === 0,
            missing,
            configured: KOKORO.isConfigured
        };
    },

    validateAll() {
        return {
            lms: this.validateLMS(),
            kokoro: this.validateKokoro(),
            server: {
                valid: true,
                configured: true
            }
        };
    }
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
            vitePort: SERVER.VITE_PORT
        },
        services: {
            lms: {
                configured: LMS.isConfigured,
                url: LMS.URL || 'not-configured'
            },
            kokoro: {
                configured: KOKORO.isConfigured,
                url: KOKORO.URL || 'not-configured',
                defaultVoice: KOKORO.DEFAULT_VOICE
            }
        },
        debug: DEBUG.MODE,
        test: TEST.CI
    };
}

/**
 * Print Configuration Summary
 * Logs configuration to console in a readable format
 */
function printSummary() {
    console.log('\n🔧 BambiSleep Chat Configuration');
    console.log('═'.repeat(50));
    console.log(`📍 Environment: ${NODE_ENV.toUpperCase()}`);
    console.log(`🌐 Server Port: ${SERVER.PORT}`);
    console.log(`⚡ Vite Port: ${SERVER.VITE_PORT}`);
    console.log('\n🤖 Services:');
    console.log(`   LM Studio: ${LMS.isConfigured ? '✅ ' + LMS.URL : '❌ Not Configured'}`);
    console.log(`   Kokoro TTS: ${KOKORO.isConfigured ? '✅ ' + KOKORO.URL : '❌ Not Configured'}`);
    console.log(`   Default Voice: ${KOKORO.DEFAULT_VOICE}`);
    console.log('\n📊 Limits:');
    console.log(`   Max Message Length: ${CHAT.MAX_MESSAGE_LENGTH}`);
    console.log(`   Chat History: ${CHAT.HISTORY_LIMIT}`);
    console.log(`   LMS Timeout: ${LMS.API_CALL_TIMEOUT}ms`);
    console.log(`   TTS Timeout: ${KOKORO.TIMEOUT}ms`);
    console.log('\n🔍 Debug Mode: ' + (DEBUG.MODE ? '✅ ON' : '❌ OFF'));
    console.log('═'.repeat(50) + '\n');
}

// Export all configuration
module.exports = {
    // Main config objects
    SERVER,
    LMS,
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
    VITE_PORT: SERVER.VITE_PORT,
    SERVER_HOST: SERVER.HOST,

    // Kokoro legacy
    KOKORO_API_URL: KOKORO.URL,
    KOKORO_API_KEY: KOKORO.API_KEY,
    KOKORO_DEFAULT_VOICE: KOKORO.DEFAULT_VOICE,
    TTS_TIMEOUT: KOKORO.TIMEOUT
};
