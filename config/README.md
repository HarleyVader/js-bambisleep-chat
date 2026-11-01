# Environment Configuration

Centralized environment configuration for BambiSleep Chat.

## Overview

The `config/env.js` module provides a standardized, type-safe way to access environment variables across the entire application. It eliminates scattered `process.env` calls and provides intelligent defaults.

## Usage

### Import the module

```javascript
const ENV = require('./config/env');
```

### Access configuration

```javascript
// Server configuration
const port = ENV.SERVER.PORT;              // 6969
const vitePort = ENV.SERVER.VITE_PORT;     // 5173
const isProduction = ENV.isProduction;     // true/false
const isDevelopment = ENV.isDevelopment;   // true/false

// LM Studio AI
const lmsUrl = ENV.LMS.URL;                // http://localhost:7777
const lmsConfigured = ENV.LMS.isConfigured; // true/false
const maxTokens = ENV.LMS.MAX_CONTEXT_TOKENS; // 6144

// OpenVoice V1 TTS
const openVoiceUrl = ENV.OPENVOICE.URL;          // http://204.12.253.35:8081
const openVoiceClone = ENV.OPENVOICE.CLONE_URL;  // /v1/audio/clone endpoint
const openVoiceConfigured = ENV.OPENVOICE.isConfigured; // true/false
const defaultVoice = ENV.OPENVOICE.DEFAULT_VOICE; // "bambi"
const referenceSample = ENV.OPENVOICE.REFERENCE_PATH; // public/bambi-reference.wav

// Chat settings
const maxMessageLength = ENV.CHAT.MAX_MESSAGE_LENGTH; // 500
const historyLimit = ENV.CHAT.HISTORY_LIMIT;          // 100

// Debug settings
const debugMode = ENV.DEBUG.MODE;          // true/false
const logLevel = ENV.DEBUG.LOG_LEVEL;      // 'info'
```

## Configuration Objects

### SERVER
- `PORT` - Main server port (default: 6969)
- `VITE_PORT` - Vite dev server port (default: 5173)
- `NODE_ENV` - Environment mode ('development'|'production'|'test')
- `isProduction` - Boolean flag for production mode
- `isDevelopment` - Boolean flag for development mode
- `isTest` - Boolean flag for test mode

### LMS (LM Studio)
- `HOST` - Auto-selects based on NODE_ENV
- `PORT` - LM Studio port (default: 7777)
- `URL` - Full URL (computed)
- `isConfigured` - Boolean indicating if properly configured
- `TARGET_MODEL_NAME` - Model to load
- `MAX_SEARCH_ATTEMPTS` - Model search attempts (default: 3)
- `MODEL_LOAD_TIMEOUT` - Timeout in ms (default: 30000)
- `API_CALL_TIMEOUT` - Timeout in ms (default: 120000)
- `REST_API_TIMEOUT` - Timeout in ms (default: 5000)
- `SESSION_TIMEOUT_MINUTES` - Session timeout (default: 15)
- `MAX_CONTEXT_TOKENS` - Context window size (default: 6144)
- `MAX_COMPLETION_TOKENS` - Max completion tokens (default: 2048)

### OPENVOICE (TTS)
- `HOST` - Auto-selects based on NODE_ENV (`OPENVOICE_HOST_PRODUCTION` / `OPENVOICE_HOST_DEVELOPMENT`)
- `PORT` - OpenVoice V1 server port (default: 8081)
- `URL` - Full URL (computed)
- `API_URL` - `/v1/audio/speech` endpoint URL (computed)
- `CLONE_URL` - `/v1/audio/clone` endpoint URL (computed); every TTS request is sent here
- `isConfigured` - Boolean indicating if properly configured
- `API_KEY` - Optional API key (`OPENVOICE_API_KEY`), sent as a Bearer token
- `HEALTH_PATH` - Health probe path used by `/api/services/status` (default: '/health')
- `DEFAULT_VOICE` - Name of the single default voice: 'bambi'
- `REFERENCE_PATH` - Reference sample cloned for the default voice (`OPENVOICE_REFERENCE_PATH`, default: `public/bambi-reference.wav`)
- `TIMEOUT` - Request timeout in ms (default: 300000)

