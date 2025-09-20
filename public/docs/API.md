# API Documentation

## Overview

BambiSleep Chat provides several API endpoints for managing chat functionality, triggers, and system status.

## Base URL

All API endpoints are relative to your server base URL:
```
http://localhost:6969/api/
```

## Endpoints

### Health Check

#### `GET /api/health`

Returns server health status and configuration.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-09-19T12:00:00.000Z",
  "uptime": 3600,
  "users": 5,
  "features": {
    "tts": true,
    "ai": true,
    "triggers": true
  }
}
```

### Chat History

#### `GET /api/history`

Retrieve recent chat message history.

**Response:**
```json
{
  "messages": [
    {
      "username": "User123",
      "message": "Hello everyone!",
      "timestamp": "2024-09-19T12:00:00.000Z"
    }
  ],
  "count": 20
}
```

### Triggers

#### `GET /api/triggers`

Get trigger metadata and statistics.

**Response:**
```json
{
  "totalTriggers": 50,
  "categories": ["sleep", "obedience", "focus"],
  "activeTriggers": 15
}
```

#### `GET /api/triggers/json`

Get complete triggers data.

#### `GET /api/triggers/category/:category`

Get triggers by specific category.

**Parameters:**
- `category` - The trigger category name

#### `GET /api/triggers/details/:triggerName`

Get detailed information about a specific trigger.

**Parameters:**
- `triggerName` - The name of the trigger

### AI Chat

#### `POST /api/chat`

Send a message to the AI system.

**Request Body:**
```json
{
  "message": "Hello AI",
  "username": "User123",
  "triggers": ["sleep", "focus"]
}
```

**Response:**
```json
{
  "response": "Hello! How can I help you today?",
  "username": "BambiAI",
  "timestamp": "2024-09-19T12:00:00.000Z"
}
```

### Text-to-Speech

#### `POST /api/tts`

Generate speech audio from text.

**Request Body:**
```json
{
  "text": "Hello world",
  "voice": "af_sky+af_bella",
  "format": "mp3"
}
```

**Response:**
- Audio file (MP3/WAV format)

#### `GET /api/tts/health`

Check TTS service availability.

#### `POST /api/tts/voice`

Set or update TTS voice preferences.

### Collar System

#### `GET /api/collar`

Get current collar status.

#### `POST /api/collar`

Update collar configuration.

## WebSocket Events

The application uses Socket.io for real-time communication.

### Client Events

#### `join-room`
Join the chat room.

#### `send-message`
Send a chat message.

#### `ai-message`
Send a message to AI.

### Server Events

#### `user-joined`
Notification when a user joins.

#### `user-left`
Notification when a user leaves.

#### `new-message`
New chat message received.

#### `ai-response`
AI response received.

#### `trigger-detected`
Trigger word detected in message.

## Error Handling

All API endpoints return appropriate HTTP status codes:

- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

Error responses include:
```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "timestamp": "2024-09-19T12:00:00.000Z"
}
```

## Rate Limiting

Some endpoints may have rate limiting applied:
- Chat messages: 10 per minute
- AI requests: 5 per minute
- TTS requests: 20 per minute

## Authentication

Currently, no authentication is required for API access. This may change in future versions.