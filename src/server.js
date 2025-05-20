import { promises as fsPromises } from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';

// Import modules
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import mongoose from 'mongoose';
import { Worker } from 'worker_threads';

// Import configuration
import config from './config/config.js';
import footerConfig from './config/footer.config.js';
import { connectDB, withDbConnection } from './config/db.js';

// Import routes
import indexRoute from './routes/index.js';
import psychodelicTriggerManiaRouter from './routes/psychodelic-trigger-mania.js';
import helpRoute from './routes/help.js';
import profileRouter from './routes/profile.js';
import chatRouter from './routes/chat.js';
import advancedChatRouter from './routes/advancedChat.js';
import chatRoutes from './routes/chatRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import { router as triggerScriptsRouter } from './routes/trigger-scripts.js';
import { router as mongodbRoutesRouter } from './routes/mongodbRoutes.js';
import { router as mongodbAdminRouter } from './routes/mongodbAdminRoute.js';

const mongodbBasePath = '/mongodb';
const mongodbAdminBasePath = '/admin/mongodb';

// Import socket handlers
import setupProfileSockets from './sockets/profileSockets.js';
import setupChatSockets from './sockets/chatSockets.js';
import setupLMStudioSockets from './sockets/lmStudioSockets.js';
import setupSessionSockets from './sockets/sessionSockets.js';

// Import utilities and middleware
import errorHandler from './middleware/error.js';
import Logger from './utils/logger.js';
import gracefulShutdown from './utils/gracefulShutdown.js';
import { startConnectionMonitoring } from './utils/connectionMonitor.js';
import garbageCollector from './utils/garbageCollector.js';
import memoryMonitor from './utils/memory-monitor.js';
import { setupSocketMonitoring } from './utils/socketMonitor.js';
import messageQueue from './utils/messageQueue.js';
import streamingHandler from './utils/streamingHandler.js';
import { startDbHealthMonitor, stopDbHealthMonitor } from './utils/dbHealthMonitor.js';
import { startConnectionPoolMonitor, stopConnectionPoolMonitor } from './utils/connectionPoolMonitor.js';

// Import Profile model getter
import { getProfile } from './models/Profile.js';

// Add this before initializing routes
import './models/SessionHistory.js';

// Import session recovery utility
import SessionRecovery from './utils/sessionRecovery.js';

// Import scheduled tasks
import scheduledTasks from './utils/scheduledTasks.js';

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
    const io = new SocketIOServer(server, {
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

    // Verify DB connection before proceeding
    if (mongoose.connection.readyState !== 1) {
      logger.warning('Database not connected during app initialization, trying to reconnect...');
      const dbConnected = await connectDB(2);
      if (!dbConnected) {
        logger.warning('Could not establish database connection, some features may not work properly');
      }
    }

    // Set up view engine
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));

    // Configure middleware
    setupMiddleware(app);
    
    // Make config available to templates
    app.locals.footer = footerConfig;
    
    // Set up routes and APIs
    setupRoutes(app);
    
    // Include client-side memory monitoring script
    app.get('/js/memory-monitoring.js', (req, res) => {
      res.type('text/javascript').send(memoryMonitor.getClientScript());
    });

    // Set up socket handlers with shared store for workers
    const socketStore = new Map();
    setupSocketHandlers(io, socketStore, filteredWords);
    
    // Set up error handlers
    setupErrorHandlers(app);
    
    // Initialize scheduled tasks
    scheduledTasks.initialize();
    global.scheduledTasks = scheduledTasks;
    
    return { app, server, io, socketStore };
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

  app.get('/config/triggers.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'config/triggers.json'));
  });
  
  logger.info('Middleware configured');
}

/**
 * Configure routes for the application
 * 
 * @param {Express} app - Express application instance
 */
