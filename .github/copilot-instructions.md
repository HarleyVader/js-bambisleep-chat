# GitHub Copilot Instructions

**BambiSleep Chat**: Real-time chat with TTS, psychedelic visuals, and BambiSleep trigger detection.

## Quick Start

**Stack**: Express + Socket.io + Worker threads | Vanilla ES6 modules (NO frameworks) | Vite dev proxy

**Commands** (PowerShell on Windows):

```bash
npm start              # Production (port 6969)
npm run dev:server     # Backend only
npm run test           # Run all test suites (generates HTML reports in tests/reports/)
```

**Key Files**:

```
server.js              # Express, Socket.io, worker orchestration, chat history
config/env.js          # Centralized environment config (use ENV.KOKORO.URL, ENV.LMS.URL)
public/js/aigf-core.js # Chat client: socket handling, trigger processing, TTS coordination
public/js/dropdowns/   # Modular UI components (ES6 exports via index.js)
workers/kokoro.js      # TTS worker (female voices only, Kokoro-FastAPI)
workers/lmstudio.js    # AI chat worker (LM Studio SDK)
workers/triggers.json  # Official BambiSleep triggers (AUTHORITATIVE - never hardcode)
```

## Architecture Patterns

### 1. Centralized Environment Config

**ALWAYS use `config/env.js`** - never access `process.env` directly in workers or client code.

```javascript
// ✅ Correct - Use centralized config
const ENV = require("./config/env");
const kokoroUrl = ENV.KOKORO.URL; // Auto-selects dev/prod host
const isConfigured = ENV.KOKORO.isConfigured; // Check before using service

// ❌ Wrong - Direct process.env access
const host = process.env.KOKORO_HOST_DEVELOPMENT; // Doesn't handle prod/dev switching
```

**Why**: `config/env.js` handles dev/prod switching, validation, and provides computed properties (`.URL`, `.isConfigured`).

### 2. Official Triggers Only

**Source of truth**: `workers/triggers.json` → served via `/api/triggers/json`

```javascript
// ✅ Correct - Load from API
async loadOfficialTriggers() {
    const response = await fetch('/api/triggers/json');
    const data = await response.json();
    this.activeTriggers = data.triggers.map(t => t.name.toUpperCase());
}

// ❌ Wrong - Hardcoded triggers
this.activeTriggers = ['BAMBI', 'GOOD GIRL'];  // Out of sync with official list
```

**Structure**: Each trigger has `name`, `category` (Primary/Physical/Mental), `safetyLevel`, `description`, `effect`.

### 3. Socket.io Event Patterns

Server mediates ALL communication. Workers never touch sockets directly.

**Standard Flow**:

```javascript
// Client → Server
socket.emit("tts-request", { text: "Hello", voice: "af_bella" });

// Server → Worker
ttsWorker.postMessage({
  type: "tts",
  text: "Hello",
  voice: "af_bella",
  socketId,
});

// Worker → Server (via parentPort)
parentPort.postMessage({ type: "tts_response", audioData: base64, socketId });

// Server → Client
socket.emit("tts-response", { audioData: base64, voice: "af_bella" });
```

**Key Events** (from `server.js:885-1104`):

- `message`, `global-message`: Chat messages (legacy + global history)
- `ai-chat`: AI requests → `ai-response` or `ai-error`
- `tts-request`: TTS generation → `tts-response` or `tts-error`
- `activate-collar`, `deactivate-collar`: Trigger system control → `collar-activated`
- `update-triggers`: Update active trigger list

### 4. Worker Thread Communication

Workers are **stateful** and persist for the server lifetime.

```javascript
// Server creates workers ONCE (server.js)
const ttsWorker = new Worker("./workers/kokoro.js");
ttsWorker.on("message", (msg) => {
  const socket = io.sockets.sockets.get(msg.socketId);
  socket?.emit(msg.type, msg.data);
});

// Worker handles messages (workers/kokoro.js)
parentPort.on("message", async (msg) => {
  if (msg.type === "tts") {
    const audioData = await generateSpeech(msg.text, msg.voice);
    parentPort.postMessage({
      type: "tts_response",
      audioData,
      socketId: msg.socketId,
    });
  }
});
```

### 5. Modular Dropdown System

UI components are **ES6 modules** exported from `public/js/dropdowns/index.js`.

```javascript
// ✅ Add new dropdown
// 1. Create public/js/dropdowns/my-feature-dropdown.js
export function MyFeatureDropdown() {
  const dropdown = document.createElement("div");
  dropdown.className = "dropdown";
  // ... build UI
  return dropdown;
}

// 2. Export from public/js/dropdowns/index.js
export { MyFeatureDropdown } from "./my-feature-dropdown.js";

// 3. Import in aigf-core.js
import { MyFeatureDropdown } from "./dropdowns/index.js";
```

### 6. CSS Custom Properties (Theming)