### CHAT
- `MAX_MESSAGE_LENGTH` - Maximum message length (default: 500)
- `HISTORY_LIMIT` - Chat history limit (default: 100)

### DEBUG
- `MODE` - Debug mode enabled (default: false)
- `LOG_LEVEL` - Logging level (default: 'info')

### TEST
- `CI` - CI mode enabled (default: false)
- `SERVER_TIMEOUT` - Test server startup timeout (default: 10000)

### SECURITY
- `HTTPS_REDIRECT` - Force HTTPS (default: false)
- `SSL_CERT_PATH` - SSL certificate path
- `SSL_KEY_PATH` - SSL private key path
- `CORS_ORIGIN` - Array of allowed CORS origins

## Validation

The module includes built-in validation:

```javascript
// Validate individual services
const lmsValidation = ENV.validation.validateLMS();
console.log(lmsValidation.configured); // true/false
console.log(lmsValidation.missing);    // Array of missing vars

const openVoiceValidation = ENV.validation.validateOpenVoice();
console.log(openVoiceValidation.configured); // true/false
console.log(openVoiceValidation.missing);    // Array of missing vars

// Validate all services
const allValidation = ENV.validation.validateAll();
```

## Utilities

### Get Summary
```javascript
const summary = ENV.getSummary();
// Returns object with safe configuration summary (no sensitive data)
```

### Print Summary
```javascript
ENV.printSummary();
// Logs formatted configuration to console
```

## Environment Selection

The module automatically selects the correct host based on `NODE_ENV`:

- **Production**: Uses `*_HOST_PRODUCTION` variables
- **Development**: Uses `*_HOST_DEVELOPMENT` variables
- **Test**: Uses `*_HOST_DEVELOPMENT` variables

## Migration Guide

### Old way:
```javascript
const dotenv = require('dotenv');
dotenv.config();

const port = process.env.PORT || 6969;
const openVoiceHost = process.env.NODE_ENV === 'production'
    ? process.env.OPENVOICE_HOST_PRODUCTION
    : process.env.OPENVOICE_HOST_DEVELOPMENT;
const openVoicePort = process.env.OPENVOICE_PORT || 8081;
const openVoiceUrl = `http://${openVoiceHost}:${openVoicePort}`;
```

### New way:
```javascript
const ENV = require('./config/env');

const port = ENV.SERVER.PORT;
const openVoiceUrl = ENV.OPENVOICE.URL;
```

## Benefits

1. **Centralized** - Single source of truth for all configuration
2. **Type-safe** - Proper type conversion (strings to numbers, booleans)
3. **Computed values** - Automatic URL generation
4. **Validation** - Built-in configuration validation
5. **Environment-aware** - Automatically selects correct values
6. **Defaults** - Sensible defaults for all values
7. **Documentation** - Self-documenting configuration structure

## Example: Worker Thread

```javascript
// workers/openvoice.js
const ENV = require('../config/env');

class OpenVoiceTTSWorker {
    constructor() {
        if (!ENV.OPENVOICE.isConfigured) {
            throw new Error('OpenVoice not configured');
        }

        this.openVoiceUrl = ENV.OPENVOICE.URL;
        this.defaultVoice = ENV.OPENVOICE.DEFAULT_VOICE;
        console.log('✅ OpenVoice configured:', this.openVoiceUrl);
    }
}
```

## Example: Server

```javascript
// server.js
const ENV = require('./config/env');

// Print configuration on startup
ENV.printSummary();

// Use configuration
const PORT = ENV.SERVER.PORT;
server.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`⚡ Vite: http://localhost:${ENV.SERVER.VITE_PORT}`);
});
```

## Environment Variables Required

See `.env.example` for the complete list of environment variables.

### Minimal Configuration
- `NODE_ENV` (defaults to 'development')
- `PORT` (defaults to 6969)

### Full Configuration
All variables in `.env.example` for complete functionality.

## Notes

- The module loads `.env` files automatically via `dotenv`
- All timeouts are in milliseconds
- All computed properties (like `URL`, `API_URL`) are getters
- Boolean flags are computed from string environment variables
- Arrays (like `CORS_ORIGIN`) are automatically split from comma-separated strings
