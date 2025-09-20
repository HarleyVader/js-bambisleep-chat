# Setup Guide

## System Requirements

### Prerequisites

- **Node.js** v18+ (recommended: v20+)
- **npm** (comes with Node.js)
- **Modern Web Browser** (Chrome, Firefox, Safari, Edge)

### Optional Components

- **LM Studio** - For AI chat functionality
- **Kokoro TTS** - For advanced text-to-speech

## Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd js-bambisleep-chat
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your preferred settings:

```env
# Server Configuration
PORT=6969
NODE_ENV=development

# LM Studio Configuration (Optional)
LMS_HOST=localhost
LMS_PORT=1234
LMS_MODEL=your-model-name

# Kokoro TTS Configuration (Optional)
KOKORO_HOST_DEVELOPMENT=localhost
KOKORO_PORT=8880
KOKORO_API_KEY=your-api-key
KOKORO_DEFAULT_VOICE=af_sky+af_bella

# Application Settings
MAX_MESSAGE_LENGTH=500
CHAT_HISTORY_LIMIT=100
TTS_TIMEOUT=30000
```

### 4. Start the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

### 5. Access the Application

Open your browser and navigate to:
```
http://localhost:6969
```

## Advanced Setup

### LM Studio Integration

1. **Install LM Studio** from [lmstudio.ai](https://lmstudio.ai)

2. **Load a Model**
   - Download a compatible chat model
   - Start LM Studio server on port 1234

3. **Configure Environment**
   ```env
   LMS_HOST=localhost
   LMS_PORT=1234
   LMS_MODEL=your-model-name
   ```

### Kokoro TTS Setup

1. **Install Kokoro TTS Server**
   ```bash
   # Follow Kokoro installation instructions
   # Start server on port 8880
   ```

2. **Configure Environment**
   ```env
   KOKORO_HOST_DEVELOPMENT=localhost
   KOKORO_PORT=8880
   KOKORO_DEFAULT_VOICE=af_sky+af_bella
   ```

### SSL/HTTPS Setup

For production deployment with HTTPS:

1. **Obtain SSL Certificate**
   - Use Let's Encrypt or your certificate provider

2. **Configure HTTPS**
   ```javascript
   // In server.js
   const https = require('https');
   const fs = require('fs');
   
   const options = {
     key: fs.readFileSync('path/to/private-key.pem'),
     cert: fs.readFileSync('path/to/certificate.pem')
   };
   
   https.createServer(options, app).listen(443);
   ```

## Deployment

### Local Development

```bash
npm run dev
```

This starts both the backend server and frontend development server with hot reload.

### Production Deployment

1. **Build Frontend**
   ```bash
   npm run build
   ```

2. **Start Production Server**
   ```bash
   npm start
   ```

3. **Process Management** (Optional)
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start server.js --name bambisleep-chat
   ```

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 6969

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t bambisleep-chat .
docker run -p 6969:6969 bambisleep-chat
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 6969
lsof -i :6969

# Kill the process
kill -9 <PID>
```

#### TTS Not Working
- Ensure browser supports Web Speech API
- Check microphone permissions
- Verify HTTPS or localhost usage

#### AI Chat Not Responding
- Verify LM Studio is running
- Check network connectivity
- Review LM Studio model loading

#### Animations Not Displaying
- Check browser WebGL support
- Verify p5.js library loading
- Check browser console for errors

### Debug Mode

Enable detailed logging:

```env
NODE_ENV=development
DEBUG=*
```

### Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (with webkit prefixes)
- **Mobile**: Responsive design works on all devices

## Performance Optimization

### Frontend Optimization

1. **Reduce Particle Count** for mobile devices
2. **Enable Hardware Acceleration** in browser
3. **Close Unused Browser Tabs** to free resources

### Backend Optimization

1. **Use Process Manager** (PM2) for production
2. **Enable Gzip Compression**
3. **Implement Connection Pooling** for databases

### Network Optimization

1. **Use CDN** for static assets
2. **Enable Browser Caching**
3. **Optimize Image Sizes**

## Security Considerations

### CORS Configuration

Configure CORS for production:

```javascript
app.use(cors({
  origin: ['https://yourdomain.com'],
  credentials: true
}));
```

### Input Sanitization

All user inputs are sanitized to prevent XSS attacks.

### Rate Limiting

Implement rate limiting for API endpoints:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

## Support

For additional help:

1. Check the main documentation
2. Review error logs in browser console
3. Verify all dependencies are installed
4. Ensure environment variables are set correctly

---

*Happy chatting! 🌀💖*