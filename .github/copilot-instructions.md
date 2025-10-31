# GitHub Copilot Instructions

**BambiSleep Chat**: Real-time hypnosis chat app with AI, TTS, and visual effects engine.

## Architecture Overview

### Core Stack - v0.3.0 (HYBRID MIGRATION)
- **Backend**: Express + Socket.io + Worker threads (`src/server/server.js`) + Environment validation  
- **Frontend**: **MIGRATING** Vanilla JS → React + Context API + Hooks
  - Legacy: `public/js/` (Vanilla JS ES6 modules, CSS @layer system)
  - Modern: `src/client/` (React 18, JSX components, Context providers)
- **Build**: Vite dev server (5173) → Express backend (7878) with React support
- **Data Flow**: Socket.io ↔ Server ↔ Worker threads (Kokoro TTS, LM Studio AI)
- **Configuration**: Centralized `src/config/env.js` with validation and auto environment detection
- **Testing**: Unified test framework v2.0 with parallel execution and HTML reports
- **MCP Integration**: 8 active servers (GitHub, Hugging Face, Stripe, Clarity, MongoDB, Azure Quantum, Filesystem, ECL)

### Key Files & Responsibilities - HYBRID MIGRATION
```
src/server/server.js           # Main server: Express, Socket.io, worker mgmt + deployment
src/config/env.js              # Centralized environment configuration with validation  
src/client/App.jsx             # React entry point: providers, routing, error boundaries
src/client/context/            # React Context API: SocketContext, ChatContext
src/client/components/         # React components: MainLayout, dropdowns/, VisualEffects
src/workers/                   # Worker threads: kokoro.js (TTS), lmstudio.js (AI), triggers.json
public/js/aigf-core.js         # LEGACY: Vanilla JS chat client (being migrated)
public/css/layers.css          # CSS @layer architecture (shared by both systems)
vite.config.js                 # Dev proxy + React build: 5173 → 7878 for Socket.io/API
tests/unified-test-framework.js # Unified testing v2.0 with parallel execution
src/utils/mcp-manager.js       # MCP server management CLI (8 active servers)
```

## Development Commands
```bash
npm run all          # ONE COMMAND: clean + test + build + dev (USE THIS!)
npm run dev          # Full stack: Vite (5173) + Express (7878) + auto-restart  
npm run dev:server   # Backend only (port 7878) with nodemon
npm run dev:client   # Vite dev server only (port 5173)
npm run test         # Unified test runner with HTML reports
npm run test:critical # Pre-deployment critical tests only
npm run test:env     # Environment configuration validation
npm run test:mcp     # MCP server connectivity tests
npm run test:mcp:standalone # Standalone MCP tools test
npm run test:architecture   # Validate system architecture
npm run test:stability     # Long-running stability tests
npm run test:performance   # Performance benchmarking
npm run build        # Production build validation  
npm run clean        # Clean artifacts (--light or --full flags)
npm run clean:full   # Deep clean including node_modules
npm run deploy       # Production deployment scripts
npm run mcp:status   # Check MCP server connections
npm run mcp:start    # Initialize MCP servers
```

## Critical Patterns - MODERNIZED

### Centralized Configuration (NEW)
```javascript
// ALWAYS use config/env.js for environment management
import { KOKORO, LMS, SERVER } from '../config/env.js';

// Automatic environment-driven host selection
const kokoroUrl = KOKORO.URL;  // Auto-selects dev/prod host
const lmsUrl = LMS.URL;        // Auto-selects dev/prod host

// Configuration validation built-in
if (!KOKORO.isConfigured) {
  console.error('Kokoro TTS not configured');
}
```

### Official Triggers Only
- **Source**: `workers/triggers.json` (loaded from `/api/triggers/json`)
- **Categories**: `primary`, `physical`, `mental` with safety levels
- **Never hardcode**: Always load from API/JSON, respect official BambiSleep data

### SystemD Service Deployment (NEW)
```bash
# Production deployment uses SystemD service
sudo ./install.sh                    # Auto-installs service
npm run deploy:status                # Check service status
npm run validate-service             # Validate service configuration

# Service file: bambisleepchat.service
# Runs as production user, auto-restart on failure
# Logs via journalctl -u bambisleepchat -f
```