All colors defined in `public/css/_variables.css`. **Never hardcode colors**.

```css
/* ✅ Use CSS variables */
.my-element {
  background: var(--primary-color); /* Teal */
  border: var(--border); /* 3px ridge */
  color: var(--button-color); /* Hot pink */
  padding: var(--spacing-md); /* 12px */
  border-radius: var(--border-radius); /* 8px */
}

/* ❌ Hardcoded values break theming */
.my-element {
  background: #0c2a2a;
  padding: 12px;
}
```

**Key Variables**: `--primary-color`, `--secondary-color`, `--tertiary-color`, `--button-color`, `--nav-alt`, `--error`, `--spacing-*`, `--font-size-*`.

### 7. Modular CSS Architecture

CSS uses **@layer system** for predictable cascade without z-index conflicts.

**Structure** (`public/css/`):

```
style.css              # Main orchestrator (imports only)
_variables.css         # Design tokens (colors, spacing, fonts)
_layers.css            # Layer definitions & positioning rules
components/            # UI components (@layer interface, dropdowns)
  ├── buttons.css      # Button states, animations
  ├── chat.css         # Chat containers, messages
  ├── aigf.css         # AI girlfriend mode
  └── dropdowns.css    # Dropdown configs
effects/               # Visual effects (@layer background)
  ├── glassmorphism.css
  ├── spirals.css
  └── brainwave.css
layout/                # Responsive (@layer interface)
  └── mobile.css       # Breakpoints, mobile-first
```

**Layer Order** (from `_layers.css`): `base` → `background` → `interface` → `dropdowns` → `modals` → `overlays` → `debug`

**Adding CSS**:

```css
// 1. Create public/css/components/my-feature.css
@layer interface {
  .my-feature {
    background: var(--primary-color);
    padding: var(--spacing-md);
  }
}

// 2. Import in style.css
@import url("components/my-feature.css");
```

**See**: `public/css/README.md` for full architecture guide.

## Testing & Debugging

**Test Suite**: `npm test` runs `tests/master.test.js` → environment + stability + resource tests.

- Reports: `tests/reports/unified-test-report-*.html` (open in browser)
- Baselines: `tests/reports/performance-baselines.json`

**Debugging**:

```javascript
// Enable debug mode in .env
DEBUG_MODE = true;
LOG_LEVEL = debug;

// Server logs show:
// ✅ = success, ⚠️ = warning, ❌ = error, 🔧 = config, 🎤 = TTS, 🤖 = AI
```

## Common Workflows

**Add New UI Control**:

1. Create `public/js/dropdowns/my-control-dropdown.js` (ES6 export)
2. Export from `public/js/dropdowns/index.js`
3. Import & initialize in `aigf-core.js`

**Add Environment Variable**:

1. Add to `config/env.js` in appropriate section (SERVER/LMS/KOKORO/APPLICATION)
2. Run `npm start` → ENV validation auto-checks format & provides warnings
3. Use via `ENV.SECTION.VARIABLE` (e.g., `ENV.APPLICATION.MAX_MESSAGE_LENGTH`)

**Modify Triggers**:

1. Edit `workers/triggers.json` (preserve structure: `name`, `category`, `safetyLevel`, `description`, `effect`)
2. Test at `http://localhost:6969/api/triggers/json`
3. Client auto-loads via `loadOfficialTriggers()` in `aigf-core.js`

**Debug TTS Issues**:

1. Check `ENV.KOKORO.isConfigured` (requires `KOKORO_HOST_DEVELOPMENT` or `KOKORO_HOST_PRODUCTION`)
2. Verify Kokoro-FastAPI running: `curl http://<host>:<port>/v1/audio/speech`
3. Worker logs in terminal show `🎤 Kokoro TTS configured: <url>`

## Project-Specific Conventions

1. **No Frameworks**: Vanilla JS only. Use DOM APIs, not React/Vue/etc.
2. **Worker Isolation**: External API calls (Kokoro, LM Studio) ONLY in workers. Main thread stays lightweight.
3. **Chat History**: Managed by `ChatHistoryManager` class (server.js:455). Supports `global`, `aigf`, `legacy` types.
4. **Error Handling**: Use `ErrorManager` class (public/js/error-manager.js) for client errors with retry logic.
5. **Security**: CSP headers auto-generated (server.js:372) with environment-aware external hosts.

## External Dependencies

- **Kokoro-FastAPI**: OpenAI-compatible TTS API (https://github.com/remsky/Kokoro-FastAPI)
  - Voices: `af_bella`, `af_sky`, `af_nicole`, etc. (12 female voices)
  - Supports voice mixing: `af_sky+af_bella`
- **LM Studio**: Local AI model server (@lmstudio/sdk)
  - Default model: `l3-sthenomaidblackroot-8b-v1@q4_k_s`
  - Structured output for trigger highlighting (JSON mode)
