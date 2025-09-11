# Build Instructions for js-bambisleep-chat

## Overview

This project is a modern Node.js/Express/Socket.io/React/Vite application using ES7+, dotenv, and worker-threads. It includes advanced frontend features (spiral animations, TTS, flashing triggers) and a robust backend server.

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

- `server.js` — Main Express server (serves frontend, handles Socket.io, API, TTS, triggers, etc.)
- `src/` — React frontend (Vite-powered)
- `public/` — Static assets (JS, CSS, images)
- `src/public/js/` — Core frontend logic:
  - `aigf-core.js` — Main chat logic, socket, UI glue
  - `psychodelic-trigger-mania.js` — Spiral/visual animations
  - `text2speech.js` — Text-to-speech queue/logic
  - `triggers.js` — Flashing text triggers, trigger management

---

## 5. Frontend Features

- **index.ejs**: Main HTML template, includes all scripts in correct order
- **aigf-core.js**: Handles chat, socket, UI, trigger word highlighting, error handling
- **psychodelic-trigger-mania.js**: Renders spiral animations (p5.js)
- **text2speech.js**: TTS queue, fetches audio from `/api/tts`, plays in browser
- **triggers.js**: Loads triggers, manages flashing text, audio, and UI toggles

---

## 6. Backend Features

- **Express**: Serves static files, API endpoints
- **Socket.io**: Real-time chat, trigger sync
- **dotenv**: Loads environment variables
- **worker-threads**: For heavy/async tasks (AI, TTS, etc.)
- **/api/tts**: Text-to-speech endpoint (see `text2speech.js`)
- **/api/triggers**: Trigger management

---

## 7. Run the Server

- The main server runs on **port 6969** by default (configurable via `.env`)
- Access the app at: `http://localhost:6969`

---

## 8. Build/Dev Scripts

- `npm run dev` — Start Vite dev server + backend (hot reload)
- `npm run build` — Build frontend for production
- `npm start` — Start production server

---

## 9. Additional Notes

- All frontend JS is ES7+ and modular.
- Use Vite for fast dev/build.
- All environment/configuration is via `.env`.
- For spiral, TTS, and triggers, see respective JS files in `public/js/`.

---

## 10. Useful Links

- [index.ejs](https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/views/index.ejs)
- [aigf-core.js](https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/public/js/aigf-core.js)
- [psychodelic-trigger-mania.js](https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/public/js/psychodelic-trigger-mania.js)
- [text2speech.js](https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/public/js/text2speech.js)
- [triggers.js](https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/public/js/triggers.js)

---

## 11. Troubleshooting

- If you see errors, check `.env` and that all dependencies are installed.
- For TTS, ensure `/api/tts` is reachable and audio plays in browser.
- For spiral/triggers, check browser console for JS errors.

---

## 12. Contributing

- Fork, branch, PR as usual. Follow project coding style (ES7+, modular, minimal, clear).

---

## 13. License

- See `LICENSE` file.

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

Reference: [style.css](https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/public/css/style.css)
