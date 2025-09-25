# GitHub Copilot Instructions ## Enhanced 3-State Work Loop

### 1. IMAGINE (Plan & Simplify) – **DO 3 TIMES**
- **First Round:**
	- What's the simplest possible solution?
	- What's the minimal viable approach?
	- What can I avoid doing entirely?
- **Second Round:**
	- Are there even simpler alternatives?
	- Can I reuse existing code or solutions?
	- Can I solve this with zero or minimal code changes?
- **Third Round:**
	- Is this the laziest, most efficient solution?
	- Can configuration solve this instead of code?
	- What's the absolute minimum I need to change?

### 2. CREATION (Implement) – **LOOP UNTIL 100% COMPLETE**
- Implement only the solution from the 3x IMAGINE phase.
- Write the minimum code required.
- No extra improvements or refactoring.
- One function, one purpose, then stop.
- After each step, check if the task is 100% complete.
- If not, return to the Third IMAGINE Round.

### 3. DEPLOY (Test & Stop)
- Test the minimum viable solution.
- Fix only what's broken.
- Confirm it works.
- If it works, **STOP** – do not add or improve anything further.
- If it doesn't work, return to the Third IMAGINE Round.

---

## Project-Specific Rules

### Development Commands
```bash
npm run dev          # Both server + Vite (port 5173)
npm run dev:server   # Server only (port 6969)
npm run dev:client   # Vite only (port 5173)
```

### Architecture Constraints
- **NO React/JSX** - Pure vanilla JS with ES6 modules
- **Worker threads** - All external API calls (TTS/AI) run in workers
- **Official triggers only** - Use `workers/triggers.json`, never hardcode
- **Environment config** - All settings via `.env`, respect development/production hosts
- **Socket.io** - Real-time chat, TTS audio delivery, trigger events

### Key Patterns
- **Modular dropdowns**: `public/js/dropdowns/index.js` exports all components
- **Worker communication**: Server mediates between Socket.io and worker threads
- **Trigger system**: Official BambiSleep triggers loaded from API, not hardcoded
- **Audio delivery**: MP3 files streamed as base64 via Socket.io

---
## **IMPORTANT: DO NOT CHANGE THIS FILE**

### Core Principle: KEEP IT SIMPLE

**Prioritize working code over perfect code. Less is more.**

---

## BambiSleep Chat Architecture

**Real-time chat app** with psychedelic visuals, TTS, and official BambiSleep trigger detection.

### Key Components:
- **Backend**: `server.js` (Express + Socket.io) + worker threads (`workers/`)
- **Frontend**: Modular vanilla JS in `public/js/` (NO React, NO `src/` dir)
- **Config**: Environment-driven via `.env` (see `.env.example`)
- **Data**: Official triggers from `workers/triggers.json`

### Critical Files:
- `server.js` - Main server with Socket.io, worker management, API routes
- `public/js/aigf-core.js` - Chat core logic, socket handling, trigger processing
- `public/js/dropdowns/` - Modular UI components (ES6 exports)
- `workers/lmstudio.js` - AI chat worker (official triggers only)
- `workers/kokoro.js` - TTS worker (female voices only)
- `vite.config.js` - Frontend build config with proxy setup

---

## Methodology: Enhanced 3-State Work Loop

### 1. IMAGINE (Plan & Simplify) – **DO 3 TIMES**
- **First Round:**
	- What’s the simplest possible solution?
	- What’s the minimal viable approach?
	- What can I avoid doing entirely?
- **Second Round:**
	- Are there even simpler alternatives?
	- Can I reuse existing code or solutions?
	- Can I solve this with zero or minimal code changes?
- **Third Round:**
	- Is this the laziest, most efficient solution?
	- Can configuration solve this instead of code?
	- What’s the absolute minimum I need to change?

### 2. CREATION (Implement) – **LOOP UNTIL 100% COMPLETE**
- Implement only the solution from the 3x IMAGINE phase.
- Write the minimum code required.
- No extra improvements or refactoring.
- One function, one purpose, then stop.
- After each step, check if the task is 100% complete.
- If not, return to the Third IMAGINE Round.

### 3. DEPLOY (Test & Stop)
- Test the minimum viable solution.
- Fix only what’s broken.
- Confirm it works.
- If it works, **STOP** – do not add or improve anything further.
- If it doesn’t work, return to the Third IMAGINE Round.

### 4. FINALIZE (Review & Confirm)
- Review the solution for requirements and intent.
- Ensure it works as intended.
- Clean up any temporary code or files.

---

## Critical Rules

- **ALWAYS FOLLOW `.github/build-instructions.md` AS THE CORE GUIDE.**
- **Official triggers only** - Never hardcode trigger words, always use `workers/triggers.json`
- **Environment awareness** - Respect `KOKORO_HOST_DEVELOPMENT` vs `KOKORO_HOST_PRODUCTION`
- **Worker isolation** - External APIs (Kokoro TTS, LM Studio) only via worker threads
- **When task complete, STOP** - No extra features, improvements, or optimizations

---

## Deployment Workflow

**Only when finished:**
- Run: `git add .`
- Run: `git commit -m "copilot: [description of changes]"`
- Run: `git push`
- [CURL] Check deployment at: https://bambisleep.chat
- [SSH] Connect: `ssh brandynette@192.168.0.72`
  - `cd /home/brandynette/web/bambisleep.chat/js-bambisleep-chat`
  - Only allowed: `git pull`

---

**REMEMBER:**
Think more, code less.
Work with the modular architecture, not against it.
