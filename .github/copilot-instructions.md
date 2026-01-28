# GitHub Copilot Instructions

**BambiSleep Chat**: Real-time chat with TTS, psychedelic visuals, and BambiSleep trigger detection.

## Architecture Overview

```
┌─────────────────┐    Socket.io    ┌──────────────────┐
│  Browser Client │◄──────────────►│    server.js     │
│  (aigf-core.js) │                 │  Express+Socket  │
└─────────────────┘                 └────────┬─────────┘
                                             │ Worker Threads (persistent)
                              ┌──────────────┼──────────────┐
                              ▼              ▼              ▼
                       ┌──────────┐   ┌──────────┐   ┌──────────┐
                       │ kokoro.js│   │lmstudio.js│   │triggers  │
                       │   (TTS)  │   │   (AI)   │   │  .json   │
                       └────┬─────┘   └────┬─────┘   └──────────┘
                            │              │
                            ▼              ▼
                       Kokoro-FastAPI  LM Studio (local)
```

**Stack**: Express + Socket.io + Worker threads | Vanilla ES6 modules (NO frameworks)  
**Message Flow**: Client → Server → Worker (via postMessage) → Server → Client (never Worker→Client direct)

## Quick Reference

```bash
npm start      # Production server (port 6969)
npm run dev    # Development mode (uses nodemon for auto-restart)
npm test       # Test suite → HTML/JSON reports in tests/reports/
npm run clean  # Clean generated files/caches
```

| File                                                     | Purpose                                            |
| -------------------------------------------------------- | -------------------------------------------------- |
| [server.js](server.js)                                   | Express server, Socket.io, worker orchestration    |
| [config/env.js](config/env.js)                           | **Single source** for all environment config       |
| [public/js/aigf-core.js](public/js/aigf-core.js)         | Main chat client (ChatCore class)                  |
| [workers/triggers.json](workers/triggers.json)           | **Authoritative** trigger definitions              |
| [workers/kokoro.js](workers/kokoro.js)                   | TTS worker (HTTP keep-alive, caching, batching)    |
| [workers/lmstudio.js](workers/lmstudio.js)               | AI chat worker (@lmstudio/sdk)                     |
| [public/js/dropdowns/](public/js/dropdowns/)             | Modular UI components (ES6 class/function exports) |
| [public/js/error-manager.js](public/js/error-manager.js) | Client-side error handling with retry logic        |
| [public/css/layers.css](public/css/layers.css)           | CSS @layer definitions (stacking context)          |
| [public/css/variables.css](public/css/variables.css)     | CSS custom properties (design tokens)              |

## Critical Patterns

### 1. Environment Config (MUST use `config/env.js`)

All environment variables go through `config/env.js` - it provides validation, computed properties, and auto-switches dev/prod.

```javascript
// ✅ Always use centralized config
const ENV = require("./config/env");
const url = ENV.KOKORO.URL; // Auto-switches dev/prod
const ready = ENV.LMS.isConfigured; // Computed property
const port = ENV.SERVER.PORT; // Default: 6969

// ❌ Never access process.env directly outside config/env.js
process.env.KOKORO_HOST_DEVELOPMENT; // Bypasses validation & computed logic
```

**ENV sections**: `SERVER`, `LMS`, `KOKORO`, `APPLICATION` (see [config/env.js](config/env.js:1-284))

### 2. Trigger System (Single Source of Truth)

Triggers live in `workers/triggers.json`, served at `/api/triggers/json`. **Never hardcode trigger names.**

```javascript
// ✅ Load from API
const response = await fetch("/api/triggers/json");
const { triggers } = await response.json();
// Each trigger: { id, name, category, safetyLevel, description, effect }

// Example categories: "Primary", "Mental", "Physical", "Behavioral"
// Server loads triggers on startup via loadOfficialTriggers()

// ❌ Hardcoded triggers get out of sync
const triggers = ["BAMBI", "GOOD GIRL"]; // Fragile and incomplete
```

