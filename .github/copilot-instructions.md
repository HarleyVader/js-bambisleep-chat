# GitHub Copilot Instructions

**BambiSleep Chat**: Real-time chat with TTS, psychedelic visuals, and BambiSleep trigger detection.

## Architecture Overview

```
┌─────────────────┐    Socket.io    ┌──────────────────┐
│  Browser Client │◄──────────────►│    server.js     │
│  (aigf-core.js) │                 │  Express+Socket  │
└─────────────────┘                 └────────┬─────────┘
                                             │ Worker Threads
                              ┌──────────────┼──────────────┐
                              ▼              ▼              ▼
                       ┌────────────┐ ┌──────────┐   ┌──────────┐
                       │tts-express │ │lmstudio.js│   │triggers  │
                       │   (TTS)    │ │   (AI)   │   │  .json   │
                       └────┬───────┘ └────┬─────┘   └──────────┘
                            │              │
                            ▼              ▼
                       TTS Express    LM Studio (local)
```

**Stack**: Express + Socket.io + Worker threads | Vanilla ES6 modules (NO frameworks)

## Quick Reference

```bash
npm start    # Production server (port 6969)
npm run dev  # Development with nodemon
npm test     # Test suite → reports in tests/reports/*.html
```

| File                                             | Purpose                                         |
| ------------------------------------------------ | ----------------------------------------------- |
| [server.js](server.js)                           | Express server, Socket.io, worker orchestration |
| [config/env.js](config/env.js)                   | **Single source** for all environment config    |
| [public/js/aigf-core.js](public/js/aigf-core.js) | Main chat client (ChatCore class)               |
| [workers/triggers.json](workers/triggers.json)   | **Authoritative** trigger definitions           |
| [public/js/dropdowns/](public/js/dropdowns/)     | Modular UI components (ES6 exports)             |

## Critical Patterns

### 1. Environment Config (MUST use `config/env.js`)

```javascript
// ✅ Always use centralized config
const ENV = require("./config/env");
const url = ENV.TTS_EXPRESS.URL; // Auto-switches dev/prod
const ready = ENV.LMS.isConfigured; // Computed property

// ❌ Never access process.env directly
process.env.TTS_EXPRESS_HOST; // Bypasses validation
```

### 2. Trigger System (Single Source of Truth)

Triggers live in `workers/triggers.json`, served at `/api/triggers/json`. **Never hardcode trigger names.**

```javascript
// ✅ Load from API
const response = await fetch("/api/triggers/json");
const { triggers } = await response.json();
// Each trigger: { name, category, safetyLevel, description, effect }

// ❌ Hardcoded triggers get out of sync
const triggers = ["BAMBI", "GOOD GIRL"];
```

### 3. Socket.io Message Flow

Server **always** mediates between clients and workers. Workers never access sockets.

```javascript
// Client → Server → Worker → Server → Client
socket.emit("ai-chat", { message: "Hello" });
// Server forwards to lmWorker via postMessage()
// Worker responds via parentPort.postMessage()
// Server emits 'ai-response' back to client
```

**Key events**: `ai-chat`/`ai-response`, `tts-request`/`tts-response`, `activate-collar`

### 4. Worker Communication Pattern

Workers are persistent (created once in server.js). Always include `socketId` for routing responses.

```javascript
// Server → Worker
worker.postMessage({ type: "chat", prompt: text, socketId: socket.id });

// Worker → Server
parentPort.postMessage({ type: "ai_response", response: text, socketId });
```

### 5. Dropdown Component System

New UI controls go in `public/js/dropdowns/`. Export from `index.js`.

```javascript
// 1. Create my-dropdown.js with named export
export function MyDropdown() {
  /* returns DOM element */
}

// 2. Add to public/js/dropdowns/index.js
export { MyDropdown } from "./my-dropdown.js";

// 3. Import in aigf-core.js
import { MyDropdown } from "./dropdowns/index.js";
```

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

**Layer order**: `base` → `background` → `interface` → `dropdowns` → `modals` → `overlays`

## Common Tasks

**Add new trigger**: Edit `workers/triggers.json`, include `id`, `name`, `category`, `description`, `effect`

**Add environment variable**:

1. Define in `config/env.js` with appropriate section (SERVER/LMS/TTS_EXPRESS/APPLICATION)
2. Access via `ENV.SECTION.VARIABLE`

**Debug service issues**: Check `ENV.SERVICE.isConfigured` and server console for emoji indicators:

- ✅ success | ⚠️ warning | ❌ error | 🎤 TTS | 🤖 AI

## Conventions

- **Vanilla JS only** — no React/Vue. Use DOM APIs directly.
- **Workers for external APIs** — TTS Express and LM Studio calls stay in workers
- **ChatHistoryManager** (server.js) handles all message storage with `aigf`, `legacy` types
- **ErrorManager** (public/js/error-manager.js) for client-side error handling with retry

## External Services

| Service               | Purpose                                 | Config Section   |
| --------------------- | --------------------------------------- | ---------------- |
| **TTS Express Server**| TTS (12 female voices, supports mixing) | `ENV.TTS_EXPRESS`|
| **LM Studio**         | Local AI chat (@lmstudio/sdk)           | `ENV.LMS`        |
