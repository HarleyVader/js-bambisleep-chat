# BambiSleep Chat

[![Test Suite](https://github.com/HarleyVader/js-bambisleep-chat/actions/workflows/test.yml/badge.svg)](https://github.com/HarleyVader/js-bambisleep-chat/actions/workflows/test.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern real-time chat application with psychedelic visual effects, text-to-speech, and trigger word detection. Built with Node.js, Express, Socket.io, and Vanilla JavaScript.

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

### Quick Install

**One-Line Install (Recommended):**

```bash
# Linux/macOS
curl -fsSL https://raw.githubusercontent.com/HarleyVader/js-bambisleep-chat/production/install.sh | bash

# Windows PowerShell
iwr https://raw.githubusercontent.com/HarleyVader/js-bambisleep-chat/production/install.ps1 | iex
```

**Manual Installation:**

```bash
git clone https://github.com/HarleyVader/js-bambisleep-chat.git
cd js-bambisleep-chat
npm install
npm start
```

**Access:** Navigate to `http://localhost:7878`

### Development Mode

Run with hot reload:

```bash
npm run dev
```

Starts both backend server (port 7878) and frontend dev server (port 5173).

## Project Structure

```tree
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
PORT=7878                    # Server port
NODE_ENV=development         # Environment mode
TTS_PROVIDER=               # TTS service (optional)
TTS_API_KEY=                # TTS API key (optional)
MAX_MESSAGE_LENGTH=500      # Message length limit
CHAT_HISTORY_LIMIT=100      # Chat history size
```

### Official BambiSleep Triggers

The application uses official BambiSleep triggers from the knowledge base:

- Loaded dynamically via `/api/triggers/json` API endpoint
- Source: [BambiSleep Triggers](https://bambisleep.info/Triggers)
- Includes: Sleep, Good Girl, Blank and Empty, Obey, Focus, Freeze, and more
- NO HARDCODED TRIGGERS - Only official BambiSleep triggers are supported

All triggers are loaded from the official BambiSleep trigger definitions.

## API Endpoints

- `GET /` - Main chat interface
- `GET /api/health` - Server health check
- `GET /api/health` - Server health check
- `GET /api/history` - Chat message history
- `GET /api/triggers` - Get trigger metadata and counts
- `GET /api/triggers/json` - Get raw triggers.json data
- `GET /api/triggers/category/:category` - Get triggers by category
- `GET /api/triggers/details/:triggerName` - Get specific trigger details
- `POST /api/triggers` - Disabled (only official triggers supported)
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

⚠️ **NOTICE: Trigger modification is disabled** - This system uses exclusively official BambiSleep triggers from [BambiSleep.info](https://bambisleep.info/Triggers)

```javascript
// Access official triggers via API
fetch('/api/triggers/json')
    .then(response => response.json())
    .then(data => console.log(data.triggers));

// Get triggers by category
fetch('/api/triggers/category/primary')
    .then(response => response.json())
    .then(data => console.log(data.triggers));
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

## Production Deployment

### Enterprise Automation

The project includes comprehensive production deployment automation with SystemD service management:

#### Automated Deployment

```bash
# Production deployment with full automation
node scripts/deploy.js

# Validate service health
node scripts/validate-service.js
```

**Deployment Features:**
- **Environment Validation**: Node.js 20+ LTS requirement checks
- **SystemD Integration**: Automatic service file generation and management
- **Health Monitoring**: Comprehensive endpoint validation and uptime checks
- **Git Integration**: Automatic deployment detection and branch validation
- **Process Management**: PID monitoring, memory usage, and resource tracking
- **Rollback Safety**: Automatic backup and restoration capabilities

#### SystemD Service Management

The deployment creates a robust SystemD service:

```bash
# Service status and management
sudo systemctl status bambisleepchat
sudo systemctl start bambisleepchat
sudo systemctl stop bambisleepchat
sudo systemctl restart bambisleepchat

# View service logs
journalctl -u bambisleepchat -f
```

#### Production Configuration

Automatic environment optimization:
- **Port Configuration**: Production port management (default: 7878)
- **Process Monitoring**: CPU and memory usage tracking
- **Error Handling**: Comprehensive error logging and recovery
- **Security Hardening**: Production-ready security configurations
- **Performance Tuning**: Optimized for high-concurrency chat operations

#### Health Monitoring

Built-in health validation system:
```bash
# Check all endpoints and service health
GET /api/health
GET /api/triggers
GET /api/history

# Service metrics
GET /api/metrics  # CPU, memory, uptime
```

#### External Service Integration

**Kokoro TTS Server**: Production-ready FastAPI deployment
- Health endpoint: `GET /health`
- Voice mixing: `af_bella+af_sky` syntax support
- OpenAI-compatible API: `/v1/audio/speech`

**LM Studio**: Local AI chat integration
- Model management and loading
- Chat completions via `/v1/chat/completions`
- Automatic failover and retry logic

### Manual Deployment

For custom deployment scenarios:

1. **Production Build:**
```bash
npm run build
NODE_ENV=production npm start
```

2. **Environment Setup:**
```bash
# Copy and configure production environment
cp config/env.js.example config/env.js
# Edit production URLs and settings
```

3. **Service Configuration:**
```bash
# Create SystemD service file
sudo cp bambisleepchat.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable bambisleepchat
```

### Deployment Validation

The project includes enterprise-grade validation:
- **Test Suite**: 90.9% success rate (20/22 tests passing)
- **Environment Tests**: Node.js version, dependencies, configuration
- **Stability Tests**: Memory leaks, connection handling, error recovery
- **Resource Tests**: Performance monitoring, load testing, optimization

## 📚 Deployment Documentation

### Quick References
- **[QUICK-DEPLOY.md](QUICK-DEPLOY.md)** - Quick reference card for rapid deployment
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete step-by-step production deployment guide
- **[install.sh](install.sh)** - Automated Linux/macOS installation script
- **[install.ps1](install.ps1)** - Windows PowerShell installation script

### Automated Deployment
```bash
# Production deployment with full automation
node scripts/deploy.js

# Validate deployment health
node scripts/validate-service.js
```

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

## Testing

The project includes a comprehensive test suite covering environment validation, stability, and resource usage.

### Quick Start Testing

## Testing

```bash
# Run all tests
npm test

# Clean build artifacts
npm run clean
```

Tests automatically generate reports in `tests/reports/`.

### CI/CD

GitHub Actions automatically runs tests on every push and pull request.

### Troubleshooting Tests

If tests fail, see `tests/TROUBLESHOOTING.md` for common solutions:
- Environment setup issues
- Port conflicts
- External service configuration
- Platform-specific problems

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

## Contributing **Enjoy the hypnotic chat experience! 🌀💖**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---
