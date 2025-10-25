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
// Per Kokoro-FastAPI official docs: https://github.com/remsky/Kokoro-FastAPI

// Worker generates speech via OpenAI-compatible endpoint
const response = await fetch(`${kokoroUrl}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        model: 'kokoro',
        voice: 'af_bella',  // Female voices only: af_bella, af_sky, af_nicole, etc.
        input: text,
        response_format: 'mp3',
        speed: 1.0
    })
});

// Server sends Base64 audio via Socket.io
socket.emit('tts-response', { audioData: base64Mp3, voice: 'af_bella' });

// Client converts and plays
const blob = base64ToBlob(audioData, 'audio/mpeg');
const url = URL.createObjectURL(blob);
audio.src = url;
audio.play();
```

## Development Workflow

### 3-State Work Loop
1. **IMAGINE** (3x): Simplest solution? Reuse existing? Configuration over code?
2. **CREATE**: Minimal code, one function per purpose, test each step
3. **DEPLOY**: Fix only what's broken, STOP when working

### Common Tasks
## Copilot instructions — BambiSleep Chat (concise)

This project is a small, vanilla-ES6, real-time chat app with TTS and trigger detection.
Be productive quickly by following the conventions below — these are the discoverable, enforced patterns.

- Architecture: `server.js` (Express + Socket.io) mediates between clients and worker threads in `workers/`.
- Frontend: plain ES6 modules under `public/js/` (no framework). Key entry: `public/js/aigf-core.js`.
- Workers: `workers/kokoro.js` (TTS) and `workers/lmstudio.js` (AI). Triggers are authoritative in `workers/triggers.json`.

- Common dev commands (use PowerShell on Windows):
  - `npm run dev` — full stack (Vite dev server + backend proxy)
  - `npm run dev:server` — backend only (port 6969)
  - `npm run dev:client` — frontend only (port 5173)

- Communication patterns to reuse (copy-paste safe):
  - Worker messaging (server → worker):
    ```javascript
    const worker = new Worker('./workers/kokoro.js');
    worker.postMessage({ type: 'tts', text: message, voice: 'af_bella' });
    ```
  - TTS audio delivery (worker → client via socket):
    ```javascript
    // Kokoro-FastAPI OpenAI-compatible endpoint usage
    const response = await fetch(`http://192.168.0.170:8880/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'kokoro',
            voice: 'af_sky+af_bella',  // Supports voice mixing with +
            input: text,
            response_format: 'mp3'
        })
    });
    socket.emit('tts-response', { audioData: base64Mp3, voice: 'af_bella' });
    ```

- Important project rules (enforce these):
  - Never hardcode triggers — read from `/api/triggers/json` or `workers/triggers.json`.
  - Keep external API calls inside worker threads (Kokoro/LMS) — main thread must stay lightweight.
  - Use ES6 module exports for dropdown components: add files in `public/js/dropdowns/` and export them from `public/js/dropdowns/index.js`.

- Environment variables used at runtime (TTS and LMS hosts/ports):
  - KOKORO_HOST_DEVELOPMENT / KOKORO_HOST_PRODUCTION, KOKORO_PORT, KOKORO_DEFAULT_VOICE
  - LMS_HOST_DEVELOPMENT / LMS_HOST_PRODUCTION, LMS_PORT

- Quick examples of where to change behavior:
  - To add UI options, create `public/js/dropdowns/my-dropdown.js` and export from `public/js/dropdowns/index.js`.
  - To add/modify triggers, edit `workers/triggers.json` and verify at `/api/triggers/json`.

If anything in this short guide is unclear or you want more detail (examples, quick tests, or hooks for CI), tell me which area to expand and I will iterate.
