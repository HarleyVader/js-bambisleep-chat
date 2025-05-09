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
import { Server as SocketIOServer } from 'socket.io';
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
import sessionsRouter from './routes/sessions.js';
import { router as triggerScriptsRouter } from './routes/trigger-scripts.js';

// Import worker coordinator
import workerCoordinator from './workers/workerCoordinator.js';

// Import socket handlers
import setupProfileSockets from './sockets/profileSockets.js';
import setupChatSockets from './sockets/chatSockets.js';
import setupLMStudioSockets from './sockets/lmStudioSockets.js';

// Import utilities and middleware
import Logger from './utils/logger.js';
import gracefulShutdown from './utils/gracefulShutdown.js';
import { startConnectionMonitoring } from './utils/connectionMonitor.js';

// Import server utilities
import { parseCookies, getBambiNameFromCookies, } from './utils/cookie-utils-server.js';

// Import models
import { SessionHistory, getProfile } from './models/models.js';

// Initialize environment and paths
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logger
const logger = new Logger('Server');
logger.info('Starting BambiSleep.chat server...');

// Global socket store
const socketStore = new Map();

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

    // Initialize Socket.io with configured timeouts and proper CORS settings
    const io = new SocketIOServer(server, {
      pingTimeout: config.SOCKET_PING_TIMEOUT || 86400000, // 1 day in milliseconds
      pingInterval: config.SOCKET_PING_INTERVAL || 25000,
      cors: {
        origin: config.ALLOWED_ORIGINS || 'https://bambisleep.chat', // Allow any origin in development
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Content-Type']
      },
      transports: ['websocket', 'polling'], // Explicitly support both transports
      allowUpgrades: true,
      perMessageDeflate: {
        threshold: 1024 // Only compress messages larger than 1KB
      },
      maxHttpBufferSize: 5e6, // 5MB - for larger payloads
      connectTimeout: 45000 // 45 seconds connection timeout
    });

    // Make socket store accessible from io for use in disconnect handling
    io.sockets.socketStore = socketStore;

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

    // Set up socket handlers
    setupSocketHandlers(io, socketStore, filteredWords);

    // Set up error handlers
    app.use((err, req, res, next) => {
      logger.error('Express error handler:', err);

      res.status(err.status || 500).render('error', {
        message: err.message || 'Internal Server Error',
        error: config.NODE_ENV === 'development' ? err : {},
        validConstantsCount: 5,
        title: 'Error'
      });
    });

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
function setupRoutes(app) {
  // Register main routes
  const routes = [
    { path: '/', handler: indexRoute },
    { path: '/psychodelic-trigger-mania', handler: psychodelicTriggerManiaRouter },
    { path: '/help', handler: helpRoute },
    { path: '/scrapers', handler: scrapersRoute },
    { path: '/profile', handler: profileRouter },
    { path: '/trigger-script', handler: triggerScriptsRouter },
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

  // Add health check endpoint
  setupHealthCheckRoutes(app);

  // Add routes for client-side rendering data
  setupClientDataRoutes(app);

  // Add TTS API routes
  setupTTSRoutes(app);

  // Add API routes
  app.use('/api', apiRoutes);

  // Add sessions routes
  app.use('/sessions', sessionsRouter); // Use the hardcoded path

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
 * Set up health check routes for monitoring
 * 
 * @param {Express} app - Express application instance
 */
function setupHealthCheckRoutes(app) {
  // Simple ping endpoint
  app.get('/health/ping', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: Date.now() });
  });

  // Detailed health check including DB and worker status
  app.get('/health/status', async (req, res) => {
    try {
      const memoryUsage = process.memoryUsage();
      const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
      const workersStatus = await workerCoordinator.getStatus();

      // Get socket stats
      const socketStats = {
        connections: socketStore.size,
        oldest: 0,
        newest: 0
      };

      if (socketStore.size > 0) {
        const now = Date.now();
        let youngest = Infinity;
        let oldest = 0;

        for (const socketData of socketStore.values()) {
          const age = now - socketData.connectedAt;
          youngest = Math.min(youngest, age);
          oldest = Math.max(oldest, age);
        }

        socketStats.oldest = Math.round(oldest / 1000);
        socketStats.newest = Math.round(youngest / 1000);
      }

      res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: Date.now(),
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024)
        },
        database: {
          status: dbStatus,
          connectionId: mongoose.connection.id
        },
        workers: workersStatus,
        sockets: socketStats
      });
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(500).json({
        status: 'error',
        error: error.message,
        timestamp: Date.now()
      });
    }
  });
}

