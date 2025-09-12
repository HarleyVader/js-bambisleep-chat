
# Build Instructions for js-bambisleep-chat

## Overview

This project is a modern Node.js/Express/Socket.io/Vite application using ES7+, dotenv, and worker-threads. It features:

- Real-time chat with trigger word detection and psychedelic spiral animations
- Text-to-speech (TTS) via Kokoro worker (female voices only)
- AI chat via LM Studio worker (official BambiSleep triggers only)
- Modular frontend JS (no React, no `src/` directory)
- Fast Vite-powered frontend build

---

## Prerequisites

- Node.js v18+ (ES7+ support)
- npm (comes with Node.js)
- Git

---

## 1. Install Dependencies

```bash
npm install
```

---

## 2. Environment Setup

- Copy `.env.example` to `.env` and fill in required values (see `.env.example` for details).
  - Set Kokoro/LM Studio host/port if using TTS/AI locally or remotely.
  - All config is via `.env` (see comments in `.env.example`).

---

## 3. Build & Run

### Development (hot reload)

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

---

## 4. Project Structure

```tree
js-bambisleep-chat/
├── public/                 # Frontend static files
│   ├── index.html         # Main HTML template
│   ├── css/
│   │   └── style.css      # Styles and animations
│   └── js/
│       ├── aigf-core.js           # Core chat logic, socket, UI glue
│       ├── psychodelic-trigger-mania.js  # Spiral/visual animations
│       ├── text2speech.js        # TTS queue/logic
│       ├── triggers.js           # Trigger management
│       └── dropdowns/            # UI dropdowns
├── server.js              # Express server + Socket.io + API
├── workers/               # Worker threads (AI, TTS, triggers)
│   ├── lmstudio.js        # LM Studio AI worker
│   ├── kokoro.js          # Kokoro TTS worker
│   └── triggers.json      # Official BambiSleep triggers
├── package.json           # Dependencies and scripts
├── vite.config.js         # Vite configuration
├── .env.example           # Environment variables template
└── README.md              # Project documentation
```

---

## 5. Frontend Features

- **index.html**: Main HTML template, includes all scripts in correct order
- **aigf-core.js**: Handles chat, socket, UI, trigger word highlighting, error handling
- **psychodelic-trigger-mania.js**: Spiral/visual animations (p5.js)
- **text2speech.js**: TTS queue, fetches audio from `/api/tts`, plays in browser
- **triggers.js**: Loads triggers, manages flashing text, audio, and UI toggles

---

## 6. Backend & API Features

- **Express**: Serves static files, API endpoints
- **Socket.io**: Real-time chat, trigger sync
- **dotenv**: Loads environment variables
- **worker-threads**: For heavy/async tasks (AI, TTS, etc.)
- **/api/tts**: Text-to-speech endpoint (see `text2speech.js`)
  - Only female voices allowed (see `/api/tts/voices`)
  - Health check: `/api/tts/health`
- **/api/triggers**: Official BambiSleep trigger management (read-only)
  - All triggers loaded from `workers/triggers.json` (cannot be modified)
  - `/api/triggers/json` for raw data, `/api/triggers/category/:category` for categories
- **/api/chat**: AI chat endpoint (uses LM Studio worker)
- **/api/history**: Recent chat messages (in-memory only)

---

## 7. Run the Server

- The main server runs on **port 6969** by default (configurable via `.env`)
- Access the app at: `http://localhost:6969`
- Vite dev server runs on port 5173 (see `vite.config.js`)

---

## 8. Build/Dev Scripts

- `npm run dev` — Start backend and Vite dev server (hot reload)
- `npm run build` — Build frontend for production
- `npm start` — Start production server (serves built frontend)

---

## 9. Additional Notes

- All frontend JS is ES7+ and modular (no React, no JSX, no `src/`)
- Use Vite for fast dev/build (see `vite.config.js`)
- All environment/configuration is via `.env`
- For spiral, TTS, and triggers, see respective JS files in `public/js/`
- All triggers are official and cannot be modified (see `workers/triggers.json`)
- TTS is female-only and requires Kokoro worker (see `.env`)

---

## 10. Useful Links

- [aigf-core.js](https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/public/js/aigf-core.js)
- [psychodelic-trigger-mania.js](https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/public/js/psychodelic-trigger-mania.js)
- [text2speech.js](https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/public/js/text2speech.js)
- [triggers.js](https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/public/js/triggers.js)

---

## 11. Troubleshooting

- If you see errors, check `.env` and that all dependencies are installed
- For TTS, ensure `/api/tts` is reachable, Kokoro worker is running, and audio plays in browser
- For spiral/triggers, check browser console for JS errors
- If AI chat fails, check LM Studio worker and `.env` config
- For CORS issues, use development mode or adjust server config
- No persistent storage: chat history is in-memory only

---

## 12. Contributing

- Fork, branch, PR as usual. Follow project coding style (ES7+, modular, minimal, clear)

---

## 13. License

- See `LICENSE` file

---

## 14. Theming Reference (Fonts & Colors)

For consistent UI/UX, use the following from the reference CSS:

**Fonts:**

```css
@import url("https://fonts.googleapis.com/css2?family=Audiowide&display=swap");
font-family: "Audiowide", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
```

**:root color variables:**

```css
:root {
  --primary-color: #0c2a2aE6;
  --primary-alt: #15aab5E6;
  --secondary-color: #40002fE6;
  --secondary-alt: #cc0174E6;
  --tertiary-color: #cc0174E6;
  --tertiary-alt: #02b893E6;
  --button-color: #df0471E6;
  --button-alt: #110000E6;
  --nav-color: #0a2626E6;
  --nav-alt: #17dbd8E6;
  --transparent: #124141E6;
  --transparent-alt: #ffffff00;
  --error: #ff3333E6;
  /* ...more variables in the original file... */
}
```

Reference: `public/css/style.css`
