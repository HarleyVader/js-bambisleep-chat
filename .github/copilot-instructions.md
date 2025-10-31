# GitHub Copilot Instructions - js-bambisleep-chat

## 📑 Table of Contents

- [🎯 Project Overview](#-project-overview)
- [🏗️ Architecture & Critical Patterns](#️-architecture--critical-patterns)
  - [Centralized Environment Configuration](#centralized-environment-configuration-srcconfigenvjs)
  - [Worker Thread Architecture](#worker-thread-architecture)
  - [Socket.io Event Patterns](#socketio-event-patterns)
  - [React + Vite Development Mode](#react--vite-development-mode)
- [🧪 Testing Philosophy](#-testing-philosophy---unified-test-framework-v30)
- [🚀 Development Workflows](#-development-workflows)
- [🎨 Frontend Architecture](#-frontend-architecture)
  - [React Component Structure](#react-component-structure-guidelines)
  - [Dropdown System](#dropdown-system---centralized-state-management)
  - [Animation System](#animation-system)
- [🔧 Key Implementation Details](#-key-implementation-details)
  - [Trigger System](#trigger-system---read-only-official-data)
  - [TTS System](#tts-system---kokoro-only-no-web-speech-api-fallback)
  - [Chat History Management](#chat-history-management-system)
  - [Session Management](#session-management-system)
  - [Git Pull Detection](#git-pull-detection-system)
- [🔌 Adding New Socket.io Events](#-adding-new-socketio-events)
- [🔧 Integrating New Worker Services](#-integrating-new-worker-services)
- [🤖 MCP Integration](#-mcp-model-context-protocol-integration)
- [📦 Configuration & Environment](#-configuration--environment)
- [🐛 Common Pitfalls & Solutions](#-common-pitfalls--solutions)
- [📚 Essential Files](#-essential-files-for-ai-understanding)
- [🎓 Learning Path](#-learning-path-for-new-ai-agents)
- [🔄 Recent Major Changes](#-recent-major-changes-v030)
- [📖 Quick Reference Guide](#-quick-reference-guide)

## 🎯 Project Overview

Modern real-time chat application with **Socket.io WebSockets**, **React frontend**, **Kokoro TTS**, **LM Studio AI**, psychedelic spiral animations, and trigger word detection. Features worker-based background processing and comprehensive unified testing framework.

**Stack**: Node.js 20+, Express 5, Socket.io 4.8, React 18, Vite 7, Worker Threads
**Ports**: Express server (7878), Vite dev server (5173)

## 🏗️ Architecture & Critical Patterns

### Centralized Environment Configuration (`src/config/env.js`)
**ALL environment variables MUST use the `ENV` module** - no direct `process.env` access in application code:

```javascript
const ENV = require('../config/env');

// ✅ CORRECT: Use centralized ENV object
const port = ENV.SERVER.PORT;           // Server config
const lmsUrl = ENV.LMS.URL;             // Auto-selects prod/dev host
const kokoroUrl = ENV.KOKORO.URL;       // Computed from host+port
const isProduction = ENV.SERVER.isProduction;

// ❌ WRONG: Never access process.env directly in app code
const port = process.env.PORT;  // Don't do this!
```

**Why**: Environment-aware host selection (production vs development), computed URLs, type safety, centralized validation.

### Worker Thread Architecture
Background services run in dedicated worker threads to prevent blocking:

```javascript
// server.js spawns workers
const kokoroWorker = new Worker('./src/workers/kokoro.js');
const lmsWorker = new Worker('./src/workers/lmstudio.js');

// Workers communicate via messages
kokoroWorker.postMessage({ type: 'tts', text: 'Hello', voice: 'af_sky' });
kokoroWorker.on('message', (msg) => {
    if (msg.type === 'tts-result') socket.emit('tts-audio', msg);
});
```

**Workers**:
- `kokoro.js` - Kokoro-FastAPI TTS (HTTP streaming, graceful fallback)
- `lmstudio.js` - LM Studio AI chat (session management, model loading, 15min timeout)
- `triggers.json` - Official BambiSleep trigger definitions (read-only)

### Socket.io Event Patterns
Real-time bidirectional communication follows consistent naming:

```javascript
// CLIENT -> SERVER events (kebab-case actions)
socket.emit('global-message', { username, text });
socket.emit('ai-chat', { message, sessionId });
socket.emit('tts-request', { text, voice });

// SERVER -> CLIENT events (kebab-case responses)
socket.emit('global-chat-history', messages);
socket.emit('ai-response', { response, sessionId });
socket.emit('tts-audio', { audioData, format: 'mp3' });
socket.emit('tts-error', { error: 'Service unavailable' });
```

**State synchronization**: Server sends `connection-ack` on connect with server state (user count, trigger stats).

### React + Vite Development Mode
Dual-server setup with intelligent proxying:

```bash
npm run dev  # Starts both servers concurrently
# Vite: localhost:5173 (hot reload, React Fast Refresh)
# Express: localhost:7878 (API, Socket.io, static assets)
```

**Vite proxies** `/api/*` and `/socket.io/*` to Express (see `vite.config.js`). Frontend lives in `src/client/`, built to `dist/` for production.

## 🧪 Testing Philosophy - Unified Test Framework v3.0

Custom test runner (`tests/unified-test-runner.js`) with **zero external dependencies**. All tests follow the suite class pattern:

```javascript
class MyTestSuite {
    constructor() {
        this.name = 'Feature Name';
        this.tags = ['critical', 'architecture'];  // For filtering
        this.priority = 90;  // Higher = runs first
    }
    
    async run() {
        const results = { passed: 0, failed: 0, tests: [] };
        // Test logic with file system checks, regex validations
        return results;
    }
}
```

**Critical test commands**:
```bash
npm test                  # All tests (~30-60 sec)
npm run test:critical     # Tagged critical only (6-8 tests, ~5 sec)
npm run test:ci           # CI mode with HTML reports
npm run test:watch        # Watch mode for development
```

**Test categories** (see `tests/` directory):
- `architecture-v2.test.js` - Dropdown architecture, CSS layers, centralized state
- `environment-v2.test.js` - ENV module validation, host selection logic  
- `stability-v2.test.js` - Race conditions, memory leaks, error handling
- `performance-benchmark.test.js` - Response times, concurrent connections

## 🚀 Development Workflows

### Rapid Development Cycle
```bash
npm run dev               # Start dev servers (Vite + Express)
# Edit code → Vite hot reload → Manual browser testing
```

### Pre-Deployment Validation
```bash
npm run build             # Full build: Vite + server packaging + validation
npm run build:fast        # Skips tests for rapid iteration
```

### Production Deployment
```bash
node scripts/deploy.js install    # Install systemd service
node scripts/deploy.js restart    # Restart service
node scripts/deploy.js logs       # View logs
```

**Service file**: `bambisleepchat.service` (systemd unit, port 7878, production ENV).

## 🎨 Frontend Architecture

### React Component Structure Guidelines

**Component Organization Pattern**:
```jsx
// src/client/components/ChatMessage.jsx
import React, { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import styles from '../styles/ChatMessage.module.css';

const ChatMessage = ({ message, username, timestamp, isTrigger }) => {
    // 1. Hooks first
    const [isAnimating, setIsAnimating] = useState(false);
    const socket = useSocket();
    
    // 2. Effects
    useEffect(() => {
        if (isTrigger) {
            setIsAnimating(true);
            const timer = setTimeout(() => setIsAnimating(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isTrigger]);
    
    // 3. Event handlers
    const handleClick = () => {
        socket.emit('message-interaction', { messageId: message.id });
    };
    
    // 4. Render
    return (
        <div className={`${styles.message} ${isAnimating ? styles.trigger : ''}`}>
            <span className={styles.username}>{username}</span>
            <span className={styles.text}>{message}</span>
            <time className={styles.timestamp}>{timestamp}</time>
        </div>
    );
};

export default ChatMessage;
```

### Dropdown System - Centralized State Management
**DO NOT** add click handlers to individual dropdown components. All dropdown state is managed by `DropdownManager`:

```javascript
// ✅ CORRECT: Register dropdown in manager
dropdownManager.register('myDropdown', element, {
    closeOnClickOutside: true,
    animations: 'slide-fade'
});

// ❌ WRONG: Separate click handlers cause race conditions
button.addEventListener('click', () => dropdown.toggle());  // Don't do this!
```

**CSS Architecture**: Uses CSS `@layer` system for style precedence:
1. `base` - Resets and defaults
2. `components` - Component styles
3. `utilities` - Utility classes
4. `overrides` - High-priority overrides

### Animation System
Psychedelic spiral animations use `p5.js` (creative coding library). Located in `src/client/components/` or legacy `public/js/psychodelic-trigger-mania.js`.

## 🔧 Key Implementation Details

### Trigger System - Read-Only Official Data
**Trigger modifications are DISABLED**. Only official BambiSleep triggers from `src/workers/triggers.json`:

```javascript
// ✅ Access via API
fetch('/api/triggers/json');                        // All triggers
fetch('/api/triggers/category/primary');            // Category filter
fetch('/api/triggers/details/Sleep');               // Specific trigger

// ❌ POST endpoints are disabled
// POST /api/triggers → 501 Not Implemented
```

### TTS System - Kokoro-Only (No Web Speech API Fallback)
**Breaking change in v0.3.0**: Removed Web Speech API fallback (~300 lines). Only Kokoro-FastAPI backend:

```javascript
// Message format standardized to { display, tts }
const message = {
    display: "Hello <b>world</b>!",  // HTML allowed
    tts: "Hello world!"               // Plain text for TTS
};

// Worker handles streaming and errors
kokoroWorker.postMessage({ type: 'tts', text: message.tts, voice });
```

**Fallback behavior**: If Kokoro unavailable, `fallbackMode = true` (no TTS, logs warning).

### Git Pull Detection System
Server **auto-detects deployments** by monitoring git commit hash every 30 seconds:

```javascript
// server.js polls git hash
setInterval(() => {
    const newHash = execSync('git rev-parse HEAD').toString().trim();
    if (newHash !== currentHash) {
        io.emit('server-restarting', { reason: 'deployment' });
        gracefulShutdown();  // Cleanup workers, close connections
    }
}, 30000);
```

**Why**: Prevents stale server instances after `git pull` deployments.

## 🔌 Adding New Socket.io Events

### Server-Side Event Handler Pattern
```javascript
// src/server/server.js - Add new events in connection handler
io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);
    
    // ✅ CORRECT: New custom event handler
    socket.on('custom-action', async (data) => {
        try {
            // 1. Validate input
            if (!data || !data.requiredField) {
                socket.emit('custom-error', { 
                    error: 'Missing required field',
                    code: 'INVALID_INPUT'
                });
                return;
            }
            
            // 2. Process action
            const result = await performCustomAction(data);
            
            // 3. Emit response
            socket.emit('custom-response', {
                success: true,
                data: result,
                timestamp: new Date().toISOString()
            });
            
            // 4. Broadcast to all clients (optional)
            io.emit('custom-broadcast', {
                userId: socket.id,
                action: 'custom-action',
                result: result
            });
            
        } catch (error) {
            console.error('Custom action error:', error);
            socket.emit('custom-error', {
                error: error.message,
                code: 'INTERNAL_ERROR'
            });
        }
    });
});
```

### Event Naming Conventions
- **Client to Server**: `action-name` (e.g., `global-message`, `ai-chat`, `tts-request`)
- **Server to Client**: `action-response` or `action-error` (e.g., `ai-response`, `tts-error`)
- **Broadcasts**: `event-broadcast` (e.g., `user-joined`, `trigger-detected`)

## 🔧 Integrating New Worker Services

### Creating a New Worker
```javascript
// src/workers/my-service.js
const { parentPort } = require('worker_threads');
const ENV = require('../config/env');

class MyServiceWorker {
    constructor() {
        this.isHealthy = false;
        this.config = this.loadConfiguration();
        this.init();
    }
    
    loadConfiguration() {
        // Load from ENV module
        if (!ENV.MY_SERVICE?.isConfigured) {
            console.warn('⚠️ My Service not configured, running in fallback mode');
            return { fallbackMode: true };
        }
        
        return {
            url: ENV.MY_SERVICE.URL,
            apiKey: ENV.MY_SERVICE.API_KEY,
            timeout: ENV.MY_SERVICE.TIMEOUT || 30000,
            fallbackMode: false
        };
    }
    
    async init() {
        console.log('🚀 My Service Worker initializing...');
        
        if (!this.config.fallbackMode) {
            await this.healthCheck();
        }
        
        if (parentPort) {
            parentPort.on('message', this.handleMessage.bind(this));
        }
    }
    
    async handleMessage(msg) {
        try {
            switch (msg.type) {
                case 'process-request':
                    await this.processRequest(msg);
                    break;
                    
                case 'health-check':
                    await this.healthCheck();
                    parentPort.postMessage({
                        type: 'health-status',
                        isHealthy: this.isHealthy
                    });
                    break;
                    
                default:
                    console.warn('⚠️ Unknown message type:', msg.type);
            }
        } catch (error) {
            console.error('❌ Worker error:', error);
            parentPort.postMessage({
                type: 'error',
                error: error.message,
                originalMessage: msg
            });
        }
    }
}

// Initialize worker
const worker = new MyServiceWorker();
```

## 🤖 MCP (Model Context Protocol) Integration

### Available MCP Tools
The project has active MCP integrations (see `MCP-SETUP.md`):

**Active Services**:
- **Hugging Face** (`mcp_hf-mcp-server_*`) - ML models, datasets, image generation
- **Stripe** (`mcp_stripe_agent-_*`) - Payment processing, subscriptions
- **Microsoft Clarity** (`mcp_microsoft_cla_*`) - Web analytics, session recordings
- **MongoDB** (`mcp_mongodb_*`) - Database operations (requires Atlas Local)

## 📦 Configuration & Environment

### Environment Variables (see `.env.example`)
```env
# Server
PORT=7878
NODE_ENV=development|production

# LM Studio (auto-selects host by environment)
LMS_HOST_PRODUCTION=192.168.0.100
LMS_HOST_DEVELOPMENT=localhost
LMS_PORT=7777
TARGET_MODEL_NAME=l3-sthenomaidblackroot-8b-v1@q4_k_s

# Kokoro TTS (auto-selects host by environment)
KOKORO_HOST_PRODUCTION=192.168.0.100
KOKORO_HOST_DEVELOPMENT=localhost
KOKORO_PORT=8880
KOKORO_DEFAULT_VOICE=af_sky+af_bella

# Application
MAX_MESSAGE_LENGTH=500
CHAT_HISTORY_LIMIT=100
DEBUG_MODE=true
```

**Host selection**: Production uses LAN IPs (e.g., `192.168.0.100`), development uses `localhost`. Handled automatically by `ENV` module.

## 🐛 Common Pitfalls & Solutions

1. **❌ Dropdown closes immediately after opening**
   - **Cause**: Multiple click handlers racing
   - **Fix**: Use centralized `DropdownManager`, never add separate click handlers

2. **❌ Worker communication failing**
   - **Cause**: Incorrect message format or missing handlers
   - **Fix**: Always check `msg.type` and handle errors: `if (msg.type === 'error') log(msg.error)`

3. **❌ Tests passing locally, failing in CI**
   - **Cause**: Environment differences or race conditions
   - **Fix**: Use `TEST_VERBOSE=true npm run test:ci` for detailed output, check for hardcoded paths

4. **❌ Vite proxy not forwarding requests**
   - **Cause**: Express server not running or port mismatch
   - **Fix**: Run `npm run dev` (starts both servers), check `vite.config.js` proxy target matches Express port

5. **❌ Environment variables not loading**
   - **Cause**: Accessing `process.env` instead of `ENV` module
   - **Fix**: Always use `const ENV = require('../config/env')` and access via `ENV.SERVER.PORT`, etc.

## 📚 Essential Files for AI Understanding

### Core Server Architecture
- `src/server/server.js` - Main Express + Socket.io server
- `src/config/env.js` - Centralized environment configuration
- `src/workers/kokoro.js` - Kokoro TTS worker
- `src/workers/lmstudio.js` - LM Studio AI worker
- `src/workers/triggers.json` - Official BambiSleep trigger definitions

### Frontend Architecture
- `src/client/main.jsx` - React app entry point
- `src/client/App.jsx` - Root component with routing
- `src/client/components/` - Reusable React components
- `src/client/hooks/` - Custom hooks (useSocket, useChatHistory, useAISession)
- `src/client/context/` - Context providers (ChatContext, ThemeContext)

### Testing Framework
- `tests/unified-test-runner.js` - Custom test runner
- `tests/unified-test-framework.js` - Test framework core
- `tests/architecture-v2.test.js` - Architecture validation
- `tests/environment-v2.test.js` - ENV module tests
- `tests/stability-v2.test.js` - Race conditions, memory leaks
- `tests/performance-benchmark.test.js` - Response times, concurrent connections

### Build & Deployment
- `scripts/build.js` - Production build orchestration
- `scripts/deploy.js` - Systemd service management
- `scripts/clean.js` - Cleanup artifacts and caches
- `vite.config.js` - Frontend build and dev server proxy
- `package.json` - Dependencies and npm scripts
- `bambisleepchat.service` - Systemd service configuration

### Documentation
- `README.md` - Project overview and quick start
- `WORKFLOWS.md` - Comprehensive workflow documentation
- `BUILD.md` - Build system details and troubleshooting
- `CHANGELOG.md` - Version history and breaking changes
- `MCP-SETUP.md` - MCP tool configuration and usage

## 🎓 Learning Path for New AI Agents

1. **Start with `README.md`** - Understand project purpose and basic architecture
2. **Read `src/config/env.js`** - Learn centralized configuration pattern
3. **Study `src/server/server.js`** (lines 1-200) - See server initialization and worker setup
4. **Examine worker files** - Understand background service patterns
5. **Review test files** - See validation patterns and quality standards
6. **Check `WORKFLOWS.md`** - Learn development workflows
7. **Read this file** - Reference for specific implementation patterns

## 🔄 Recent Major Changes (v0.3.0)

- **Removed Web Speech API fallback** - Kokoro-only TTS system
- **Git pull detection** - Auto-restart on deployments
- **Dropdown race condition fix** - Centralized state management
- **Console log cleanup** - 350+ lines removed, cleaner output
- **File structure consolidation** - Merged `dropdown-utils.js` into `dropdowns.js`

## 📖 Quick Reference Guide

### Most Common Tasks

**Starting Development**:
```bash
npm run dev               # Start dev servers
```

**Adding New Socket.io Event**:
1. Add handler in `src/server/server.js` inside `io.on('connection', ...)`
2. Create custom hook in `src/client/hooks/useYourEvent.js`
3. Use kebab-case naming: `action-name`, `action-response`, `action-error`

**Creating New Worker Service**:
1. Create `src/workers/your-service.js` with Worker class pattern
2. Add configuration to `src/config/env.js` with `YOUR_SERVICE` object
3. Initialize in `src/server/server.js` with `new Worker()`
4. Handle messages with `worker.on('message', ...)`

**Adding Environment Variable**:
1. Add to `.env.example` with description
2. Add to `src/config/env.js` in appropriate section (SERVER, LMS, KOKORO, etc.)
3. Use computed properties for URLs: `get URL() { return ... }`
4. Never access `process.env` directly in app code

**Running Tests**:
```bash
npm run test:critical            # Fast critical tests only (5-8 sec)
npm test                         # All tests (30-60 sec)
npm run test:watch              # Watch mode for development
```

**Building for Production**:
```bash
npm run build                    # Full build with validation
npm run build:fast               # Quick build (skips tests)
```

### Code Pattern Quick Lookup

**Import ENV Module** (Required everywhere):
```javascript
const ENV = require('../config/env');  // Server-side
```

**Socket.io Event Pattern**:
```javascript
// Server: src/server/server.js
socket.on('event-name', (data) => { /* validate, process, emit */ });
socket.emit('event-response', { success: true, data });

// Client: src/client/hooks/useEvent.js
socket.emit('event-name', data);
socket.on('event-response', (data) => { /* handle */ });
```

**Worker Message Pattern**:
```javascript
// Server: src/server/server.js
worker.postMessage({ type: 'action', data });
worker.on('message', (msg) => { /* handle msg.type */ });

// Worker: src/workers/worker.js
parentPort.on('message', (msg) => { /* handle msg.type */ });
parentPort.postMessage({ type: 'result', data });
```

**React Component Pattern**:
```jsx
// 1. Hooks → 2. Effects → 3. Handlers → 4. Render
const Component = ({ prop }) => {
    const [state, setState] = useState();        // 1. Hooks
    useEffect(() => { /* side effects */ }, []); // 2. Effects
    const handleClick = () => { /* logic */ };   // 3. Handlers
    return <div>...</div>;                       // 4. Render
};
```

**Test Suite Pattern**:
```javascript
class MyTestSuite {
    constructor() {
        this.name = 'Suite Name';
        this.tags = ['critical', 'feature'];
        this.priority = 90;
    }
    async run() {
        return { passed: 0, failed: 0, tests: [] };
    }
}
```

### File Locations Cheat Sheet

| Need to... | Edit File |
|------------|-----------|
| Add Socket.io event | `src/server/server.js` (connection handler) |
| Add environment variable | `src/config/env.js` + `.env.example` |
| Create new worker | `src/workers/your-service.js` |
| Add React component | `src/client/components/YourComponent.jsx` |
| Create custom hook | `src/client/hooks/useYourHook.js` |
| Add test suite | `tests/your-feature.test.js` |
| Modify build process | `scripts/build.js` |
| Change proxy settings | `vite.config.js` |
| Update workflow | `package.json` (scripts section) |
| Add API endpoint | `src/server/server.js` (Express routes) |

---

**Key Principle**: This codebase prioritizes **real-time performance**, **graceful degradation**, and **comprehensive validation**. When in doubt, check existing patterns in tests and centralized configuration modules.