### MCP Server Integration (NEW)
```bash
# 8 active MCP servers provide enhanced AI capabilities:
# - GitHub: Repository releases, tags, team management  
# - Hugging Face: ML models, datasets, image generation
# - Stripe: Payment processing, subscriptions
# - Clarity: Web analytics, session recordings  
# - MongoDB: Database operations, aggregation
# - Azure Quantum: Quantum computing operations
# - Filesystem: Project file operations and search
# - ECL Extension: HPCC Systems integration

# MCP management commands
npm run mcp:status    # Verify all 8 server connections (shows ✅/❌ status)
npm run mcp:start     # Initialize and test MCP servers
npm run mcp:install   # Install filesystem MCP server globally

# Configuration files:
# .vscode/mcp-settings.json - Server configurations
# .env.mcp - API keys and authentication tokens
# src/utils/mcp-manager.js - MCP server management CLI tool
```

### Worker Thread Communication (Enhanced)
```javascript
// Server mediates between Socket.io and workers with enhanced error handling
const worker = new Worker('./workers/kokoro.js');
worker.postMessage({ type: 'tts', text: message, voice: 'af_bella' });

// Use config/env.js for worker configuration
const { KOKORO } = require('./config/env.js');
worker.postMessage({
  type: 'tts',
  text: message,
  voice: KOKORO.DEFAULT_VOICE,
  speed: 1.0
});
```

### Modern CSS Layer System (NEW)
```css
/* Use semantic layers instead of z-index numbers */
@layer base, background, interface, modals, overlays, debug, dropdowns;

/* Status indicators - use these classes instead of inline styles */
.status-active { color: var(--success-color) !important; }
.status-inactive { color: var(--inactive-color) !important; }

/* Dropdown positioning handled by layers.css automatically */
.dropdown-btn[data-state="on"]  { /* Green styling */ }
.dropdown-btn[data-state="off"] { /* Red styling */ }
```

### Unified Dropdown System (Enhanced)
```javascript
// All dropdowns use unified DropdownManager with centralized state
import { TTSDropdown, TriggersDropdown, AIDropdown, CollarDropdown, BrainwaveDropdown, SpiralDropdown } from './dropdowns/index.js';

// Each component uses centralized state management via dropdownManager
class ExampleDropdown {
    constructor(dropdownManager) {
        this.dropdownManager = dropdownManager;
        this.componentName = 'example';
    }
    
    // Use getter/setter pattern for state access
    get isEnabled() {
        return this.dropdownManager.getComponentState(this.componentName, 'isEnabled') || false;
    }
    
    set isEnabled(value) {
        this.dropdownManager.setComponentState(this.componentName, 'isEnabled', value);
    }
}

// Status indicators - USE CSS CLASSES, NO INLINE STYLES
statusIndicator.className = 'status-active';   // ✅ Correct
statusIndicator.style.color = 'green';         // ❌ Avoid inline styles
```

### Hybrid Architecture: Legacy + React Coexistence (CRITICAL)
```javascript
// TWO PARALLEL SYSTEMS during migration:
// 1. LEGACY: public/js/ (Vanilla JS, still active)
// 2. MODERN: src/client/ (React, being built)

// ✅ LEGACY: Socket in aigf-core.js (still running)
// public/js/aigf-core.js - Vanilla JS chat client
class ChatCore {
  constructor() {
    this.socket = io(); // Legacy socket connection
  }
}

// ✅ MODERN: React Context pattern  
// src/client/context/SocketContext.jsx
export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  
  useEffect(() => {
    const newSocket = io({
      transports: ['websocket', 'polling']
    });
    setSocket(newSocket);
  }, []);
  
  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

// ✅ Use React Context in components
const MyComponent = () => {
  const { socket, isConnected } = useSocket();
  // Component logic here
};
```

### React Migration Patterns (NEW)
```jsx
// ✅ Component with Context pattern
import { useSocket } from '../context/SocketContext';
import { useChat } from '../context/ChatContext';

const AIDropdown = ({ isOpen, onToggle }) => {
  const { socket } = useSocket();
  const { aiMode, setAIMode } = useChat();
  
  // Use React patterns: hooks, context, functional components
  const handleToggle = () => {
    setAIMode(!aiMode);
  };
  
  return (
    <div className="dropdown-container">
      <button 
        className={`dropdown-btn ${aiMode ? 'active' : ''}`}
        data-state={aiMode ? 'on' : 'off'}
        onClick={onToggle}
      >
        🤖 AI Mode
      </button>
    </div>
  );
};

// ✅ Provider hierarchy in App.jsx
function App() {
  return (
    <ErrorBoundary>
      <SocketProvider>
        <ChatProvider>
          <MainLayout />
        </ChatProvider>
      </SocketProvider>
    </ErrorBoundary>
  );
}
```

