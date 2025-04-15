import { promises as fsPromises } from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';

// Import modules
import { Worker } from 'worker_threads';
import { Server } from 'socket.io';
import cors from 'cors';
import axios from 'axios';
import fileUpload from 'express-fileupload';

// Import configuration
import config from './config/config.js';
import footerConfig from './config/footer.config.js';
import { connectDB } from './config/db.js';

// Import routes
import indexRoute from './routes/index.js';
import psychodelicTriggerManiaRouter from './routes/psychodelic-trigger-mania.js';
import helpRoute from './routes/help.js';
import scrapersRoute, { initializeScrapers } from './routes/scrapers.js';
import profileRouter from './routes/profile.js';

// Import worker coordinator
import workerCoordinator from './workers/workerCoordinator.js';

// Import socket handlers
import setupProfileSockets from './sockets/profileSockets.js';
import setupChatSockets from './sockets/chatSockets.js';
import setupLMStudioSockets from './sockets/lmStudioSockets.js';

// Import utilities and middleware
import errorHandler from './middleware/error.js';
import Logger from './utils/logger.js';
import gracefulShutdown from './utils/gracefulShutdown.js';

// Initialize environment and paths
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logger
const logger = new Logger('Server');
logger.info('Starting BambiSleep.chat server...');

/**
 * Main application setup
 * 
 * Initializes Express app, HTTP server, and Socket.io
 * Sets up middleware, routes, and socket handlers
 */
async function initializeApp() {
  try {
    // Create Express app and HTTP server
    const app = express();
    const server = http.createServer(app);
    
    // Initialize Socket.io with configured timeouts
    const io = new Server(server, {
      pingTimeout: config.SOCKET_PING_TIMEOUT || 300000,
      pingInterval: config.SOCKET_PING_INTERVAL || 25000,
      cors: {
        origin: config.ALLOWED_ORIGINS || ['https://bambisleep.chat'],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    // Load filtered words for content moderation
    const filteredWords = JSON.parse(await fsPromises.readFile(
      path.join(__dirname, 'filteredWords.json'), 'utf8'
    ));

    // Set up view engine
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));

    // Configure middleware
    setupMiddleware(app);
    
    // Make config available to templates
    app.locals.footer = footerConfig;
    
    // Set up routes and APIs
    setupRoutes(app);
    
    // Set up socket handlers with shared store for workers
    const socketStore = new Map();
    setupSocketHandlers(io, socketStore, filteredWords);
    
    // Set up error handlers
    setupErrorHandlers(app);
    
    return { app, server, io };
  } catch (error) {
    logger.error('Error in app initialization:', error);
    throw error;
  }
}

/**
 * Configure Express middleware
 * 
 * @param {Express} app - Express application instance
 */
function setupMiddleware(app) {
  // Parse request bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  
  // Enable CORS
  app.use(cors({
    origin: config.ALLOWED_ORIGINS || ['https://bambisleep.chat'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  }));
  
  // Handle file uploads
  app.use(fileUpload({
    limits: { fileSize: config.MAX_UPLOAD_SIZE || (10 * 1024 * 1024) },
    abortOnLimit: true
  }));
  
  // Serve static files with correct MIME types
  app.use('/css', express.static(path.join(__dirname, 'public/css'), {
    setHeaders: (res, path) => {
      if (path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    }
  }));
  
  app.use('/js', express.static(path.join(__dirname, 'public/js'), {
    setHeaders: (res, path) => {
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      }
    }
  }));
  
  app.use('/gif', express.static(path.join(__dirname, 'public/gif')));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/workers', express.static(path.join(__dirname, 'workers')));
  
  // Serve socket.io client script
  app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'node_modules/socket.io/client-dist/socket.io.js'));
  });
  
  // Add backward compatibility redirects
  app.get('/gif/default-header.jpg', (req, res) => {
    res.redirect('/gif/default-header.gif');
  });
  
  logger.info('Middleware configured');
}

/**
 * Configure routes for the application
 * 
 * @param {Express} app - Express application instance
 */
