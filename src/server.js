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
import mongoose from 'mongoose';

// Import configuration
import config from './config/config.js';
import footerConfig from './config/footer.config.js';
import { connectDB, withDbConnection } from './config/db.js';

// Import routes
import indexRoute from './routes/index.js';
import psychodelicTriggerManiaRouter from './routes/psychodelic-trigger-mania.js';
import helpRoute from './routes/help.js';
import scrapersRoute, { initializeScrapers } from './routes/scrapers.js';
import profileRouter from './routes/profile.js';
import chatRoutes from './routes/chatRoutes.js';
import apiRoutes from './routes/apiRoutes.js';

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
import { startConnectionMonitoring } from './utils/connectionMonitor.js';

// Import Profile model getter
import { getProfile } from './models/Profile.js';

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
      pingTimeout: config.SOCKET_PING_TIMEOUT || 86400000, // 1 day in milliseconds
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

    // Make sure DB connection and models are loaded first
    await connectDB();

    // Then start worker processes
    await workerCoordinator.initialize();

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
  
  // Add the chat routes
  app.use('/api/chat', chatRoutes);
  
  // Add routes for client-side rendering data
  app.get('/api/chat/messages', async (req, res) => {
    try {
      // Get requested limit with default of 50
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
      
      // Use the updated model method which handles connections properly
      const ChatMessage = mongoose.model('ChatMessage');
      const messages = await ChatMessage.getRecentMessages(limit);
      
      res.json({ messages });
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      res.status(500).json({ error: 'Error fetching messages', messages: [] });
    }
  });

  app.get('/api/profile/:username/system-controls', async (req, res) => {
    try {
      const username = req.params.username;
      
      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }
      
      // Fetch profile data - replace with your actual data fetching logic
      // If you have a Profile model, use it here
      const profile = await getProfileByUsername(username);
      
      if (!profile) {
        return res.status(404).json({ 
          activeTriggers: [],
          message: 'Profile not found' 
        });
      }
      
      // Return system controls data in the format expected by the client renderer
      res.json({
        activeTriggers: profile.activeTriggers || [],
        systemSettings: profile.settings || {},
        xp: profile.xp || 0,
        level: profile.level || 0
      });
    } catch (error) {
      console.error(`Error fetching profile system controls for ${req.params.username}:`, error);
      res.status(500).json({ 
        error: 'Error fetching profile data',
        activeTriggers: [] 
      });
    }
  });

  // Add performance metrics API endpoint
  app.post('/api/performance', (req, res) => {
    try {
      const metrics = req.body;
      
      // Log summary of metrics if available
      if (metrics && metrics.summary) {
        console.log(`Performance metrics from client: ${JSON.stringify(metrics.summary)}`);
      }
      
      // You could store metrics in a database for later analysis
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error processing performance metrics:', error);
      res.status(500).json({ error: 'Error processing metrics' });
    }
  });
  
  // Set up TTS API routes
  setupTTSRoutes(app);
  
  // Add API routes
  app.use('/api', apiRoutes);
  
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
    logger.info(`TTS: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
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
  io.on('connection', (socket) => {
    try {
      // Parse cookies and get username
      const cookies = parseCookies(socket.handshake.headers.cookie);
      let username = decodeURIComponent(cookies['bambiname'] || 'anonBambi').replace(/%20/g, ' ');
      
      logger.info(`Client connected: ${socket.id} (${username})`);
      
      // Create a dedicated LMStudio worker for this connection
      const lmstudio = new Worker(path.join(__dirname, 'workers/lmstudio.js'));
      
      // Store socket and worker in the map with additional tracking data
      socketStore.set(socket.id, { 
        socket, 
        worker: lmstudio, 
        files: [],
        username: username,
        connectedAt: Date.now(),
        lastActivity: Date.now()
      });
      
      // Update last activity time on any message from this socket
      socket.onAny(() => {
        const socketData = socketStore.get(socket.id);
        if (socketData) {
          socketData.lastActivity = Date.now();
        }
      });
      
      // Set up content filter function
      const filterContent = (content) => filterWords(content, filteredWords);
      
      // Set up socket handlers for this specific connection
      setupLMStudioSockets(socket, io, lmstudio, filterContent);
      setupProfileSockets(socket, io, username);
      
      // Set up chat sockets for each connection
      setupChatSockets(socket, io, socketStore, filteredWords);
      
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
 * Handle socket disconnection and clean up worker
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {Map} socketStore - Map storing socket data
 * @param {string} reason - Disconnection reason
 */
function handleSocketDisconnect(socket, socketStore, reason) {
  logger.info(`Client disconnected: ${socket.id}, Reason: ${reason}`);
  
  try {
    const socketData = socketStore.get(socket.id);
    
    // Double-check this is really disconnected
    if (!socket.connected && socketData) {
      if (socketData.worker) {
        try {
          // Set up a one-time message handler for cleanup confirmation
          const messageHandler = (message) => {
            if (message && message.type === 'cleanup:complete' && message.socketId === socket.id) {
              logger.info(`Received cleanup confirmation for socket ${socket.id}`);
              
              // Clean up timeout
              clearTimeout(timeoutId);
              
              // Remove message handler
              socketData.worker.removeListener('message', messageHandler);
              
              // Terminate worker
              try {
                socketData.worker.terminate();
                logger.info(`Worker for socket ${socket.id} terminated after cleanup confirmation`);
              } catch (termError) {
                logger.error(`Error terminating worker: ${termError.message}`);
              }
              
              // Remove from socket store
              socketStore.delete(socket.id);
              logger.info(`Socket removed from store. Active sockets: ${socketStore.size}`);
            }
          };
          
          // Add the message handler
          socketData.worker.on('message', messageHandler);
          
          // Send cleanup request to worker
          socketData.worker.postMessage({
            type: 'socket:disconnect',
            socketId: socket.id,
            requestCleanupConfirmation: true
          });
          
          // Set timeout for worker response
          const timeoutId = setTimeout(() => {
            logger.warning(`Worker for socket ${socket.id} did not confirm cleanup, forcing termination`);
            
            // Remove listener
            socketData.worker.removeListener('message', messageHandler);
            
            // Force terminate
            try {
              socketData.worker.terminate();
              logger.info(`Worker for socket ${socket.id} force-terminated after timeout`);
            } catch (termError) {
              logger.error(`Error force-terminating worker: ${termError.message}`);
            }
            
            // Remove from socket store
            socketStore.delete(socket.id);
            logger.info(`Socket removed from store. Active sockets: ${socketStore.size}`);
          }, config.WORKER_TIMEOUT);
          
        } catch (postError) {
          logger.error(`Error sending disconnect message to worker: ${postError.message}`);
          
          // Try to terminate anyway
          try {
            socketData.worker.terminate();
          } catch (termError) {
            logger.error(`Also failed to terminate worker: ${termError.message}`);
          }
          
          // Rely on garbage collector to clean up this worker later
          socketStore.delete(socket.id);
        }
      } else {
        socketStore.delete(socket.id);
        logger.info(`Socket removed from store. Active sockets: ${socketStore.size}`);
      }
    } else if (socket.connected) {
      logger.warning(`Socket ${socket.id} disconnect handler called but socket still appears connected. Not cleaning up yet.`);
    }
  } catch (error) {
    logger.error(`Error during socket cleanup: ${error.message}`);
    
    // Mark for garbage collection later if cleanup fails
    // We do NOT remove from socket store here to avoid potential data loss on active connections
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
 * Monitor system resources and socket statistics
 */
function monitorResources() {
  const memoryUsage = process.memoryUsage();
  logger.info(`Memory usage: RSS ${Math.round(memoryUsage.rss / 1024 / 1024)}MB, Heap ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}/${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`);
  
  if (!socketStore) return;
  
  // Calculate active vs idle sockets
  const now = Date.now();
  let activeCount = 0;
  let idleCount = 0;
  let longIdleCount = 0;
  
  // Socket ages
  let youngest = Infinity;
  let oldest = 0;
  
  // Calculate socket statistics
  for (const [socketId, socketData] of socketStore.entries()) {
    const age = now - socketData.connectedAt;
    const idleTime = now - socketData.lastActivity;
    
    // Update stats
    youngest = Math.min(youngest, age);
    oldest = Math.max(oldest, age);
    
    if (idleTime < 300000) { // Less than 5 minutes idle
      activeCount++;
    } else if (idleTime < 1800000) { // Less than 30 minutes idle
      idleCount++;
    } else {
      longIdleCount++;
    }
  }
  
  logger.info(`Sockets: ${socketStore.size} total (${activeCount} active, ${idleCount} idle, ${longIdleCount} long idle)`);
  
  if (socketStore.size > 0) {
    logger.info(`Socket age: newest ${Math.round(youngest / 1000 / 60)}m, oldest ${Math.round(oldest / 1000 / 60)}m`);
  }
  
  // Log database connection status
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  logger.info(`Database status: ${dbStatus}`);
}

/**
 * Helper function to fetch messages from the database
 * 
 * @param {number} limit - Maximum number of messages to fetch
 * @returns {Promise<Array>} - Array of messages
 */
async function getMessages(limit = 50) {
  try {
    // Implement this function to fetch messages from your database
    // This is a placeholder - replace with your actual database query
    return [];
  } catch (error) {
    logger.error('Error getting messages:', error);
    throw error;
  }
}

/**
 * Helper function to save a message to the database
 * 
 * @param {Object} message - Message object to save
 * @returns {Promise<boolean>} - True if the message was saved successfully
 */
async function saveMessage(message) {
  try {
    // Implement this function to save messages to your database
    // This is a placeholder - replace with your actual database code
    return true;
  } catch (error) {
    logger.error('Error saving message:', error);
    throw error;
  }
}

/**
 * Helper function to get profile by username
 * 
 * @param {string} username - Username to fetch profile for
 * @returns {Promise<Object>} - Profile object
 */
async function getProfileByUsername(username) {
  return withDbConnection(async () => {
    try {
      const Profile = mongoose.model('Profile');
      const profile = await Profile.findOne({ username });
      
      if (!profile) {
        logger.warning(`Profile not found for username: ${username}`);
        return null;
      }
      
      return profile;
    } catch (error) {
      logger.error(`Error fetching profile for ${username}: ${error.message}`);
      throw error;
    }
  });
}

/**
 * Helper function to get recent messages
 * 
 * @param {number} limit - Maximum number of messages to fetch
 * @returns {Promise<Array>} - Array of recent messages
 */
async function getRecentMessages(limit = 50) {
  // This is a placeholder - replace with your actual message fetching logic
  // For now, return some mock messages for testing
  return [
    { username: 'system', data: 'Welcome to BambiSleep.Chat!', timestamp: Date.now() - 60000 },
    { username: 'bambi', data: 'Hello everyone!', timestamp: Date.now() - 30000 }
  ];
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
    
    // Add connection monitoring in production
    if (process.env.NODE_ENV === 'production') {
      startConnectionMonitoring(300000); // Check every 5 minutes in production
    } else {
      startConnectionMonitoring(60000); // Check every minute in development
    }
    
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