**Server pattern**: `loadOfficialTriggers()` in [server.js](server.js:565-602) loads JSON and broadcasts to workers via `postMessage({ type: 'triggers' })`

### 3. Socket.io Message Flow

Server **always** mediates between clients and workers. Workers never access sockets directly.

```javascript
// Client → Server → Worker → Server → Client
socket.emit("ai-chat", { message: "Hello" });
// Server forwards to lmWorker via postMessage()
// Worker responds via parentPort.postMessage()
// Server emits 'ai-response' back to client

// Workers are PERSISTENT (created once in server.js, not per-request)
```

**Key events**: `ai-chat`/`ai-response`, `tts-request`/`tts-response`, `activate-collar`, `chat-message`/`receive-message`  
**Worker init**: [server.js](server.js:606-657) creates workers once, handles `message`/`error`/`exit` events

### 4. Worker Communication Pattern

Workers are persistent (created once in server.js). Always include `socketId` for routing responses.

```javascript
// Server → Worker (in server.js)
lmWorker.postMessage({
  type: "chat",
  prompt: text,
  socketId: socket.id, // Essential for routing response back
});

// Worker → Server (in worker file)
parentPort.postMessage({
  type: "ai_response",
  response: text,
  socketId, // Server uses this to emit to correct client
});

// Server broadcasts triggers to all workers on startup
lmWorker.postMessage({
  type: "triggers",
  triggers: triggerWords, // Array of trigger names
  triggerData: triggerData, // Full trigger objects
});
```

**Worker lifecycle**: Workers auto-restart on crash (see [server.js](server.js:630-657))

### 5. Dropdown Component System

New UI controls go in `public/js/dropdowns/`. Export from `index.js`.

```javascript
// 1. Create my-dropdown.js with named export
export function MyDropdown() {
  /* returns DOM element */
}
// OR use class export
export class MyDropdown {
  constructor() {
    /* ... */
  }
}

// 2. Add to public/js/dropdowns/index.js
export { MyDropdown } from "./my-dropdown.js";

// 3. Import in aigf-core.js
import { MyDropdown } from "./dropdowns/index.js";
```

**Existing dropdowns**: TTSDropdown, TriggersDropdown, SpiralDropdown, CollarDropdown (classes), ButtplugDropdown, createBrainwaveDropdown (functions)

### 6. CSS Architecture (@layer system)

Use CSS custom properties from `public/css/variables.css`. Place new styles in appropriate layer.

```css
@layer interface {
  .my-component {
    background: var(--primary-color); /* Teal */
    color: var(--button-color); /* Hot pink */
    padding: var(--spacing-md); /* 12px */
    border: var(--border); /* 3px ridge */
  }
}
```

**Layer order**: `base` → `background` → `interface` → `dropdowns` → `modals` → `overlays` → `debug`  
**Never use z-index** - layers handle stacking automatically

## Common Tasks

**Add new trigger**: Edit `workers/triggers.json`, include `id`, `name`, `category`, `description`, `effect`

**Add environment variable**:

1. Define in `config/env.js` with appropriate section (SERVER/LMS/KOKORO/APPLICATION)
2. Access via `ENV.SECTION.VARIABLE`

**Debug service issues**: Check `ENV.SERVICE.isConfigured` and server console for emoji indicators:

- ✅ success | ⚠️ warning | ❌ error | 🎤 TTS | 🤖 AI

## Conventions

- **Vanilla JS only** — no React/Vue. Use DOM APIs directly.
- **Workers for external APIs** — Kokoro TTS and LM Studio calls stay in workers
- **ChatHistoryManager** (server.js) handles all message storage with `aigf`, `legacy` types
- **ErrorManager** (public/js/error-manager.js) for client-side error handling with retry

## External Services

| Service            | Purpose                                 | Config Section |
| ------------------ | --------------------------------------- | -------------- |
| **Kokoro-FastAPI** | TTS (12 female voices, supports mixing) | `ENV.KOKORO`   |
| **LM Studio**      | Local AI chat (@lmstudio/sdk)           | `ENV.LMS`      |