function setupRoutes(app) {
  // Register main routes
  const routes = [
    { path: '/', handler: indexRoute },
    { path: '/psychodelic-trigger-mania', handler: psychodelicTriggerManiaRouter },
    { path: '/help', handler: helpRoute },
    { path: '/scrapers', handler: scrapersRoute },
    { path: '/profile', handler: profileRouter },
  ];
  
  routes.forEach(route => {
    app.use(route.path, route.handler);
  });
  
  // Register API routes that are defined in the scrapers module
  app.use('/api/scraper/submit', scrapersRoute);
  app.use('/api/scraper/vote', scrapersRoute);
  app.use('/api/scraper/comments', scrapersRoute);
  app.use('/api/scraper/comment', scrapersRoute);
  app.use('/api/scraper/submission', scrapersRoute);
  app.use('/api/scraper/stats', scrapersRoute);
  
  // Set up TTS API routes
  setupTTSRoutes(app);
  
  // Add 404 handler
  app.use((req, res) => {
    res.status(404).render('error', {
      message: 'Page not found',
      error: { status: 404 },
      validConstantsCount: 5,
      title: 'Error - Page Not Found'
    });
  });
  
  logger.info('Routes configured');
}

/**
 * Configure Text-to-Speech API routes
 * 
 * @param {Express} app - Express application instance
 */
function setupTTSRoutes(app) {
  // Get voice list
  app.get('/api/tts/voices', async (req, res) => {
    try {
      const response = await axios({
        method: 'get',
        url: `${config.KOKORO_API_URL}/voices`,
        headers: {
          'Authorization': `Bearer ${config.KOKORO_API_KEY}`
        }
      });
      
      res.json(response.data);
    } catch (error) {
      logger.error(`Voice listing error: ${error.message}`);
      res.status(500).json({
        error: 'Error fetching voice list',
        details: process.env.NODE_ENV === 'production' ? null : error.message
      });
    }
  });
  
  // Generate speech
  app.get('/api/tts', async (req, res) => {
    const text = req.query.text;
    const voice = req.query.voice || config.KOKORO_DEFAULT_VOICE;
    
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
      handleTTSError(error, res);
    }
  });
}

/**
 * Handle errors from the TTS API
 * 
 * @param {Error} error - The error that occurred
 * @param {Response} res - Express response object
 */
function handleTTSError(error, res) {
  logger.error(`TTS API Error: ${error.message}`);
  
  if (error.response) {
    const status = error.response.status;
    
    if (status === 401) {
      logger.error('Unauthorized access to Kokoro API - invalid API key');
      return res.status(401).json({ error: 'Unauthorized access' });
    } else {
      // For other error types
      const errorDetails = process.env.NODE_ENV === 'production' ? null : error.message;
      return res.status(status).json({
        error: 'Error generating speech',
        details: errorDetails
      });
    }
  }
  
  return res.status(500).json({
    error: 'Unexpected error in TTS service',
    details: process.env.NODE_ENV === 'production' ? null : error.message
  });
}

/**
 * Fetches text-to-speech audio from Kokoro API
 * 
 * @param {string} text - Text to convert to speech
 * @param {string} voice - Voice ID to use
 * @returns {Promise<AxiosResponse>} - Response containing audio data
 */
async function fetchTTSFromKokoro(text, voice = config.KOKORO_DEFAULT_VOICE) {
  try {
    logger.info(`Fetching TTS from Kokoro: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    const requestData = {
      model: "kokoro",
      voice: voice,
      input: text,
      response_format: "mp3"
    };
    
    const response = await axios({
      method: 'post',
      url: `${config.KOKORO_API_URL}/audio/speech`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.KOKORO_API_KEY}`
      },
      data: requestData,
      responseType: 'arraybuffer',
      timeout: config.TTS_TIMEOUT || 30000
    });
    
    return response;
  } catch (error) {
    logger.error(`Error fetching TTS audio: ${error.message}`);
    throw error;
  }
}

/**
 * Handle scrape request
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
function handleScrapeRequest(req, res) {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  workerCoordinator.scrapeUrl(url, (error, results) => {
    if (error) {
      return res.status(500).json({ error: 'Error scraping content' });
    }
    res.json(results);
  });
}

/**
 * Handle directory scan request
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
function handleScanRequest(req, res) {
  const { directory } = req.body;
  
  if (!directory) {
    return res.status(400).json({ error: 'Directory path is required' });
  }
  
  workerCoordinator.scanDirectory(directory, (error, results) => {
    if (error) {
      return res.status(500).json({ error: 'Error scanning directory' });
    }
    res.json(results);
  });
}

/**
 * Set up Socket.io event handlers
 * 
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {Map} socketStore - Map to store socket and worker references
 * @param {string[]} filteredWords - List of words to filter
 */