/**
 * Set up client-side data routes
 * 
 * @param {Express} app - Express application instance
 */
function setupClientDataRoutes(app) {
  // Get chat messages
  app.get('/api/chat/messages', async (req, res) => {
    try {
      // Get requested limit with default of 50
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);

      // Use the updated model method which handles connections properly
      const ChatMessage = mongoose.model('ChatMessage');
      const messages = await ChatMessage.getRecentMessages(limit);

      res.json({ messages });
    } catch (error) {
      logger.error('Error fetching chat messages:', error);
      res.status(500).json({ error: 'Error fetching messages', messages: [] });
    }
  });

  // Get profile system controls
  app.get('/api/profile/:username/system-controls', async (req, res) => {
    try {
      const username = req.params.username;

      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }

      // Fetch profile data using the withDbConnection helper
      const profile = await withDbConnection(() => getProfile(username));

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
      logger.error(`Error fetching profile system controls for ${req.params.username}:`, error);
      res.status(500).json({
        error: 'Error fetching profile data',
        activeTriggers: []
      });
    }
  });

  // Performance metrics API endpoint
  app.post('/api/performance', (req, res) => {
    try {
      const metrics = req.body;

      // Log summary of metrics if available
      if (metrics && metrics.summary) {
        logger.info(`Performance metrics from client: ${JSON.stringify(metrics.summary)}`);
      }

      // You could store metrics in a database for later analysis

      res.json({ success: true });
    } catch (error) {
      logger.error('Error processing performance metrics:', error);
      res.status(500).json({ error: 'Error processing metrics' });
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
      const username = getBambiNameFromCookies(socket.handshake.headers.cookie) || 'anonBambi';

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

      // Set username on socket for easy access
      socket.bambiUsername = username;

      // Set up content filter function
      const filterContent = (content) => filterWords(content, filteredWords);

      // Set up socket handlers for this specific connection
      setupLMStudioSockets(socket, io, lmstudio, filterContent);
      setupProfileSockets(socket, io, username);
      setupChatSockets(socket, io, socketStore, filteredWords);

      // Handle disconnection
      socket.on('disconnect', () => handleSocketDisconnect(socket, io));

      // Handle session-related events
      setupSessionEvents(socket, lmstudio);

      // Update activity timestamp on any event
      const originalEmit = socket.emit;
      socket.emit = function () {
        const socketData = socketStore.get(socket.id);
        if (socketData) {
          socketData.lastActivity = Date.now();
        }
        return originalEmit.apply(socket, arguments);
      };

      // Track user activity by monitoring events
      socket.onAny(() => {
        const socketData = socketStore.get(socket.id);
        if (socketData) {
          socketData.lastActivity = Date.now();
        }
      });
    } catch (error) {
      logger.error(`Error handling socket connection: ${error.message}`);
    }
  });

  // Set up periodic monitoring of socket connections
  setInterval(() => {
    const now = Date.now();
    const idleTimeout = config.SOCKET_IDLE_TIMEOUT || 7200000; // 2 hours default

    // Check for idle sockets
    for (const [socketId, socketData] of socketStore.entries()) {
      const idleTime = now - socketData.lastActivity;

      // If socket has been idle for too long, disconnect it
      if (idleTime > idleTimeout) {
        logger.info(`Auto-disconnecting idle socket: ${socketId} (${socketData.username}), idle for ${Math.round(idleTime / 1000 / 60)}m`);
        try {
          socketData.socket.disconnect(true);
        } catch (error) {
          logger.error(`Error disconnecting idle socket: ${error.message}`);
          // Clean up anyway
          cleanupSocket(socketId, socketData);
        }
      }
    }
  }, 300000); // Check every 5 minutes
}

/**
 * Clean up socket resources
 * 
 * @param {string} socketId - Socket ID
 * @param {Object} socketData - Socket data from store
 */
function cleanupSocket(socketId, socketData) {
  try {
    if (socketData.worker) {
      socketData.worker.terminate();
    }
    socketStore.delete(socketId);
    logger.info(`Socket resources cleaned up: ${socketId}`);
  } catch (error) {
    logger.error(`Error cleaning up socket resources: ${error.message}`);
  }
}

