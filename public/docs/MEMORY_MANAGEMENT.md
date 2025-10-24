# 🛡️ Memory Management & Data Protection Policy

## CRITICAL: User Data is NEVER Deleted

This system has **ZERO-TOLERANCE** for deleting user-generated data. All cleanup operations target **ONLY device cache and technical memory**.

## ✅ What Gets Cleaned (Device Cache Only)

### Client-Side (TTS System - 30s intervals)

- **Blob URLs**: Temporary audio file URLs (`URL.revokeObjectURL()`)
- **Audio Cache**: Oversized audio URL arrays (keeps last 25)
- **Queue Limits**: Text/audio queues (keeps last 50)
- **Web Audio**: Disconnected oscillators and audio contexts

### Server-Side (2min intervals)

- **Stale API Requests**: Timeout expired technical requests
- **Socket References**: Disconnected socket tracking
- **Garbage Collection**: Node.js memory cleanup (`global.gc()`)

### Storage Utils

- **Invalid Entries**: Only corrupted `[object Object]` strings
- **NO user data removal**: Only fixes technical corruption

## ❌ What is NEVER Touched (User Data Protected)

### User Settings & Preferences

- ✅ **TTS Voice Settings**: `localStorage['bambi-tts-voice-state']`
- ✅ **User Preferences**: All `bambi-*` localStorage entries
- ✅ **Dropdown States**: Component settings and selections
- ✅ **User Configurations**: Speed, volume, enable/disable states

### Chat & Communication Data

- ✅ **Chat Messages**: ALL user messages preserved forever
- ✅ **Chat History**: Global, AIGF, legacy message history
- ✅ **User Identities**: Usernames and user tracking
- ✅ **Conversation Context**: AI conversation history

### Application State

- ✅ **Trigger Selections**: User-chosen trigger preferences
- ✅ **AI Settings**: Model preferences and configurations
- ✅ **UI State**: Component visibility and layout preferences

## 🎯 Lightweight Design Principles

### Memory Efficiency Without Data Loss

1. **Cache Rotation**: Keep recent items, rotate out oldest cache
2. **Size Limits**: Prevent runaway memory growth with reasonable limits
3. **Automatic Cleanup**: Regular intervals clean only technical resources
4. **Graceful Degradation**: System works even if cleanup fails

### Resource Monitoring

- **Real-time Monitoring**: 1.5s update intervals via bottom resource monitor
- **Non-intrusive**: Monitoring doesn't affect performance
- **User Visibility**: Users can see memory usage without technical knowledge

## 🔧 Technical Implementation

### TTS Memory Management (text2speech.js)

```javascript
// ✅ SAFE: Only cleans blob URLs
cleanupBlobUrls() {
    this.blobUrls.forEach(url => URL.revokeObjectURL(url));
}

// ❌ DISABLED: Would delete user voice settings
// saveVoiceState() is PROTECTED and never cleaned
```

### Server Memory Management (server.js)

```javascript
// ✅ SAFE: Only cleans technical requests
cleanupPendingRequests() { /* stale API timeouts only */ }

// ❌ DISABLED: Chat history cleanup completely removed
cleanupChatHistory() { return 0; /* NEVER DELETE USER MESSAGES */ }
```

## 📊 Resource Monitor (Bottom-Right UI)

### Real-time Display (1.5s updates)

- **Memory Usage**: JavaScript heap size
- **TTS Queue**: Current queue lengths
- **Blob Count**: Active blob URLs
- **Socket Status**: Connection health

### User Benefits

- **Transparency**: Users see exactly what's being cleaned
- **Peace of Mind**: Proof that user data is preserved
- **Performance**: Real-time memory usage visibility

## 🚀 Performance Impact

### Before Memory Management

- ❌ Blob URLs accumulated indefinitely
- ❌ Unbounded queue growth
- ❌ No memory monitoring
- ❌ Manual cleanup required

### After Memory Management

- ✅ Automatic blob cleanup every 30s
- ✅ Queue size limits prevent runaway growth
- ✅ Real-time monitoring with 1.5s updates
- ✅ Server cleanup every 2min
- ✅ **ALL USER DATA PRESERVED**

## 🛡️ Data Protection Guarantee

> **PROMISE**: This system will NEVER delete, modify, or lose user messages, settings, preferences, or any user-generated content. Only temporary device cache and technical memory are managed.

**User Trust**: The codebase prioritizes user data preservation above all performance considerations.
