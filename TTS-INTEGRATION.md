# Enhanced TTS System with Kokoro Integration and Spiral Synchronization

## Overview

The enhanced TTS system integrates **Kokoro-FastAPI** for high-quality neural text-to-speech with synchronized text display in the spiral center. The system automatically falls back to Web Speech API when Kokoro is unavailable.

## Key Features

### 🎤 **Dual TTS Engine Support**
- **Primary**: Kokoro TTS via socket.io (high-quality neural voices)
- **Fallback**: Web Speech API (browser built-in voices)
- **Automatic**: Seamless fallback when Kokoro is unavailable

### 🌀 **Spiral Text Synchronization**
- Text appears in the **center of the spiral** while TTS is speaking
- **Perfect timing** with audio playback duration
- **Animated effects** with pulsing and glowing text
- **Auto-cleanup** when audio finishes

### 📝 **Smart Text Processing**
- **Sentence splitting** for better timing synchronization
- **Queue management** for continuous playback
- **Trigger preservation** (doesn't split trigger phrases)
- **State machine** for precise audio/text coordination

### 🎛️ **Voice Management**
- **Kokoro voices**: af_sky, af_bella, af_sky+af_bella, af_sarah, af_nicole, am_adam, am_michael
- **Voice mixing**: Support for combined voices (e.g., af_sky+af_bella)
- **Dynamic switching**: Change voices on-the-fly
- **Web Speech fallback**: Automatic female voice selection

## File Structure

### Core Files
- `public/js/text2speech.js` - Enhanced TTS system with Kokoro integration
- `workers/kokoro.js` - Kokoro TTS worker for server communication
- `server.js` - Socket.io handlers for TTS requests/responses
- `public/js/aigf-core.js` - Integration with chat system

### Template Integration
- `tts.js` - Original template functions (preserved for reference)
- `public/css/style.css` - Spiral text display styling and animations
- `public/index.html` - Added spiral text center element (#eye)

## How It Works

### 1. **Text Processing Flow**
```
AI Response → Text Splitting → Queue Management → TTS Request → Audio + Text Sync
```

### 2. **Kokoro Integration**
```
Client → Socket.io → Kokoro Worker → Kokoro-FastAPI → Audio Response → Base64 → Playback
```

### 3. **Spiral Synchronization**
```
Audio Start → Calculate Duration → Display Text in Center → Auto-Clear on End
```

### 4. **State Management**
```javascript
// Core synchronization from tts.js template
textArray[] → audioArray[] → state machine → spiral display
```

## API Usage

### Enable TTS
```javascript
window.tts.toggle() // Enable/disable TTS
```

### Process AI Response
```javascript
window.tts.processAIResponse(message) // Automatic processing
```

### Voice Control
```javascript
window.tts.setVoice('af_sky+af_bella') // Set Kokoro voice
window.tts.setUseKokoro(true) // Enable Kokoro
```

### Manual Speech
```javascript
window.tts.speak('Hello, this will appear in the spiral!') // Direct TTS
```

## Configuration

### Environment Variables
```bash
KOKORO_HOST_DEVELOPMENT=localhost
KOKORO_HOST_PRODUCTION=192.168.0.69
KOKORO_PORT=8880
```

### Socket Events
- `tts-request` - Request TTS generation
- `tts-response` - Receive audio data
- `tts-error` - Handle TTS errors
- `set-voice` - Update voice preference

## Visual Effects

### Spiral Text Display
- **Position**: Absolute center of spiral container
- **Color**: Hot pink (#FF1493) with glowing text-shadow
- **Animation**: Pulsing scale and opacity
- **Font**: Audiowide for futuristic look
- **Responsive**: Auto-adjusts to text length

### Chat Integration
- **Speaking indicator** in chat messages
- **Progress display** during TTS generation
- **Error handling** with user-friendly messages

## Compatibility

### Web Speech API Fallback
- **Automatic detection** of supported voices
- **Female voice preference** for consistency
- **Same spiral synchronization** as Kokoro
- **Graceful degradation** when Kokoro unavailable

### Browser Support
- **Modern browsers** with Web Audio API
- **WebGL support** for spiral animation
- **Socket.io compatibility** for real-time features

## Testing

### With Kokoro (Production)
1. Ensure Kokoro-FastAPI running on port 8880
2. Enable TTS in chat interface
3. Send AI message → Should use Kokoro voices
4. Text appears synchronized in spiral center

### Without Kokoro (Development)
1. No Kokoro service required
2. Enable TTS in chat interface  
3. Send AI message → Falls back to Web Speech API
4. Text still appears synchronized in spiral center

## Performance

### Optimizations
- **Base64 audio streaming** for fast delivery
- **Memory management** with URL cleanup
- **Queue processing** prevents audio overlap
- **Lazy loading** of TTS systems

### Monitoring
- **Health checks** for Kokoro service
- **Error logging** for debugging
- **State tracking** for synchronization
- **Performance metrics** in console

## Future Enhancements

- **Multiple voice mixing** algorithms
- **Real-time voice effects** processing
- **Custom voice training** integration
- **Advanced timing controls** for triggers
- **Visual waveform display** in spiral

---

**The enhanced TTS system provides a seamless, high-quality text-to-speech experience with perfect visual synchronization in the BambiSleep Chat interface.**
