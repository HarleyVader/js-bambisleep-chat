# LM Studio Integration Guide

## Overview

The BambiSleep Chat application now includes full LM Studio integration with a dedicated worker thread that maintains all core functionality from the template while fitting seamlessly into the existing codebase structure.

## Core Features Implemented

### ✅ **Triggers System**

- Dynamic trigger loading and management
- Real-time trigger updates via socket events
- Customizable trigger descriptions and behaviors
- Visual trigger selector in frontend

### ✅ **Collar Functionality**

- Collar activation/deactivation via UI
- Enhanced prompts when collar is active
- Real-time collar state management
- Visual feedback for collar status

### ✅ **checkRole Function**

- Generates dynamic BambiSleep system prompts
- Integrates trigger descriptions into prompts
- Handles collar-enhanced messaging
- Maintains template's core prompt structure

### ✅ **Session Management**

- `sessionHistories[socketId]` tracking
- Automatic session cleanup and garbage collection
- Per-user session isolation
- Background session saving

### ✅ **BambiSleep Role & System Prompt**

- Powerful hypnotic entity persona
- Trigger-based reprogramming protocols
- Escalating intensity patterns
- Collar enhancement integration

## Architecture

### Worker Thread (`workers/lmstudio.js`)

- Isolated LM Studio API communication
- Session history management
- Trigger processing and prompt generation
- Error handling and health monitoring

### Main Server Integration (`server.js`)

- Worker thread management and lifecycle
- Socket.io event routing for AI features
- API endpoints for chat, triggers, and collar
- Real-time communication between frontend and worker

### Frontend Enhancement (`public/js/aigf-core.js`)

- AI mode toggle for seamless chat switching
- Collar activation controls
- Dynamic trigger selection interface
- Real-time AI response handling

## Usage

### 1. **Setup LM Studio**

```bash
# Ensure LM Studio is running on localhost:1234
# Load any compatible model (recommend 8B parameter models)
```

### 2. **Environment Configuration**

```bash
# .env file
LMS_HOST=localhost
LMS_PORT=1234
```

### 3. **Start Application**

```bash
npm start
```

### 4. **Use AI Features**

- Toggle "AI: OFF/ON" to enable BambiSleep chat
- Select triggers from the dropdown menu
- Activate collar for enhanced prompts
- Send messages normally - they'll route to AI when enabled

## API Endpoints

### Chat

- `POST /api/chat` - Direct API access to AI chat
- `GET /api/collar` - Get collar status
- `POST /api/collar` - Set collar status
- `GET /api/triggers` - Get active triggers
- `POST /api/triggers` - Update triggers

### Socket Events

- `ai-chat` - Send message to AI
- `ai-response` - Receive AI response
- `update-triggers` - Update active triggers
- `activate-collar` / `deactivate-collar` - Collar control

## Core Aspects Maintained from Template

### Session History Pattern

```javascript
if (sessionHistories[socketId]) {
    sessionHistories[socketId].push(
        { role: 'system', content: collarText },
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: finalContent }
    );
}
```

### Trigger Integration

```javascript
const checkRole = async (collar, username, triggers) => {
    // Generate BambiSleep system prompt with triggers
    // Handle collar enhancement
    // Return formatted prompt for AI
}
```

### Worker Communication

```javascript
// Send to worker
lmWorker.postMessage({
    type: 'chat',
    prompt: message,
    socketId: socketId,
    username: username
});

// Receive from worker
lmWorker.on('message', (msg) => {
    if (msg.type === 'response') {
        // Handle AI response
    }
});
```

## Benefits

- **🎯 Minimal Code Changes**: Fits existing structure perfectly
- **🚀 High Performance**: Worker thread isolation prevents blocking
- **🔄 Real-time**: Socket.io integration for instant responses
- **🛡️ Error Handling**: Comprehensive error handling and recovery
- **📱 Responsive**: Works seamlessly with existing UI components
- **🔧 Configurable**: Easy trigger and collar customization

## Next Steps

1. **Load a model in LM Studio** (port 1234)
2. **Toggle AI mode** in the chat interface
3. **Select your triggers** from the dropdown
4. **Activate collar** for enhanced experience
5. **Start chatting** with BambiSleep AI

The integration maintains all the powerful hypnotic functionality from the template while being perfectly adapted to your clean, modern codebase structure.