/**
 * Handle socket disconnection and clean up worker
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {SocketIO.Server} io - Socket.io server instance
 */
function handleSocketDisconnect(socket, io) {
  try {
    // Get the socket store from io object
    const socketStore = io.sockets.socketStore;
    if (!socketStore) {
      logger.error('Socket store not available in disconnect handler');
      return;
    }

    io.emit('user_disconnect', { userId: socket.id });

    // Get the socket data
    const socketData = socketStore.get(socket.id);
    if (!socketData) {
      logger.warning(`No socket data found for disconnecting socket: ${socket.id}`);
      return;
    }

    const username = socketData.username || socket.bambiUsername || 'unknown';

    // Log the disconnect with details
    logger.info(`Client disconnected: ${socket.id} (${username}) - Reason: ${socket.disconnectReason || 'unknown'}`);

    // Set up worker cleanup with confirmation pattern
    if (socketData.worker) {
      try {
        // Set up a message handler for cleanup confirmation
        const messageHandler = (message) => {
          if (message && message.type === 'cleanup:complete' && message.socketId === socket.id) {
            logger.info(`Worker cleanup confirmed: ${socket.id} (${username})`);
            cleanup();
          }
        };

        // Function to perform final cleanup
        const cleanup = () => {
          try {
            // Remove message handler
            socketData.worker.removeListener('message', messageHandler);

            // Terminate worker
            socketData.worker.terminate();
            logger.info(`Worker terminated: ${socket.id} (${username})`);

            // Remove from socket store
            socketStore.delete(socket.id);
            logger.info(`Socket removed from store: ${socket.id} (${username})`);
          } catch (error) {
            logger.error(`Error in socket cleanup: ${error.message}`);
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
          logger.warning(`Worker cleanup timeout: ${socket.id} (${username})`);
          cleanup();
        }, config.WORKER_CLEANUP_TIMEOUT || 5000);

        // Store timeout ID for cancellation if needed
        socketData.cleanupTimeoutId = timeoutId;

      } catch (error) {
        logger.error(`Error in worker cleanup: ${error.message}`);

        // Clean up anyway
        socketStore.delete(socket.id);
      }
    } else {
      // No worker, just remove the socket
      socketStore.delete(socket.id);
      logger.info(`Socket removed from store: ${socket.id} (${username})`);
    }
  } catch (error) {
    logger.error(`Error in handleSocketDisconnect: ${error.message}`);
  }
}

/**
 * Session-related socket event handlers
 *
 * @param {Socket} socket - Socket.io socket instance
 * @param {Worker} lmstudio - Worker thread for LM Studio operations
 */
