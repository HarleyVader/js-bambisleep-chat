# GitHub Copilot Instructions

**BambiSleep Chat**: Real-time chat app with TTS, psychedelic visuals, and BambiSleep trigger detection.

## Architecture Overview

### Core Stack
- **Backend**: Express + Socket.io + Worker threads (`server.js`)
- **Frontend**: Vanilla JavaScript ES6 modules (NO React/frameworks)
- **Build**: Vite for development, serves from `/public` with proxy to port 6969
- **Data Flow**: Socket.io ↔ Server ↔ Worker threads (Kokoro TTS, LM Studio AI)

### Key Files & Responsibilities
```
server.js              # Main server: Express, Socket.io, worker management
public/js/aigf-core.js  # Chat client: socket handling, UI, trigger processing
public/js/dropdowns/    # Modular UI components (ES6 exports)
workers/kokoro.js       # TTS worker (female voices only)
workers/lmstudio.js     # AI chat worker
workers/triggers.json   # Official BambiSleep triggers (never hardcode)
vite.config.js          # Dev proxy: 5173 → 6969 for Socket.io/API
```

## Development Commands
```bash
npm run dev          # Full stack (Vite dev server + backend)
npm run dev:server   # Backend only (port 6969)
npm run dev:client   # Frontend only (port 5173)
```

## Critical Patterns

### Environment-Driven Configuration
```javascript
// ALWAYS respect development vs production hosts
const host = process.env.NODE_ENV === 'production' 
  ? process.env.KOKORO_HOST_PRODUCTION 
  : process.env.KOKORO_HOST_DEVELOPMENT;
```

### Official Triggers Only
- **Source**: `workers/triggers.json` (loaded from `/api/triggers/json`)
- **Categories**: `primary`, `physical`, `mental` with safety levels
- **Never hardcode**: Always load from API/JSON, respect official BambiSleep data

### Worker Thread Communication
```javascript
// Server mediates between Socket.io and workers
const worker = new Worker('./workers/kokoro.js');
worker.postMessage({ type: 'tts', text: message, voice: 'af_bella' });
```

### Modular Dropdown System
```javascript
// public/js/dropdowns/index.js exports all components
import { TTSDropdown, TriggersDropdown } from './dropdowns/index.js';
```

### Audio Delivery Pattern
```javascript
// TTS: Server → Kokoro worker → Base64 MP3 → Socket.io → Client
socket.emit('tts-audio', { audio: base64Mp3, voice: 'af_bella' });
```

## Development Workflow

### 3-State Work Loop
1. **IMAGINE** (3x): Simplest solution? Reuse existing? Configuration over code?
2. **CREATE**: Minimal code, one function per purpose, test each step
3. **DEPLOY**: Fix only what's broken, STOP when working

### Common Tasks

**Adding New Trigger**:
- Update `workers/triggers.json` with official data
- Test via `/api/triggers/json` endpoint
- Client auto-loads via `loadOfficialTriggers()`

**TTS Voice**:
- Kokoro supports combined voices: `af_sky+af_bella`
- All TTS in workers, never block main thread
- Environment hosts: `KOKORO_HOST_DEVELOPMENT` vs `KOKORO_HOST_PRODUCTION`

**UI Component**:
- Create in `public/js/dropdowns/[component].js`
- Export from `public/js/dropdowns/index.js`
- Import in main files as needed

## Environment & Deployment

### Local Development
```bash
# Use http://localhost:5173 for full functionality
npm run dev  # Vite proxy handles Socket.io + API routes
```

### Production
- Domain: `https://bambisleep.chat`
- SSH: `ssh brandynette@192.168.0.72`
- Deploy: `git pull` only (auto-builds)

### Environment Variables
```bash
# Required for TTS functionality
KOKORO_HOST_DEVELOPMENT=192.168.0.170
KOKORO_HOST_PRODUCTION=192.168.0.170
KOKORO_PORT=8880
KOKORO_DEFAULT_VOICE=af_sky+af_bella

# LM Studio AI
LMS_HOST_DEVELOPMENT=localhost
LMS_HOST_PRODUCTION=192.168.0.118
LMS_PORT=7777
```

## Critical Rules
- **Official triggers only**: Never hardcode, always use `workers/triggers.json`
- **Worker isolation**: External APIs (TTS/AI) never in main thread
- **Environment awareness**: Respect development/production host configs
- **Vanilla JS**: No React/frameworks, ES6 modules only
- **Stop when working**: No extra features or optimizations

---

**Remember**: Work with the modular architecture, not against it. Think more, code less.