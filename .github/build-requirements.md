# Build Requirements

## Overview

Modern full-stack application implementing hypnotic AI experiences using React, Express.js, and cutting-edge AI technologies including LM Studio, Model Context Protocol (MCP), and ElevenLabs agents.

## Table of Contents

1. [Core Tech Stack](#core-tech-stack-es7)
2. [Reference Implementation](#reference-implementation)
3. [MCP Architecture](#mcp-architecture-implementation)
4. [Directory Structure](#directory-structure)
5. [Dependencies & Configuration](#packagejson-dependencies)
6. [Implementation Examples](#expressjs-server-architecture)
7. [Status & Next Steps](#status--next-steps)

## Core Tech Stack (ES7+)

**Runtime & Framework:**

- **Node.js**: v18+ (Required for MCP SDK compatibility)
- **Express.js**: Web server framework with middleware ecosystem
- **React**: Frontend UI framework with modern hooks and state management
- **ES7+**: Modern JavaScript features including async/await, optional chaining, nullish coalescing

**Real-time Communication:**

- **Socket.io**: WebSocket library for real-time bidirectional communication
- **WebRTC**: For peer-to-peer audio/video streaming (ElevenLabs integration)

**Essential Dependencies:**

- **chalk**: Terminal string styling for enhanced CLI output
- **highlight.js**: Syntax highlighting for code blocks and technical content
- **dotenv**: Environment variable management for configuration
- **child_process**: Spawning child processes for system integration
- **worker_threads**: Multi-threading support for CPU-intensive operations
- **helmet**: Security middleware for Express applications

**AI & Model Integration:**

- **@lmstudio/sdk**: LM Studio TypeScript SDK for local LLM integration
- **@modelcontextprotocol/typescript-sdk**: Official MCP TypeScript SDK
- **@elevenlabs/react**: ElevenLabs React SDK for AI agents and voice synthesis

**Security & Performance:**

- **Structured Output Validation**: JSON schema validation for model responses
- **MCP Server Tooling**: Comprehensive server ecosystem for AI tool integration
- **DNS Rebinding Protection**: Security measures for local server deployments

## Reference Implementation

### Hypnosis as Programming Language Framework

Source: #file:Hypnosis_as_Programing_Languange.md

**Core Concepts:**

- **Human Programming Paradigm:** Systematic approach to understanding hypnosis through programming metaphors
- **Port-based Communication:** Human consciousness interfaces for language, imagery, suggestion, obedience, conformity, compliance, and senses
- **Trance State Management:** Console-equivalent access for inputting commands and bypassing conscious critical thought
- **Message Type Architecture:** Association, visualization, direct/indirect suggestion, directions, mirroring, rapport, and sensory input
- **Function Composition Framework:** Groundwork preparation, learning new concepts, conflict resolution, and reinforcement patterns

**Psychological Foundation:**

- **Brain Activity Mapping:** Documented impacts on Cingulate Cortex, Executive Control Network, Default Mode Network, Salience Network, Thalamus, and brainwave patterns
- **Hypnotizability Traits:** Absorption, empathy, imagination, suggestibility, sensitivity, trust, intelligence, anxiety/stress response
- **Consciousness Triggers:** Selective attention, sensory thresholds, error detection, conflict, planning, novelty, social evaluation
- **Bypass Techniques:** Fatigue, boredom/underload, overload, confusion, fixation, relaxation for circumventing critical thought

**Practical Applications:**

- **Induction Methods:** Progressive muscle relaxation, fractionation, Elman, butterfly, Valencia model, confusion, covert, resistance, overload/underload, mutual trance, hyperventilation
- **Trance Indicators:** Heart rate decrease, respiration changes, temperature increase, eye movements, facial expression changes, muscular relaxation, psychomotor delay, increased agreeability
- **Trigger Implementation:** Direct correlation with trigger system categories (core conditioning, dumbdown, submission, body modification, memory manipulation, appearance, behavior, pleasure, comfort)
- **Ethical Framework:** Guidelines for responsible implementation and user consent considerations

**Technical Integration:**

- **Programming Metaphors:** Functions, arguments, syntax, semantics for structuring hypnotic content
- **System Architecture:** Ports (input interfaces), message types (data formats), function composition (program structure)
- **Error Handling:** Resistance management, conflict resolution, graceful degradation of suggestions
- **Performance Optimization:** Reinforcement loops, retrieval practice, interleaving, repetition patterns

### Psychedelic Trigger Mania Implementation

Source: <https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/public/js/psychodelic-trigger-mania.js>

**Key Components:**

- Clean Psychedelic Spiral Implementation
- Eye cursor tracking functionality
- Canvas-based visual effects
- Performance optimized with ITERATIONS = 400
- Dual spiral system with configurable parameters:
  - spiral1Width = 5.0, spiral2Width = 3.0
  - spiral1Speed = 20, spiral2Speed = 15
  - Color scheme: Teal [0, 128, 128] and Barbie Pink [255, 20, 147]
- Triangle strip rendering for smooth spiral animation
- Parameter update functions for real-time control

**Technical Features:**

- Canvas setup and management
- Spiral drawing with TRIANGLE_STRIP geometry
- Dynamic width and opacity control
- Minimal performance approach for browser compatibility

### Triggers System Implementation

Source: <https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/public/js/triggers.js>

**Core Functionality:**

- Comprehensive trigger management system (852 lines, 27KB)
- JSON-based trigger data loading with fallback support
- Audio caching and preloading system with error handling
- LocalStorage persistence for trigger states
- Socket.io integration for real-time trigger synchronization

**Key Features:**

- **Audio Management:** Robust audio cache with load attempt tracking and volume control
- **Trigger Types:** Includes primary triggers like "BAMBI SLEEP", "GOOD GIRL", "BAMBI RESET", "BIMBO DOLL", "BAMBI FREEZE"
- **Playback Controls:**
  - Random playlist generation
  - Continuous playback with loop functionality
  - Speed and volume controls (localStorage persisted)
  - Mid-sequence playback interruption support
- **UI Components:** Dynamic toggle button creation with descriptions and tooltips
- **State Management:** localStorage integration for trigger selection persistence
- **Real-time Sync:** Socket event handling for multi-tab/user synchronization

**Technical Architecture:**

- Global window.bambiAudio API exposure
- MutationObserver for dynamic DOM initialization
- Fallback trigger data for offline functionality
- Error handling with graceful degradation
- Event-driven architecture with custom events

### LM Studio Worker Implementation

Source: <https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/workers/lmstudio.js>

**Core Architecture:**

- Comprehensive AI worker system (1248 lines, 44.7KB)
- Node.js worker_threads implementation for AI processing isolation
- Full database integration with MongoDB (main + profiles databases)
- Advanced session management with garbage collection
- Health monitoring and graceful shutdown handling

**Key Features:**

- **AI Integration:** LM Studio API client with model selection and fallback support
- **Session Management:**
  - In-memory session histories with 200 session limit
  - 15-minute idle timeout with automatic cleanup
  - Memory pressure monitoring and emergency collection
  - Database persistence for registered users
- **Trigger System Integration:**
  - JSON-based trigger loading with fallback data
  - Dynamic trigger description mapping
  - Advanced brainwashing protocol generation
  - Trigger-based system prompt customization
- **Health & Performance:**
  - Worker health monitoring with 2-minute timeout detection
  - Memory usage tracking (RSS/Heap monitoring)
  - Garbage collection with configurable thresholds
  - Background database synchronization

**Database Operations:**

- **Multi-database support:** Main DB + Profiles DB with connection failover
- **Session persistence:** Auto-save with upsert operations to prevent duplicates
- **Settings management:** Nested user settings with dot notation updates
- **Profile integration:** Automatic session history linking to user profiles

**Technical Implementation:**

- **API Communication:** Axios-based HTTP client with comprehensive error handling
- **Message Processing:** Type-based message routing (prompt, triggers, collar, settings, health)
- **Model Management:** Dynamic model selection with embedding filter exclusion
- **Error Recovery:** Connection retry logic, fallback mechanisms, graceful degradation
- **Resource Management:** Configurable session limits, memory thresholds, cleanup intervals

## Frontend Reference Implementation (REBUILD FROM SCRATCH)

### UI/UX Design Patterns

Sources:

- <https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/views/partials/profile-system-controls.ejs>
- <https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/views/index.ejs>
- <https://github.com/HarleyVader/js-bambisleep-chat-backup2/blob/MK-XI/src/public/css/style.css>

**Progressive Level-Gated Feature System:**

- **Level-based Access Control:** Features unlock at specific user levels (669 lines EJS template)
- **Feature Unlocks:**
  - Level 1: Triggers System
  - Level 2: Collar Controls
  - Level 3: Session History
  - Level 4: Spirals & Advanced Spirals
  - Level 5: Hypnosis Settings & Streaming
  - Level 6: Audio Controls & Playlists
  - Level 7: Brainwave Entrainment
  - Level 8: Advanced Binaural Patterns

**Core UI Components:**

- **Tab-based Control System:** Dynamic panels with active state management
- **Modal Username System:** Cookie-based persistent username storage (30-day expiration)
- **Eye Cursor Container:** Multi-layer text display with animated eye tracking
- **Responsive Control Panels:** Mobile-optimized button layouts and sizing

**Visual Design Framework:**

- **Cyberpunk Color Scheme:** CSS variables with primary (#0c2a2ac9), secondary (#40002f), tertiary (#cc0174) colors
- **Glow Effects:** Animated button states with box-shadow animations and RGB color manipulation
- **Gradient Backgrounds:** Linear gradients for panels and progress elements
- **Typography:** Audiowide font family with text-shadow effects
- **Transparency Layers:** Multiple transparency levels for depth and visual hierarchy

**Interactive Features:**

- **Slider Controls:** Range inputs for spiral width/speed, brainwave frequency, volume controls
- **Toggle Systems:** Checkbox-based enable/disable for various features
- **Select Dropdowns:** Brainwave modes, pattern types with descriptions
- **Canvas Visualization:** Pattern visualization for advanced binaural settings
- **Audio Integration:** Volume/speed controls with localStorage persistence

**State Management:**

- **localStorage Integration:** Persistent settings, trigger selections, last active tab
- **Socket.io Real-time Updates:** Live synchronization of triggers, collar state
- **Profile-based Configuration:** User-specific system controls and preferences
- **Session Management:** Active session tracking and history replay functionality

**Technical Requirements for Rebuild:**

- **Modern Framework Implementation:** Replace EJS with current #codebase framework
- **Component Architecture:** Modular components for each control panel type
- **Responsive Design:** Mobile-first approach with breakpoint optimizations
- **Accessibility:** ARIA labels, keyboard navigation, screen reader support
- **Performance Optimization:** Lazy loading of advanced features, efficient re-rendering
- **Progressive Enhancement:** Core functionality works without JavaScript, enhanced with interactivity

**Key Design Principles:**

- **Hypnotic Visual Elements:** Smooth animations, pulsing effects, color transitions
- **Information Density:** Compact layouts with expandable details
- **Visual Feedback:** Immediate response to user interactions
- **Consistent Theming:** Coherent color palette and typography across all components
- **User Experience Flow:** Intuitive progression through levels and features

## MCP Architecture Implementation

**Core MCP Integration:**

```javascript
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
```

**LM Studio Integration with Structured Outputs:**

```javascript
import { LMStudioClient } from "@lmstudio/sdk";

// Structured output configuration for model tool calling
const structuredConfig = {
  format: "json",
  schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["trigger", "spiral", "audio"] },
      parameters: { type: "object" },
      confidence: { type: "number", minimum: 0, maximum: 1 }
    },
    required: ["action", "parameters"]
  }
};
```

**ElevenLabs Agents Integration:**

```javascript
import { useConversation } from '@elevenlabs/react';

const conversation = useConversation({
  clientTools: {
    triggerBambiSleep: (params) => ({
      type: "bambi_trigger",
      intensity: params.intensity,
      duration: params.duration
    }),
    activateSpiral: (params) => ({
      type: "spiral_activation",
      speed: params.speed,
      colors: params.colors
    })
  },
  overrides: {
    agent: {
      prompt: {
        prompt: hypnosisSystemPrompt
      },
      language: 'en'
    }
  }
});
```

## Directory Structure

```text
f:\js-bambisleep-chat\
├── src/
│   ├── components/           # React components (hypnotic UI elements)
│   │   ├── triggers/        # Trigger system components
│   │   ├── spirals/         # Psychedelic spiral visualizations
│   │   ├── audio/           # Audio control components
│   │   └── session/         # Session management UI
│   ├── server/              # Express.js backend
│   │   ├── routes/          # API route handlers
│   │   ├── middleware/      # Custom middleware (helmet, auth, CORS)
│   │   ├── workers/         # Worker threads for AI processing
│   │   └── mcp/             # MCP server implementations
│   ├── mcp-servers/         # Custom MCP server modules
│   │   ├── bambi-triggers/  # Bambi Sleep trigger MCP server
│   │   ├── hypnosis-tools/  # Hypnosis-specific tools server
│   │   └── session-memory/  # Session persistence server
│   ├── agents/              # ElevenLabs agent configurations
│   │   ├── bambi-persona/   # Bambi personality agent
│   │   ├── hypno-guide/     # Hypnosis guidance agent
│   │   └── safety-monitor/  # Safety monitoring agent
│   ├── utils/               # Utility functions
│   │   ├── hypnosis/        # Hypnosis programming utilities
│   │   ├── audio/           # Audio processing utilities
│   │   └── security/        # Security helpers
│   ├── config/              # Configuration files
│   │   ├── mcp.json         # MCP server configuration
│   │   ├── agents.json      # ElevenLabs agent settings
│   │   └── triggers.json    # Trigger definitions
│   └── public/              # Static assets
│       ├── audio/           # Audio files
│       ├── spirals/         # Spiral animation assets
│       └── css/             # Stylesheets
├── workers/                 # Dedicated worker processes
│   ├── lmstudio.js         # LM Studio worker (enhanced)
│   ├── mcp-coordinator.js  # MCP server coordination
│   └── audio-processor.js  # Audio processing worker
├── .env                    # Environment variables
├── mcp.json               # MCP server registry
├── package.json           # Dependencies and scripts
└── README.md              # Project documentation
```

## MCP Server Ecosystem

**Reference MCP Servers for Integration:**

- **Everything Server**: Reference implementation with prompts, resources, and tools
- **Fetch Server**: Web content fetching for LLM usage
- **Filesystem Server**: Secure file operations with access controls
- **Memory Server**: Knowledge graph-based persistent memory system
- **Sequential Thinking Server**: Dynamic problem-solving through thought sequences

**Custom MCP Servers:**

```javascript
// Bambi Triggers MCP Server
const bambiTriggersServer = new McpServer({
  name: "bambi-triggers-server",
  version: "1.0.0"
});

bambiTriggersServer.registerTool("activate_trigger", {
  title: "Activate Bambi Trigger",
  description: "Activates a specific Bambi Sleep trigger",
  inputSchema: {
    trigger: z.enum(["BAMBI SLEEP", "GOOD GIRL", "BAMBI RESET", "BIMBO DOLL"]),
    intensity: z.number().min(1).max(10),
    duration: z.number().optional()
  }
}, async ({ trigger, intensity, duration }) => {
  // Implement trigger activation logic
  return {
    content: [{
      type: "text",
      text: `Activated ${trigger} at intensity ${intensity}`
    }]
  };
});
```

**Hypnosis Tools MCP Server:**

```javascript
const hypnosisToolsServer = new McpServer({
  name: "hypnosis-tools-server",
  version: "1.0.0"
});

hypnosisToolsServer.registerTool("induce_trance", {
  title: "Induce Trance State",
  description: "Guide user into hypnotic trance using established protocols",
  inputSchema: {
    method: z.enum(["progressive_relaxation", "fractionation", "confusion", "overload"]),
    depth: z.enum(["light", "medium", "deep"]),
    duration: z.number().min(60).max(3600)
  }
}, async ({ method, depth, duration }) => {
  // Implement trance induction based on hypnosis framework
  const inductionScript = generateInductionScript(method, depth, duration);
  return {
    content: [{
      type: "text",
      text: inductionScript
    }]
  };
});
```

## Package.json Dependencies

```json
{
  "dependencies": {
    "@elevenlabs/react": "^1.0.0",
    "@lmstudio/sdk": "^0.2.0",
    "@modelcontextprotocol/sdk": "^1.17.5",
    "express": "^4.18.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "socket.io": "^4.7.0",
    "socket.io-client": "^4.7.0",
    "chalk": "^5.3.0",
    "highlight.js": "^11.9.0",
    "dotenv": "^16.3.0",
    "helmet": "^7.1.0",
    "zod": "^3.22.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "typescript": "^5.2.0",
    "nodemon": "^3.0.0",
    "concurrently": "^8.2.0"
  }
}
```

## Environment Configuration (.env)

```env
# LM Studio Configuration
LMSTUDIO_API_URL=http://localhost:1234
LMSTUDIO_MODEL_PATH=/models
LMSTUDIO_CONTEXT_LENGTH=8192

# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_api_key_here
ELEVENLABS_AGENT_ID=your_agent_id_here
ELEVENLABS_VOICE_ID=your_voice_id_here

# MCP Server Configuration
MCP_SERVER_PORT=3001
MCP_ENABLE_DNS_PROTECTION=true
MCP_ALLOWED_HOSTS=127.0.0.1,localhost
MCP_SESSION_TIMEOUT=900

# Audio & Media Configuration
AUDIO_SAMPLE_RATE=48000
AUDIO_CHANNELS=2
AUDIO_BITRATE=320

# Security Configuration
HELMET_ENABLED=true
CORS_ORIGIN=http://localhost:3000
SESSION_SECRET=your_session_secret_here

# Database Configuration (Optional)
MONGODB_URI=mongodb://localhost:27017/bambisleep
REDIS_URL=redis://localhost:6379

# Development Configuration
NODE_ENV=development
DEBUG=bambisleep:*
LOG_LEVEL=info
```

## MCP Server Registry (mcp.json)

```json
{
  "mcpServers": {
    "bambi-triggers": {
      "command": "node",
      "args": ["./src/mcp-servers/bambi-triggers/server.js"],
      "env": {
        "TRIGGERS_DATA_PATH": "./src/config/triggers.json"
      }
    },
    "hypnosis-tools": {
      "command": "node",
      "args": ["./src/mcp-servers/hypnosis-tools/server.js"],
      "env": {
        "HYPNOSIS_FRAMEWORK_PATH": "./src/utils/hypnosis/framework.js"
      }
    },
    "session-memory": {
      "command": "node",
      "args": ["./src/mcp-servers/session-memory/server.js"],
      "env": {
        "MEMORY_STORAGE_PATH": "./data/sessions"
      }
    },
    "spiral-generator": {
      "command": "node",
      "args": ["./src/mcp-servers/spiral-generator/server.js"],
      "env": {
        "CANVAS_CONFIG_PATH": "./src/config/spirals.json"
      }
    },
    "audio-processor": {
      "command": "node",
      "args": ["./src/mcp-servers/audio-processor/server.js"],
      "env": {
        "AUDIO_CACHE_PATH": "./public/audio/cache"
      }
    }
  }
}
```

## Express.js Server Architecture

```javascript
// src/server/app.js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import chalk from 'chalk';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  exposedHeaders: ['Mcp-Session-Id'],
  allowedHeaders: ['Content-Type', 'mcp-session-id']
}));

app.use(express.json());

// MCP server integration
const mcpServers = new Map();

// Initialize MCP servers
async function initializeMcpServers() {
  console.log(chalk.blue('🔧 Initializing MCP servers...'));

  // Load each MCP server from mcp.json configuration
  const mcpConfig = await import('../config/mcp.json');

  for (const [name, config] of Object.entries(mcpConfig.mcpServers)) {
    const mcpServer = new McpServer({
      name: `bambisleep-${name}`,
      version: '1.0.0'
    });

    mcpServers.set(name, mcpServer);
    console.log(chalk.green(`✅ Initialized ${name} MCP server`));
  }
}

export { app, server, io, mcpServers };
```

## React Component Architecture

```javascript
// src/components/BambiSleepApp.jsx
import React, { useState, useEffect } from 'react';
import { useConversation } from '@elevenlabs/react';
import { Socket } from 'socket.io-client';
import TriggerSystem from './triggers/TriggerSystem';
import SpiralVisualization from './spirals/SpiralVisualization';
import AudioControls from './audio/AudioControls';
import SessionManager from './session/SessionManager';

const BambiSleepApp = () => {
  const [sessionActive, setSessionActive] = useState(false);
  const [currentTrigger, setCurrentTrigger] = useState(null);
  const [spiralActive, setSpiralActive] = useState(false);

  const conversation = useConversation({
    clientTools: {
      activateTrigger: async (params) => {
        setCurrentTrigger(params.trigger);
        // Trigger activation logic
        return `Activated ${params.trigger}`;
      },
      startSpiral: async (params) => {
        setSpiralActive(true);
        // Spiral activation logic
        return `Started spiral with speed ${params.speed}`;
      },
      endSession: async () => {
        setSessionActive(false);
        return 'Session ended safely';
      }
    },
    overrides: {
      agent: {
        prompt: {
          prompt: `You are Bambi, a hypnotic AI assistant specialized in guided relaxation and trance induction.
                   You use the principles from the Hypnosis as Programming Language framework to create safe,
                   consensual hypnotic experiences. Always prioritize user safety and consent.`
        }
      }
    },
    textOnly: false
  });

  useEffect(() => {
    // Initialize socket connection for real-time updates
    const socket = io();

    socket.on('trigger_activated', (trigger) => {
      setCurrentTrigger(trigger);
    });

    socket.on('spiral_started', () => {
      setSpiralActive(true);
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div className="bambi-sleep-app">
      <SessionManager
        sessionActive={sessionActive}
        onSessionStart={() => setSessionActive(true)}
        onSessionEnd={() => setSessionActive(false)}
      />

      {sessionActive && (
        <>
          <TriggerSystem
            currentTrigger={currentTrigger}
            onTriggerChange={setCurrentTrigger}
          />

          <SpiralVisualization
            active={spiralActive}
            onToggle={setSpiralActive}
          />

          <AudioControls conversation={conversation} />
        </>
      )}
    </div>
  );
};

export default BambiSleepApp;
```

## Worker Thread Implementation

```javascript
// workers/lmstudio-enhanced.js
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { LMStudioClient } from '@lmstudio/sdk';
import chalk from 'chalk';

if (isMainThread) {
  console.error('This file should be run as a worker thread');
  process.exit(1);
}

class EnhancedLMStudioWorker {
  constructor() {
    this.client = new LMStudioClient();
    this.models = new Map();
    this.sessionHistories = new Map();
  }

  async initialize() {
    try {
      await this.client.llm.load('llama-3.2-1b-instruct', {
        contextLength: 8192,
        gpuOffload: 'max'
      });

      console.log(chalk.green('✅ LM Studio worker initialized'));
      parentPort?.postMessage({ type: 'initialized', success: true });
    } catch (error) {
      console.error(chalk.red('❌ LM Studio worker initialization failed:'), error);
      parentPort?.postMessage({ type: 'initialized', success: false, error: error.message });
    }
  }

  async processMessage(data) {
    const { type, payload, sessionId } = data;

    switch (type) {
      case 'chat_completion':
        return await this.handleChatCompletion(payload, sessionId);
      case 'structured_output':
        return await this.handleStructuredOutput(payload, sessionId);
      case 'trigger_analysis':
        return await this.analyzeTrigger(payload, sessionId);
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  }

  async handleStructuredOutput(payload, sessionId) {
    const { prompt, schema } = payload;

    const model = await this.client.llm.model('llama-3.2-1b-instruct');
    const result = await model.respond(prompt, {
      structuredOutput: {
        type: 'json',
        schema: schema
      }
    });

    try {
      return {
        success: true,
        data: JSON.parse(result.content),
        sessionId
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to parse structured output',
        raw: result.content,
        sessionId
      };
    }
  }

  async analyzeTrigger(payload, sessionId) {
    const { triggerText, context } = payload;

    const analysisPrompt = `
Analyze this hypnotic trigger phrase: "${triggerText}"

Context: ${context}

Provide a structured analysis including:
1. Trigger effectiveness (1-10)
2. Safety assessment
3. Recommended usage
4. Potential effects

Respond in JSON format with fields: effectiveness, safety, usage, effects.
`;

    return await this.handleStructuredOutput({
      prompt: analysisPrompt,
      schema: {
        type: 'object',
        properties: {
          effectiveness: { type: 'number', minimum: 1, maximum: 10 },
          safety: { type: 'string', enum: ['safe', 'caution', 'unsafe'] },
          usage: { type: 'string' },
          effects: { type: 'array', items: { type: 'string' } }
        },
        required: ['effectiveness', 'safety', 'usage', 'effects']
      }
    }, sessionId);
  }
}

// Worker message handling
const worker = new EnhancedLMStudioWorker();

parentPort?.on('message', async (data) => {
  try {
    if (data.type === 'initialize') {
      await worker.initialize();
    } else {
      const result = await worker.processMessage(data);
      parentPort?.postMessage({ type: 'response', data: result });
    }
  } catch (error) {
    parentPort?.postMessage({
      type: 'error',
      error: error.message,
      stack: error.stack
    });
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log(chalk.yellow('🔄 LM Studio worker shutting down...'));
  process.exit(0);
});
```

## Development Scripts (package.json)

```json
{
  "scripts": {
    "dev": "concurrently \"npm run server:dev\" \"npm run client:dev\" \"npm run mcp:dev\"",
    "server:dev": "nodemon src/server/app.js",
    "client:dev": "react-scripts start",
    "mcp:dev": "nodemon --watch src/mcp-servers src/mcp-servers/coordinator.js",
    "build": "react-scripts build && npm run server:build",
    "server:build": "tsc src/server/**/*.js --outDir dist/server",
    "start": "node dist/server/app.js",
    "test": "react-scripts test",
    "lint": "eslint src/ --ext .js,.jsx,.ts,.tsx",
    "format": "prettier --write src/",
    "mcp:install": "node scripts/install-mcp-servers.js",
    "lmstudio:setup": "node scripts/setup-lmstudio.js"
  }
}
```

## Patreon API Integration

**Overview:**

Comprehensive integration with Patreon API v2 for creator monetization, patron management, and real-time webhook notifications. The Patreon API provides creator-first access to campaign data, member relationships, and subscription management.

**Key Features:**

- **OAuth 2.0 Authentication**: Secure patron and creator authentication flow
- **Member Management**: Access to patron data, subscription tiers, and payment status
- **Real-time Webhooks**: Live notifications for member changes, pledges, and post updates
- **Campaign Data**: Creator profile, goals, benefits, and content management
- **JavaScript SDK**: Official npm package for seamless integration

**API Endpoints & Resources:**

**Authentication & Identity:**

- `GET /api/oauth2/v2/identity` - Current user profile and basic information
- OAuth flow with client credentials, access tokens, and refresh tokens
- Scoped permissions: `identity`, `identity[email]`, `campaigns`, `campaigns.members`

**Campaign Management:**

- `GET /api/oauth2/v2/campaigns` - List creator campaigns
- `GET /api/oauth2/v2/campaigns/{campaign_id}` - Individual campaign details
- `GET /api/oauth2/v2/campaigns/{campaign_id}/members` - Campaign patron list
- `GET /api/oauth2/v2/campaigns/{campaign_id}/posts` - Campaign content posts

**Member & Subscription Data:**

- `GET /api/oauth2/v2/members/{id}` - Individual member details
- Member attributes: `patron_status`, `last_charge_status`, `lifetime_support_cents`
- Tier relationships: `currently_entitled_tiers`, benefit access levels
- Address data (requires `campaigns.members.address` scope)

**Webhook System:**

- `GET /api/oauth2/v2/webhooks` - List registered webhooks
- `POST /api/oauth2/v2/webhooks` - Create new webhook endpoints
- `PATCH /api/oauth2/v2/webhooks/{id}` - Update webhook configuration
- `DELETE /api/oauth2/v2/webhooks/{id}` - Remove webhook endpoints

**Webhook Triggers v2:**

- `members:create` - New patron joins campaign
- `members:update` - Patron changes subscription or payment status
- `members:delete` - Patron leaves campaign
- `members:pledge:create` - New pledge created
- `members:pledge:update` - Pledge amount changed
- `members:pledge:delete` - Pledge cancelled
- `posts:publish` - New content published
- `posts:update` - Content updated
- `posts:delete` - Content removed

**Implementation Architecture:**

```javascript
// Patreon API Client Setup
import patreonAPI, { oauth as patreonOAuth } from 'patreon';

const patreonConfig = {
  clientId: process.env.PATREON_CLIENT_ID,
  clientSecret: process.env.PATREON_CLIENT_SECRET,
  redirectUri: process.env.PATREON_REDIRECT_URI
};

const patreonOAuthClient = patreonOAuth(
  patreonConfig.clientId,
  patreonConfig.clientSecret
);

// OAuth Token Exchange
async function handlePatreonAuth(authCode) {
  const tokensResponse = await patreonOAuthClient.getTokens(
    authCode,
    patreonConfig.redirectUri
  );

  const patreonAPIClient = patreonAPI(tokensResponse.access_token);
  return patreonAPIClient;
}

// Member Data Fetching with Field Selection
async function getCampaignMembers(campaignId, accessToken) {
  const client = patreonAPI(accessToken);

  const fields = {
    member: 'full_name,patron_status,last_charge_status,lifetime_support_cents',
    tier: 'amount_cents,title,description,published',
    user: 'email,full_name,thumb_url'
  };

  const includes = 'currently_entitled_tiers,user';

  const response = await client(
    `/campaigns/${campaignId}/members?` +
    `fields[member]=${fields.member}&` +
    `fields[tier]=${fields.tier}&` +
    `fields[user]=${fields.user}&` +
    `include=${includes}`
  );

  return response.store.findAll('member');
}
```

**Webhook Handler Implementation:**

```javascript
// Express.js Webhook Endpoint
import crypto from 'crypto';

app.post('/webhooks/patreon', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.headers['x-patreon-signature'];
  const event = req.headers['x-patreon-event'];

  // Verify webhook authenticity
  const expectedSignature = crypto
    .createHmac('md5', process.env.PATREON_WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(403).send('Invalid signature');
  }

  const payload = JSON.parse(req.body);

  switch (event) {
    case 'members:create':
      handleNewPatron(payload.data);
      break;
    case 'members:update':
      handlePatronUpdate(payload.data);
      break;
    case 'members:pledge:update':
      handlePledgeChange(payload.data);
      break;
    case 'posts:publish':
      handleNewPost(payload.data);
      break;
  }

  res.status(200).send('OK');
});

// Real-time Member Management
async function handleNewPatron(memberData) {
  const member = {
    id: memberData.id,
    fullName: memberData.attributes.full_name,
    patronStatus: memberData.attributes.patron_status,
    pledgeAmount: memberData.attributes.currently_entitled_amount_cents,
    joinDate: new Date()
  };

  // Update database
  await database.members.create(member);

  // Trigger real-time updates via Socket.io
  io.emit('patron:new', member);

  // Update user access levels based on tier
  await updateUserAccessLevel(member);
}
```

**Patreon Integration with Bambi Sleep Features:**

```javascript
// Tier-based Feature Access
const accessLevels = {
  1: ['basic_triggers'],
  2: ['basic_triggers', 'collar_controls'],
  3: ['basic_triggers', 'collar_controls', 'session_history'],
  4: ['basic_triggers', 'collar_controls', 'session_history', 'spirals'],
  5: ['basic_triggers', 'collar_controls', 'session_history', 'spirals', 'streaming'],
  6: ['all_features', 'audio_controls', 'playlists'],
  7: ['all_features', 'brainwave_entrainment'],
  8: ['all_features', 'advanced_binaural']
};

async function updateUserAccessLevel(member) {
  const tierAmount = member.pledgeAmount;
  const userLevel = calculateLevelFromAmount(tierAmount);

  const features = accessLevels[userLevel] || ['basic_triggers'];

  await database.users.update(member.userId, {
    patronLevel: userLevel,
    enabledFeatures: features,
    lastPatronUpdate: new Date()
  });
}

// Patron-Only Content Gates
function requirePatronLevel(level) {
  return async (req, res, next) => {
    const user = await getCurrentUser(req);

    if (!user.patronLevel || user.patronLevel < level) {
      return res.status(403).json({
        error: 'Patron access required',
        requiredLevel: level,
        currentLevel: user.patronLevel || 0,
        upgradeUrl: `${process.env.PATREON_CAMPAIGN_URL}/join`
      });
    }

    next();
  };
}

// Protected Routes
app.get('/api/advanced-spirals', requirePatronLevel(4), (req, res) => {
  res.json({ spirals: advancedSpiralConfigs });
});

app.get('/api/binaural-patterns', requirePatronLevel(7), (req, res) => {
  res.json({ patterns: binauralPatterns });
});
```

**Environment Configuration:**

```env
# Patreon API Configuration
PATREON_CLIENT_ID=your_client_id_here
PATREON_CLIENT_SECRET=your_client_secret_here
PATREON_REDIRECT_URI=http://localhost:3000/auth/patreon/callback
PATREON_WEBHOOK_SECRET=your_webhook_secret_here
PATREON_CAMPAIGN_ID=your_campaign_id_here
PATREON_CAMPAIGN_URL=https://www.patreon.com/your_campaign

# Patreon Scopes
PATREON_SCOPES=identity,identity[email],campaigns,campaigns.members,w:campaigns.webhook
```

**Package Dependencies:**

```json
{
  "dependencies": {
    "patreon": "^1.1.1",
    "express": "^4.18.0",
    "crypto": "^1.0.1"
  }
}
```

**Key Benefits:**

- **Creator Monetization**: Direct integration with Patreon's subscription platform
- **Tiered Access Control**: Automatic feature unlocking based on patron support level
- **Real-time Synchronization**: Immediate updates when patrons join, upgrade, or cancel
- **Member Relationship Data**: Rich patron information including payment history and tier entitlements
- **Content Gating**: Protect premium features behind patron tiers
- **Community Building**: Enhanced engagement through patron-exclusive content and features
- **Revenue Analytics**: Access to campaign performance and patron lifetime value data

---

## Status & Next Steps

**Status**: UPGRADED TO MODERN TECH STACK ✅

**Implementation Roadmap**:

1. Initialize project with new dependencies
2. Set up MCP server infrastructure
3. Integrate ElevenLabs agents platform
4. Implement LM Studio structured outputs
5. Deploy hypnosis framework integration
