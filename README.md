# BambiSleep Chat

A modern real-time chat application with psychedelic visual effects, text-to-speech, and trigger word detection. Built with Node.js, Express, Socket.io, and p5.js.

## Features

### 🎨 Visual Effects

- **Spiral Animations**: Hypnotic spiral patterns with particle effects
- **Trigger Flashing**: Screen flash effects when trigger words are detected
- **Gradient Backgrounds**: Beautiful animated gradients

### 🔊 Audio Features

- **Text-to-Speech**: Automatic voice synthesis for incoming messages
- **Trigger Sounds**: Audio cues when trigger words are mentioned
- **Volume Control**: Adjustable audio settings

### 💬 Chat Features

- **Real-time Messaging**: Instant message delivery via WebSockets
- **Message History**: Persistent chat history
- **User Count**: Live user counter
- **Trigger Detection**: Customizable trigger word highlighting

### ⚙️ Controls

- Toggle spiral animations on/off
- Enable/disable text-to-speech
- Toggle trigger word system
- Responsive mobile-friendly design

## Quick Start

### Prerequisites

- Node.js v18+
- npm (comes with Node.js)

### Installation

1. **Clone and install dependencies:**

```bash
git clone <repository-url>
cd js-bambisleep-chat
npm install
```

2. **Start the application:**

```bash
npm start
```

3. **Open your browser:**
Navigate to `http://localhost:6969`

### Development Mode

For development with hot reload:

```bash
npm run dev
```

This runs both the backend server and frontend build process concurrently.

## Project Structure

```
js-bambisleep-chat/
├── public/                 # Frontend static files
│   ├── index.html         # Main HTML template
│   ├── css/
│   │   └── style.css      # Styles and animations
│   └── js/
│       ├── aigf-core.js           # Core chat functionality
│       ├── psychodelic-trigger-mania.js  # Spiral animations
│       ├── text2speech.js        # TTS system
│       └── triggers.js           # Trigger word management
├── server.js              # Express server + Socket.io
├── package.json           # Dependencies and scripts
├── vite.config.js         # Vite configuration
├── .env.example          # Environment variables template
└── README.md             # This file
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
PORT=6969                    # Server port
NODE_ENV=development         # Environment mode
TTS_PROVIDER=               # TTS service (optional)
TTS_API_KEY=                # TTS API key (optional)
MAX_MESSAGE_LENGTH=500      # Message length limit
CHAT_HISTORY_LIMIT=100      # Chat history size
```

### Default Trigger Words

The application comes with pre-configured trigger words:

- bambi, bimbo, good girl, pink, spiral
- obey, submit, empty, blank, mindless
- doll, pretty, cute, sleep

Trigger words can be customized via the `/api/triggers` endpoint.

## API Endpoints

- `GET /` - Main chat interface
- `GET /api/health` - Server health check
- `GET /api/history` - Chat message history
- `GET /api/triggers` - Get trigger words list
- `POST /api/triggers` - Update trigger words
- `POST /api/tts` - Text-to-speech endpoint (placeholder)

## Technology Stack

### Backend

- **Node.js** - Runtime environment
- **Express** - Web framework
- **Socket.io** - Real-time communication
- **dotenv** - Environment configuration

### Frontend

- **Vanilla JavaScript** - Core functionality
- **p5.js** - Creative coding and animations
- **Socket.io Client** - Real-time communication
- **Web Speech API** - Text-to-speech
- **CSS3** - Styling and animations

### Build Tools

- **Vite** - Frontend build tool
- **Nodemon** - Development server
- **Concurrently** - Run multiple scripts

## Development

### Adding New Trigger Words

```javascript
// Via API
fetch('/api/triggers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        triggers: ['new', 'trigger', 'words']
    })
});

// Or modify server.js default list
let triggerWords = ['your', 'custom', 'triggers'];
```

### Customizing Animations

Edit `public/js/psychodelic-trigger-mania.js`:

```javascript
// Modify spiral parameters
this.spiralSpeed = 0.02;    // Animation speed
this.maxParticles = 100;    // Particle count
this.colorPhase = 0;        // Color cycling
```

### Styling Changes

Modify `public/css/style.css` to customize:

- Color schemes
- Animation timing
- Layout and typography
- Responsive breakpoints

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (with webkit prefixes)
- **Mobile**: Responsive design works on all devices

## Security Notes

- Messages are not persistent (stored in memory only)
- No user authentication implemented
- CORS enabled for development
- Input sanitization for XSS prevention

## Performance

- Optimized animations with requestAnimationFrame
- Message history limited to prevent memory leaks
- Efficient particle systems
- Responsive canvas resizing

## Troubleshooting

### Common Issues

1. **TTS not working**: Ensure HTTPS or localhost, enable browser microphone permissions
2. **Animations not displaying**: Check browser WebGL support and p5.js loading
3. **Connection issues**: Verify server is running on correct port
4. **Mobile performance**: Reduce particle count for better performance

### Debug Mode

Enable detailed logging:

```bash
NODE_ENV=development npm start
```

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Enjoy the hypnotic chat experience! 🌀💖**