### Audio Delivery Pattern (Enhanced)
```javascript
// TTS: Server → Kokoro worker → Base64 MP3 → Socket.io → Client
// Per Kokoro-FastAPI official docs: https://github.com/remsky/Kokoro-FastAPI
// Uses centralized configuration from config/env.js

// Worker generates speech via OpenAI-compatible endpoint
const { KOKORO } = require('../config/env.js');
const response = await fetch(`${KOKORO.URL}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        model: 'kokoro',
        voice: 'af_bella+af_sky',  // Supports voice mixing with +
        input: text,
        response_format: 'mp3',
        speed: 1.0
    })
});

// Enhanced error handling and Base64 delivery
if (!response.ok) throw new Error(`TTS failed: ${response.status}`);
const audioBuffer = await response.arrayBuffer();
const base64Audio = Buffer.from(audioBuffer).toString('base64');

// Server sends Base64 audio via Socket.io with metadata
socket.emit('tts-response', {
  audioData: base64Audio,
  voice: 'af_bella',
  duration: audioDuration,
  timestamp: Date.now()
});

// Client converts and plays with enhanced audio management
const blob = base64ToBlob(audioData, 'audio/mpeg');
const url = URL.createObjectURL(blob);
audio.src = url;
audio.play().catch(err => console.error('Audio playbook failed:', err));
```

## Development Workflow

### 3-State Work Loop
1. **IMAGINE** (3x): Simplest solution? Reuse existing? Configuration over code?
2. **CREATE**: Minimal code, one function per purpose, test each step
3. **DEPLOY**: Fix only what's broken, STOP when working

### CSS Architecture Rules (NEW)
- **NEVER use inline styles** - All styling through CSS classes
- **Use @layer system** - `@layer base, background, interface, modals, overlays, debug, dropdowns`
- **Status indicators** - Use `.status-active` and `.status-inactive` classes
- **Dropdown states** - Use `data-state="on/off"` attributes, not inline styling
- **Z-index conflicts** - Use semantic CSS layers, avoid z-index numbers

### Common Tasks & Patterns

#### Socket.io Connection Debugging
```javascript
// ✅ Check connection status in browser console
console.log('Socket status:', {
  connected: window.socket?.connected,
  id: window.socket?.id,
  transport: window.socket?.io?.engine?.transport?.name
});

// ✅ Fix "Cannot send global message - not connected" error
// Problem: chat.js creates its own socket instead of using aigf-core.js socket
// Solution: Use event delegation pattern instead

// In chat.js (WRONG):
// this.socket = io(); // Don't create multiple sockets!

// In chat.js (CORRECT):
sendGlobalMessage(message, username) {
  // Delegate to main socket via DOM events
  document.dispatchEvent(new CustomEvent('sendGlobalMessage', {
    detail: { message, username }
  }));
}
```

#### CSS Layer Integration
```css
/* ✅ Correct - Use CSS layers and classes */
@layer interface {
  .status-active { color: var(--success-color); }
  .status-inactive { color: var(--inactive-color); }
}

/* ✅ Correct - Dropdown button states */
.dropdown-btn[data-state="on"] { /* Green styling */ }
.dropdown-btn[data-state="off"] { /* Red pulse animation */ }
```

#### Dropdown Component Pattern
```javascript
// ✅ Correct - Use CSS classes, no inline styles
statusIndicator.className = 'status-active';
btn.setAttribute('data-state', 'on');
btn.classList.add('dropdown-btn', 'toggle-button');

// ❌ Avoid - Inline styles bypass CSS layer system
statusIndicator.style.color = 'green';
btn.style.background = 'green';
```

#### Environment Configuration
```javascript
// ✅ Use centralized config/env.js
import { KOKORO, LMS, SERVER } from '../config/env.js';
const kokoroUrl = KOKORO.URL;  // Auto-selects dev/prod

// ❌ Avoid hardcoded environment logic
const host = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
```

#### Worker Communication
```javascript
// ✅ Enhanced worker messaging with config
const { KOKORO } = require('./config/env.js');
worker.postMessage({
  type: 'tts',
  text: message,
  voice: KOKORO.DEFAULT_VOICE,
  speed: 1.0
});
```

### Testing & Validation - Unified Framework v2.0
```bash
npm run test          # Full unified test suite with HTML reports
npm run test:critical # Pre-deployment essential tests only
npm run test:env      # Environment configuration validation
npm run test:mcp      # MCP server connectivity tests
npm run test:mcp:standalone # Standalone MCP tools test
npm run test:architecture   # Validate system architecture
npm run test:stability     # Long-running stability tests
npm run test:performance   # Performance benchmarking
npm run test:dropdowns     # Dropdown system functionality tests
npm run test:verbose      # Verbose test output for debugging
npm run test:ci           # CI-specific test run with reports
npm run all               # Complete workflow: clean + test + build + dev (USE THIS!)