function setupSocketHandlers(io, socketStore, filteredWords) {
  // Connection event handler
  io.on('connection', (socket) => {
    try {
      // Parse cookies and get username
      const cookies = parseCookies(socket.handshake.headers.cookie);
      let username = decodeURIComponent(cookies['bambiname'] || 'anonBambi').replace(/%20/g, ' ');
      
      logger.info(`Client connected: ${socket.id} (${username})`);
      
      // Create LMStudio worker for this connection
      const lmstudio = new Worker(path.join(__dirname, 'workers/lmstudio.js'));
      
      // Store socket and worker in the map
      socketStore.set(socket.id, { socket, worker: lmstudio, files: [] });
      
      // Set up content filter function
      const filterContent = (content) => filterWords(content, filteredWords);
      
      // Set up modular socket handlers
      setupChatSockets(socket, io, filterContent);
      setupLMStudioSockets(socket, io, lmstudio, filterContent);
      setupProfileSockets(socket, io, username);
      
      // Handle disconnection
      socket.on('disconnect', (reason) => {
        handleSocketDisconnect(socket, socketStore, reason);
      });
      
    } catch (error) {
      logger.error(`Error handling socket connection: ${error.message}`);
    }
  });
  
  logger.info('Socket handlers configured');
}

/**
 * Parse cookies from cookie header string
 * 
 * @param {string} cookieHeader - Cookie header string
 * @returns {Object} - Object with cookie name-value pairs
 */
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  
  return cookieHeader
    .split(';')
    .map(cookie => cookie.trim().split('='))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
}

/**
 * Filter words in content
 * 
 * @param {string} content - Content to filter
 * @param {string[]} filteredWords - Words to filter out
 * @returns {string} - Filtered content
 */
function filterWords(content, filteredWords) {
  try {
    if (typeof content !== 'string') {
      content = String(content);
    }
    
    return content
      .split(' ')
      .map((word) => {
        return filteredWords.includes(word.toLowerCase()) ? '[filtered]' : word;
      })
      .join(' ')
      .trim();
  } catch (error) {
    logger.error('Error in content filter:', error);
    return content;
  }
}

/**
 * Handle socket disconnection
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {Map} socketStore - Map storing socket data
 * @param {string} reason - Disconnection reason
 */
function handleSocketDisconnect(socket, socketStore, reason) {
  logger.info(`Client disconnected: ${socket.id}, Reason: ${reason}`);
  
  try {
    const socketData = socketStore.get(socket.id);
    
    if (socketData && socketData.worker) {
      socketData.worker.terminate();
    }
    
    socketStore.delete(socket.id);
    logger.info(`Socket removed from store. Active sockets: ${socketStore.size}`);
  } catch (error) {
    logger.error(`Error during socket cleanup: ${error.message}`);
  }
}

/**
 * Set up error handlers for the application
 * 
 * @param {Express} app - Express application instance
 */
function setupErrorHandlers(app) {
  // Use the error handler middleware
  app.use(errorHandler);
  
  logger.info('Error handlers configured');
}

/**
 * Get the server's IP address
 * 
 * @returns {string} - Server IP address
 */
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
    logger.error('Error getting server address:', error);
    return 'localhost';
  }
}

/**
 * Main server initialization sequence
 */
async function startServer() {
  try {
    // Step 1: Connect to the database
    logger.info('Step 1/5: Connecting to MongoDB...');
    await connectDB();
    logger.success('MongoDB connection established');
    
    // Step 2: Initialize application
    logger.info('Step 2/5: Initializing application...');
    const { app, server } = await initializeApp();
    logger.success('Application initialized');
    
    // Step 3: Initialize scrapers
    logger.info('Step 3/5: Initializing scrapers...');
    const scrapersInitialized = await initializeScrapers();
    if (scrapersInitialized) {
      logger.success('Scrapers initialized');
    } else {
      logger.warning('Scrapers initialization incomplete - continuing startup');
    }
    
    // Step 4: Initialize worker coordinator
    logger.info('Step 4/5: Initializing worker coordinator...');
    await workerCoordinator.initialize();
    logger.success('Worker coordinator initialized');
    
    // Step 5: Start HTTP server
    logger.info('Step 5/5: Starting HTTP server...');
    const PORT = config.SERVER_PORT || 6969;
    
    server.listen(PORT, () => {
      logger.success(`Server running on http://${getServerAddress()}:${PORT}`);
      logger.success('Server startup completed successfully');
    });
    
    // Set up signal handlers for graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server, workerCoordinator));
    process.on('SIGINT', () => gracefulShutdown('SIGINT', server, workerCoordinator));
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception:', err);
      gracefulShutdown('UNCAUGHT_EXCEPTION', server, workerCoordinator);
    });
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION', server, workerCoordinator);
    });
    
    return server;
  } catch (error) {
    logger.error('Error during server startup:', error);
    process.exit(1);
  }
}

// Start the server
startServer();