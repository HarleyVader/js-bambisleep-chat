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

// Kokoro TTS
const kokoroUrl = ENV.KOKORO.URL;          // http://192.168.0.170:8880
const kokoroApi = ENV.KOKORO.API_URL;      // /v1/audio/speech endpoint
const kokoroConfigured = ENV.KOKORO.isConfigured; // true/false
const defaultVoice = ENV.KOKORO.DEFAULT_VOICE; // af_sky+af_bella
const availableVoices = ENV.KOKORO.AVAILABLE_VOICES; // Array of 12 voices

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

### KOKORO (TTS)
- `HOST` - Auto-selects based on NODE_ENV
- `PORT` - Kokoro server port (default: 8880)
- `URL` - Full URL (computed)
- `API_URL` - Full API endpoint URL (computed)
- `isConfigured` - Boolean indicating if properly configured
- `API_KEY` - Optional API key
- `DEFAULT_VOICE` - Default voice or combination (default: 'af_sky+af_bella')
- `TIMEOUT` - Request timeout in ms (default: 300000)
- `AVAILABLE_VOICES` - Array of all 12 female voices

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

const kokoroValidation = ENV.validation.validateKokoro();
console.log(kokoroValidation.configured); // true/false
console.log(kokoroValidation.missing);    // Array of missing vars

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
const kokoroHost = process.env.NODE_ENV === 'production'
    ? process.env.KOKORO_HOST_PRODUCTION
    : process.env.KOKORO_HOST_DEVELOPMENT;
const kokoroPort = process.env.KOKORO_PORT || 8880;
const kokoroUrl = `http://${kokoroHost}:${kokoroPort}`;
```

### New way:
```javascript
const ENV = require('./config/env');

const port = ENV.SERVER.PORT;
const kokoroUrl = ENV.KOKORO.URL;
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
// workers/kokoro.js
const ENV = require('../config/env');

class KokoroTTSWorker {
    constructor() {
        if (!ENV.KOKORO.isConfigured) {
            throw new Error('Kokoro not configured');
        }

        this.kokoroUrl = ENV.KOKORO.URL;
        this.defaultVoice = ENV.KOKORO.DEFAULT_VOICE;
        console.log('✅ Kokoro configured:', this.kokoroUrl);
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