function setupRoutes(app) {    // Register main routes  
  const routes = [
    { path: '/', handler: indexRoute },
    { path: '/chat', handler: chatRouter },
    { path: '/advanced-chat', handler: advancedChatRouter },
    { path: '/psychodelic-trigger-mania', handler: psychodelicTriggerManiaRouter },
    { path: '/help', handler: helpRoute },
    { path: '/profile', handler: profileRouter },
    { path: '/trigger-script', handler: triggerScriptsRouter },
    { path: mongodbBasePath, handler: mongodbRoutesRouter },
    { path: mongodbAdminBasePath, handler: mongodbAdminRouter }
  ];
  
  routes.forEach(route => {
    app.use(route.path, route.handler);
  });
  
  // Add the chat routes
  app.use('/api/chat', chatRoutes);
  
  // Add API routes
  app.use('/api', apiRoutes);
  
  // Add health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const { checkDBHealth } = await import('./config/db.js');
      const dbHealth = await checkDBHealth();
      
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        db: dbHealth,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
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
 * Handle scrape request - PLACEHOLDER for removed functionality
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
function handleScrapeRequest(req, res) {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  res.status(501).json({ 
    error: 'Scraping functionality has been removed',
    message: 'This feature is no longer available'
  });
}

/**
 * Handle directory scan request - PLACEHOLDER for removed functionality
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
function handleScanRequest(req, res) {
  const { directory } = req.body;
  
  if (!directory) {
    return res.status(400).json({ error: 'Directory path is required' });
  }
  
  res.status(501).json({ 
    error: 'Directory scanning functionality has been removed',
    message: 'This feature is no longer available'
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
  // Initialize the LMStudio worker thread
  const lmstudio = new Worker(path.join(__dirname, 'workers/lmstudio.js'));
  
  io.on('connection', (socket) => {
    try {
      // Parse cookies and get username
      const cookies = parseCookies(socket.handshake.headers.cookie);
      let username = decodeURIComponent(cookies['bambiname'] || 'anonBambi').replace(/%20/g, ' ');
      
      logger.info(`Client connected: ${socket.id} (${username})`);
      
      // Store socket in the map with additional tracking data
      socketStore.set(socket.id, { 
        socket, 
        files: [],
        username: username,
        connectedAt: Date.now(),
        lastActivity: Date.now()
      });
      
      // Set username on socket for easy access
      socket.bambiUsername = username;
      
      // Set up content filter function
      const filterContent = (content) => filterWords(content, filteredWords);
      
      // Process any queued messages for this socket
      const processedCount = messageQueue.processQueue(socket);
      if (processedCount > 0) {
        logger.info(`Delivered ${processedCount} queued messages to reconnected socket ${socket.id}`);
      }
      
      // Check for abandoned sessions if user is logged in
      if (username && username !== 'anonBambi') {
        checkForAbandonedSessions(socket, username);
      }
      
      // Set up socket handlers for this specific connection
      setupLMStudioSockets(socket, io, lmstudio, filterContent);
      setupProfileSockets(socket, io, username);
      setupChatSockets(socket, io, socketStore, filteredWords);
      setupSessionSockets(socket, io, socketStore);
      
      // Handle disconnection
      socket.on('disconnect', () => handleSocketDisconnect(socket, io));
      
      // Handle session-related events
      setupSessionEvents(socket);
    } catch (error) {
      logger.error(`Error handling socket connection: ${error.message}`);
    }
  });
}

/**
 * Check for abandoned sessions and notify user
 * 
 * @param {Socket} socket - Socket.io socket instance 
 * @param {string} username - Username to check sessions for
 */
async function checkForAbandonedSessions(socket, username) {
  try {
    const inactiveSessions = await SessionRecovery.findInactiveSessions(username, 30, 3);
    
    if (inactiveSessions && inactiveSessions.length > 0) {
      // Send notification to client about recoverable sessions
      socket.emit('recoverable-sessions', { 
        sessions: inactiveSessions.map(session => ({
          id: session._id,
          title: session.title,
          lastActivity: session.metadata.lastActivity,
          messageCount: session.messages.length
        }))
      });
      
      // Setup recovery handler
      socket.on('recover-session', async (data) => {
        if (!data || !data.sessionId) return;
        
        const recovered = await SessionRecovery.markSessionRecovered(data.sessionId, socket.id);
        
        if (recovered) {
          socket.emit('session-recovered', { 
            sessionId: data.sessionId,
            success: true
          });
        }
      });
    }
  } catch (error) {
    logger.error(`Error checking abandoned sessions: ${error.message}`);
  }
}

// Simplify the setupSessionEvents function
function setupSessionEvents(socket) {
  // Load session
  socket.on('load-session', function(sessionId) {
    if (!sessionId) return;
    
    withDbConnection(async () => {
      try {
        const SessionHistory = mongoose.model('SessionHistory');
        const session = await SessionHistory.findById(sessionId);
        
        if (!session) return;
        
        // Send to client
        socket.emit('session-loaded', { session, sessionId });
        
      } catch (error) {
        logger.error(`Session load error: ${error.message}`);
      }
    });
  });
  
  // Save session
  socket.on('save-session', function(data) {
    if (!data || !socket.bambiUsername || socket.bambiUsername === 'anonBambi') return;
    
    withDbConnection(async () => {
      try {
        const SessionHistory = mongoose.model('SessionHistory');
        
        if (data.sessionId) {
          // Update existing
          await SessionHistory.findByIdAndUpdate(data.sessionId, {
            $set: {
              'metadata.lastActivity': new Date(),
              'metadata.triggers': data.settings?.activeTriggers || [],
              'metadata.collarActive': data.settings?.collarSettings?.enabled || false,
              'metadata.collarText': data.settings?.collarSettings?.text || '',
              'metadata.spiralSettings': data.settings?.spiralSettings || {}
            },
            $push: {
              messages: { $each: data.messages || [] }
            }
          });
          
        } else {
          // Create new
          const session = new SessionHistory({
            username: socket.bambiUsername,
            socketId: socket.id,
            title: data.title || `Session ${new Date().toLocaleString()}`,
            messages: data.messages || [],
            metadata: {
              triggers: data.settings?.activeTriggers || [],
              collarActive: data.settings?.collarSettings?.enabled || false,
              collarText: data.settings?.collarSettings?.text || '',
              spiralSettings: data.settings?.spiralSettings || {}
            }
          });
          
          await session.save();
          socket.emit('session-created', { sessionId: session._id });
        }
      } catch (error) {
        logger.error(`Session save error: ${error.message}`);
      }
    });
  });
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
 * Handle socket disconnection and clean up
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {SocketIO.Server} io - Socket.io server instance
 */
function handleSocketDisconnect(socket, io) {
  try {
    const socketStore = io.sockets.socketStore || new Map();

    io.emit('user_disconnect', { userId: socket.id });

    const socketData = socketStore.get(socket.id);
    const bambiName = socketData?.username || 
                     socket.bambiUsername || 
                     socket.handshake.headers.cookie?.split(';')
                       .find(c => c.trim().startsWith('bambiname='))
                       ?.split('=')[1] || 'unregistered';
    
    const totalConnections = socket.server.engine.clientsCount;
    const activeWorkers = socketStore.size;
    
    const reason = socket.disconnectReason || 'unknown';
    logger.info(`Client disconnected: ${socket.id} (${bambiName}) - Reason: ${reason}`);
    
    socketStore.delete(socket.id);
    const updatedConnections = socket.server.engine.clientsCount;
    logger.info(`Socket removed from store: ${socket.id} (${bambiName}), remaining connections: ${updatedConnections}`);
  } catch (error) {
    logger.error(`Error in handleSocketDisconnect: ${error.message}`);
  }
}

/**
 * Set up error handlers for the application
 * 
 * @param {Express} app - Express application instance
 */
function setupErrorHandlers(app) {
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
  
  const now = Date.now();
  let activeCount = 0;
  let idleCount = 0;
  let longIdleCount = 0;
  
  let youngest = Infinity;
  let oldest = 0;
  
  for (const [socketId, socketData] of socketStore.entries()) {
    const age = now - socketData.connectedAt;
    const idleTime = now - socketData.lastActivity;
    
    youngest = Math.min(youngest, age);
    oldest = Math.max(oldest, age);
    
    if (idleTime < 300000) {
      activeCount++;
    } else if (idleTime < 1800000) {
      idleCount++;
    } else {
      longIdleCount++;
    }
  }
  
  logger.info(`Sockets: ${socketStore.size} total (${activeCount} active, ${idleCount} idle, ${longIdleCount} long idle)`);
  
  if (socketStore.size > 0) {
    logger.info(`Socket age: newest ${Math.round(youngest / 1000 / 60)}m, oldest ${Math.round(oldest / 1000 / 60)}m`);
  }
  
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  logger.info(`Database status: ${dbStatus}`);
}

/**
 * Monitor memory usage and handle potential OOM scenarios
 */
function monitorMemoryForOOM() {
  const memoryUsage = process.memoryUsage();
  const usedHeapRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
  
  if (usedHeapRatio > 0.8) {
    logger.warning(`High memory usage detected: ${Math.round(usedHeapRatio * 100)}% of heap used. Forcing garbage collection.`);
    
    garbageCollector.collect(socketStore);
    
    const now = Date.now();
    for (const [socketId, socketData] of socketStore.entries()) {
      const idleTime = now - (socketData.lastActivity || 0);
      if (idleTime > 1800000) {
        logger.info(`Terminating idle socket ${socketId} to free memory`);
        socketStore.delete(socketId);
      }
    }
  }
}

/**
 * Helper function to fetch messages from the database
 * 
 * @param {number} limit - Maximum number of messages to fetch
 * @returns {Promise<Array>} - Array of messages
 */
async function getMessages(limit = 50) {
  try {
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
    logger.info('Step 1/5: Connecting to MongoDB...');
    const dbConnected = await connectDB(3);
    
    if (!dbConnected) {
      logger.error('Failed to connect to MongoDB after multiple attempts. Server cannot start.');
      process.exit(1);
    }
    
    if (mongoose.connection.readyState !== 1) {
      logger.error('Database connection reported success but connection is not ready. Server cannot start.');
      process.exit(1);
    }
    
    logger.success('MongoDB connection established');
    
    logger.info('Step 2/5: Initializing application...');
    const { app, server, io, socketStore } = await initializeApp();
    logger.success('Application initialized');
    
    logger.info('Step 3/5: Starting HTTP server...');
    const PORT = config.SERVER_PORT || 6969;
    
    server.listen(PORT, () => {
      logger.success(`Server running on http://${getServerAddress()}:${PORT}`);
      logger.success('Server startup completed successfully');
    });
    
    if (process.env.NODE_ENV === 'production') {
      startConnectionMonitoring(300000);
    } else {
      startConnectionMonitoring(60000);
    }
    
    // Start database health monitoring
    startDbHealthMonitor();
    startConnectionPoolMonitor();
    logger.info('Database health and connection pool monitors started');
    
    global.socketStore = socketStore;
    memoryMonitor.start();
    if (process.env.MEMORY_MONITOR_ENABLED === 'true') {
      const monitorInterval = process.env.MEMORY_MONITOR_INTERVAL 
        ? parseInt(process.env.MEMORY_MONITOR_INTERVAL) 
        : (process.env.NODE_ENV === 'production' ? 60000 : 30000);
      
      memoryMonitor.start(monitorInterval);
      logger.info(`Enhanced memory monitoring started (interval: ${monitorInterval}ms) to prevent overnight OOM kills`);
    } else {
      memoryMonitor.start(process.env.NODE_ENV === 'production' ? 60000 : 30000);
      logger.info('Standard memory monitoring started to prevent overnight OOM kills');
    }
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
    process.on('SIGINT', () => gracefulShutdown('SIGINT', server));
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception:', err);
      gracefulShutdown('UNCAUGHT_EXCEPTION', server);
    });
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION', server);
    });
    
    // Store the server and io instances globally for proper shutdown
    global.httpServer = server;
    global.io = io;
    
    // Increase max listeners to prevent warning during rapid shutdown signals
    server.setMaxListeners(25);
    
    return server;
  } catch (error) {
    logger.error('Error during server startup:', error);
    process.exit(1);
  }
}

startServer();

// Handle --expose-gc when provided
if (typeof global.gc === 'function') {
  logger.info('Manual garbage collection enabled');
}