# Test reports generated in tests/reports/ - HTML and JSON formats
# Unified framework v2.0 supports parallel execution and modular architecture
```

### Git Workflow - Auto Commit & Push (NEW)
```bash
# ALWAYS commit and push changes when development work is complete
# Follow this exact workflow for ALL completed features/fixes:

1. Run comprehensive validation first:
   npm run test                 # Ensure all tests pass
   npm run clean               # Clean artifacts

2. Stage and commit changes:
   git add .                   # Stage all changes
   git status                  # Review staged files
   git commit -m "feat: [description]"  # Use conventional commits

3. Push to repository:
   git push origin production  # Push to production branch
   # OR for feature branches:
   git push origin feature/branch-name

# Conventional Commit Format (REQUIRED):
# feat: new feature
# fix: bug fix  
# docs: documentation changes
# style: formatting, css updates
# refactor: code restructuring
# test: adding/updating tests
# chore: maintenance tasks

# Examples:
git commit -m "feat: add React migration for dropdowns"
git commit -m "fix: resolve Socket.io connection in hybrid mode"
git commit -m "docs: update copilot instructions for v0.3.0"
git commit -m "style: implement CSS layer architecture"
git commit -m "refactor: migrate components to React Context API"
git commit -m "test: enhance unified test framework v2.0"
git commit -m "chore: update dependencies and MCP servers"

# CRITICAL: Always validate before committing
npm run test:critical          # Run critical tests
git diff --staged             # Review changes before commit
```

### Architecture Enforcement
- **Single Socket Connection**: Only `aigf-core.js` creates Socket.io connection, others use DOM events
- **CSS Layers**: Use `@layer` system, avoid z-index numbers
- **No Inline Styles**: All styling through CSS classes
- **Centralized Config**: Use `config/env.js` for all environment logic
- **Official Triggers**: Load from `/api/triggers/json`, never hardcode
- **Worker Isolation**: Keep external API calls in worker threads
- **ES6 Modules**: Clean module exports from `dropdowns/index.js`
- **Production Structure**: Frontend in `public/`, backend in `src/`
- **Unified Testing**: Each test suite supports both unified framework v2.0 and legacy compatibility
- **MCP Integration**: 8 Model Context Protocol servers for enhanced AI capabilities

### Quick Reference

**Complete Development Workflow:**
1. Make changes to codebase
2. `npm run test` - Validate all changes
3. `git add .` - Stage changes
4. `git commit -m "feat: description"` - Commit with conventional format
5. `git push origin production` - Push to repository
6. **ALWAYS complete this workflow when development work is done**

**Add New Dropdown Component (React Migration):**
1. Create `src/client/components/dropdowns/MyDropdown.jsx`
2. Use React Context: `const { socket } = useSocket(); const { myState } = useChat();`
3. Use CSS classes: `.status-active/.status-inactive` and `data-state="on/off"`
4. Follow component pattern with `isOpen` and `onToggle` props
5. Export from component and import in parent
6. **Commit and push when complete**

**Legacy Dropdown (Vanilla JS - being phased out):**
1. Create `public/js/dropdowns/my-dropdown.js`
2. Export from `public/js/dropdowns/index.js`
3. Use unified DropdownManager pattern
4. **Only for maintaining existing legacy code**

**Modify Environment Config:**
1. Edit `src/config/env.js` for new settings
2. Use validation functions for safety
3. Access via `import { KOKORO, LMS, SERVER } from '../config/env.js';`
4. **Commit and push when complete**

**Update Triggers:**
1. Edit `src/workers/triggers.json` (authoritative source)
2. Verify at `/api/triggers/json` endpoint
3. Never hardcode trigger data in components
4. **Commit and push when complete**

**Run Tests:**
- `npm run test` - Full unified test suite with HTML reports
- `npm run test:critical` - Pre-deployment essential tests only
- `npm run test:env` - Environment configuration validation
- `npm run test:mcp` - MCP server connectivity tests
- `npm run test:mcp:standalone` - Standalone MCP tools test
- `npm run test:architecture` - Validate system architecture
- `npm run test:stability` - Long-running stability tests
- `npm run test:performance` - Performance benchmarking
- `npm run test:dropdowns` - Dropdown system functionality tests
- `npm run test:verbose` - Verbose test output
- `npm run test:ci` - CI-specific test run with reports

**Test Reports Location:** `tests/reports/` - HTML and JSON formats