function setupSessionEvents(socket, lmstudio) {
  // Load session
  socket.on('load-session', function (sessionId) {
    if (!sessionId) return;

    withDbConnection(async () => {
      try {
        const session = await SessionHistory.findById(sessionId);

        if (!session) {
          socket.emit('session-error', { message: 'Session not found' });
          return;
        }

        // Send to worker
        lmstudio.postMessage({
          type: "load-history",
          messages: session.messages || [],
          socketId: socket.id,
          username: socket.bambiUsername,
          sessionId: sessionId
        });

        // Send to client
        socket.emit('session-loaded', {
          session,
          sessionId,
          metadata: session.metadata || {}
        });

        // Update last activity
        await SessionHistory.findByIdAndUpdate(sessionId, {
          $set: { 'metadata.lastActivity': new Date() }
        });

        // Track this in user activity
        const socketData = socketStore.get(socket.id);
        if (socketData) {
          socketData.lastActivity = Date.now();
          socketData.currentSessionId = sessionId;
        }

      } catch (error) {
        logger.error(`Session load error: ${error.message}`);
        socket.emit('session-error', { message: 'Error loading session' });
      }
    });
  });

  // Save session
  socket.on('save-session', function (data) {
    if (!data || !socket.bambiUsername || socket.bambiUsername === 'anonBambi') {
      socket.emit('session-error', { message: 'Cannot save session: not logged in' });
      return;
    }

    withDbConnection(async () => {
      try {
        let sessionId = data.sessionId;

        if (sessionId) {
          // Update existing
          const result = await SessionHistory.findByIdAndUpdate(sessionId, {
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
          }, { new: true });

          if (!result) {
            socket.emit('session-error', { message: 'Session not found' });
            return;
          }

          socket.emit('session-saved', { sessionId });

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
              spiralSettings: data.settings?.spiralSettings || {},
              createdAt: new Date(),
              lastActivity: new Date()
            }
          });

          await session.save();

          // Update socket data with current session
          const socketData = socketStore.get(socket.id);
          if (socketData) {
            socketData.currentSessionId = session._id;
          }

          socket.emit('session-created', {
            sessionId: session._id,
            title: session.title
          });
        }
      } catch (error) {
        logger.error(`Session save error: ${error.message}`);
        socket.emit('session-error', { message: 'Error saving session' });
      }
    });
  });

  // Delete session
  socket.on('delete-session', function (sessionId) {
    if (!sessionId || !socket.bambiUsername || socket.bambiUsername === 'anonBambi') {
      socket.emit('session-error', { message: 'Cannot delete session: not logged in' });
      return;
    }

    withDbConnection(async () => {
      try {
        // Verify ownership
        const session = await SessionHistory.findOne({
          _id: sessionId,
          username: socket.bambiUsername
        });

        if (!session) {
          socket.emit('session-error', { message: 'Session not found or not yours' });
          return;
        }

        // Delete session
        await SessionHistory.findByIdAndDelete(sessionId);

        // Clear current session if it was this one
        const socketData = socketStore.get(socket.id);
        if (socketData && socketData.currentSessionId === sessionId) {
          delete socketData.currentSessionId;
        }

        socket.emit('session-deleted', { sessionId });

      } catch (error) {
        logger.error(`Session delete error: ${error.message}`);
        socket.emit('session-error', { message: 'Error deleting session' });
      }
    });
  });

  // Get sessions list
  socket.on('get-sessions', function () {
    if (!socket.bambiUsername || socket.bambiUsername === 'anonBambi') {
      socket.emit('sessions-list', { sessions: [] });
      return;
    }

    withDbConnection(async () => {
      try {
        const sessions = await SessionHistory.find({
          username: socket.bambiUsername
        }).sort({ 'metadata.lastActivity': -1 }).select({
          _id: 1,
          title: 1,
          'metadata.createdAt': 1,
          'metadata.lastActivity': 1,
          'metadata.triggers': 1
        });

        socket.emit('sessions-list', { sessions });

      } catch (error) {
        logger.error(`Get sessions error: ${error.message}`);
        socket.emit('sessions-list', { sessions: [] });
      }
    });
  });
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
 * Helper function to get profile by username
 * 
 * @param {string} username - Username to fetch profile for
 * @returns {Promise<Object>} - Profile object
 */
async function getProfileByUsername(username) {
  try {
    const profile = await getProfile(username);

    if (!profile) {
      logger.warning(`Profile not found for username: ${username}`);
      return null;
    }

    return profile;
  } catch (error) {
    logger.error(`Error fetching profile for ${username}: ${error.message}`);
    throw error;
  }
}

/**
 * Run connection test
 * 
 * @returns {Promise<Object>} - Connection test results
 */
function runConnectionTest() {
  const results = {
    serverReachable: false,
    webSocketSupported: 'WebSocket' in window,
    networkOnline: navigator.onLine,
    testTime: new Date().toLocaleTimeString()
  };
  
  // Create promise for server test
  const serverTest = new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        results.serverStatus = xhr.status;
        results.serverReachable = xhr.status >= 200 && xhr.status < 300;
        resolve();
      }
    };
    xhr.onerror = function() {
      results.serverReachable = false;
      results.serverError = 'Network error';
      resolve();
    };
    // Fix: Use the correct health check endpoint that exists in server.js
    xhr.open('GET', '/health/ping', true);
    xhr.timeout = 5000;
    xhr.ontimeout = function() {
      results.serverReachable = false;
      results.serverError = 'Timeout';
      resolve();
    };
    xhr.send();
  });
  
  // Return results when tests complete
  return serverTest.then(() => {
    console.log('Connection test results:', results);
    return results;
  });
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

    // Add connection monitoring
    const monitoringInterval = process.env.NODE_ENV === 'production' ? 300000 : 60000;
    startConnectionMonitoring(monitoringInterval);

    // Set up resource monitoring
    setInterval(monitorResources, 600000); // Every 10 minutes

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

// Collar requires level 3
if (req.body.collarEnabled && !isFeatureUnlocked('collar', userLevel)) {
  return res.status(403).json({
    success: false,
    message: 'You need to reach level 3 to use the collar feature'
  });
}