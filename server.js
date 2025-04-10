import http from 'http';
import { Server } from 'socket.io';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cookieParser from 'cookie-parser';
import { mainRouter, bambiRouter } from './src/routes/index.js';

// Define __dirname first
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import app and other components
import { 
  app as appInstance, // Import the app instance from app.js
  sessionMiddleware, 
  loadFilteredWords,
  initializeScraperSystem,
  initializeWorkerSystem,
  fetchTTSFromKokoro,
  KOKORO_DEFAULT_VOICE
} from './src/app.js';

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Updated static file configuration - use src/public as your static directory
app.use('/js', express.static(path.join(__dirname, 'src/public/js')));
app.use('/css', express.static(path.join(__dirname, 'src/public/css')));
app.use('/images', express.static(path.join(__dirname, 'src/public/images')));
app.use(express.static(path.join(__dirname, 'src/public')));

// Serve socket.io client library
app.use('/socket.io', express.static(path.join(__dirname, 'node_modules/socket.io/client-dist')));

// Make sure Express MIME types are properly set
app.use(express.static(path.join(__dirname, 'src/public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.ico')) {
      res.setHeader('Content-Type', 'image/x-icon');
    }
  }
}));

// Set view engine
app.set('views', path.join(__dirname, 'src/views'));
app.set('view engine', 'ejs');

// Use routes
app.use('/', mainRouter);
app.use('/bambi', bambiRouter);

// IMPORTANT: Mount API routes from app.js
// This makes the TTS API endpoint available
app.use('/api', appInstance._router);

// TTS endpoint to mirror the one in app.js
app.get('/tts', async (req, res) => {
  const text = req.query.text;
  const voice = req.query.voice || KOKORO_DEFAULT_VOICE;

  if (typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'Invalid input: text must be a non-empty string' });
  }

  try {
    const response = await fetchTTSFromKokoro(text, voice);

    // Set appropriate headers
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', response.data.length);
    res.setHeader('Cache-Control', 'no-cache');

    // Send the audio data
    res.send(response.data);
  } catch (error) {
    console.error(`TTS API Error: ${error.message}`);
    return res.status(500).json({
      error: 'Error in TTS service',
      details: error.message
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).render('error', {
    message: err.message,
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Use direct import instead of dynamic import
import { Logger } from './src/utils/logger.js';
import dbConnection from './src/database/dbConnection.js';
import gracefulShutdown from './src/utils/gracefulShutdown.js';

// Import socket handlers
import { setupSocketHandlers } from './src/sockets/handlers/handlers.js';

// Initialize logger
const logger = new Logger('Server');

dotenv.config();

// Create HTTP server and socket.io instance
const server = http.createServer(app);
const io = new Server(server);

// Load filtered words for message filtering
let filteredWords = [];

// Get server network address
function getServerAddress() {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  } catch (error) {
    logger.error('Error in getServerAddress:', error);
    return 'localhost';
  }
}

// Server initialization sequence
async function initializeServer() {
  try {
    // Step 1: Connect to MongoDB
    logger.info('Step 1/5: Connecting to MongoDB...');
    await dbConnection.connect();

    // Step 2: Load filtered words
    logger.info('Step 2/5: Loading filtered words...');
    filteredWords = await loadFilteredWords();
    
    // Step 3: Setup socket handlers
    logger.info('Step 3/5: Setting up socket handlers...');
    setupSocketHandlers(io);
    
    // Step 4: Initialize scrapers and workers
    logger.info('Step 4/5: Initializing subsystems...');
    await initializeScraperSystem();
    await initializeWorkerSystem();

    // Step 5: Start server
    logger.info('Step 5/5: Starting HTTP server...');
    
    // Set up signal handlers for graceful shutdown
    process.on('SIGTERM', async () => {
      await gracefulShutdown('SIGTERM', server);
      await dbConnection.disconnect();
    });
    
    process.on('SIGINT', async () => {
      await gracefulShutdown('SIGINT', server);
      await dbConnection.disconnect();
    });
    
    process.on('uncaughtException', async (err) => {
      logger.error('Uncaught Exception:', err);
      try {
        await gracefulShutdown('UNCAUGHT_EXCEPTION', server);
        await dbConnection.disconnect();
      } catch (error) {
        logger.error('Error during shutdown after uncaught exception:', error);
        process.exit(1);
      }
    });

    const PORT = process.env.SERVER_PORT || 6969;
    server.listen(PORT, async () => {
      logger.success(`Server running on http://${getServerAddress()}:${PORT}`);
      logger.success('Server initialization sequence completed successfully');
    });

    // Inside your connection handler in router.js
    io.on('connection', (socket) => {
      socket.on('connection_info', (info) => {
        logger.info(`Connection type for ${socket.id}: ${info.type}`);
        socket.connectionType = info.type; // 'service-worker' or 'direct'
        
        // You might want different behavior based on connection type
        if (info.type === 'direct') {
          // Maybe more frequent heartbeats for direct connections
          socket.conn.pingInterval = 10000; // 10 seconds instead of default
        }
      });
    });
  } catch (err) {
    logger.error('Error in server initialization sequence:', err);
    process.exit(1);
  }
}

// Start the server
initializeServer();