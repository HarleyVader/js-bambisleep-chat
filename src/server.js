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
// Database functions are imported dynamically to prevent circular dependencies

// Import routes
import indexRoute from './routes/index.js';
import psychodelicTriggerManiaRouter from './routes/psychodelic-trigger-mania.js';
import helpRoute from './routes/help.js';

import Logger from './utils/logger.js';
import gracefulShutdown from './utils/gracefulShutdown.js';
import errorHandler from './utils/errorHandler.js';

// Initialize these at the top of the file
const memoryMonitor = {
  start(interval = 60000) {
    this.interval = setInterval(() => this.checkMemory(), interval);
    logger.info(`Memory monitor started with interval ${interval}ms`);
  },
  
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },
  
  checkMemory() {
    const used = process.memoryUsage();
    logger.debug(`Memory usage: RSS ${Math.round(used.rss / 1024 / 1024)}MB, Heap ${Math.round(used.heapUsed / 1024 / 1024)}/${Math.round(used.heapTotal / 1024 / 1024)}MB`);
    
    // Force garbage collection if memory pressure is high
    if (used.heapUsed > used.heapTotal * 0.85) {
      logger.warning('Memory pressure detected, suggesting garbage collection');
      global.gc && global.gc();
    }
  },
  
  getClientScript() {
    return `
      // Memory monitoring client script
      console.log('Memory monitoring active');
      setInterval(() => {
        const memory = performance.memory;
        if (memory) {
          console.log('Memory: ' + Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB / ' + 
                       Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + 'MB');
        }
      }, 60000);
    `;
  }
};

const scheduledTasks = {
  tasks: [],
  initialize() {
    logger.info('Initializing scheduled tasks');
  },
  
  addTask(name, fn, interval) {
    const task = {
      name,
      fn,
      interval,
      timer: setInterval(fn, interval)
    };
    this.tasks.push(task);
    return task;
  },
  
  stopAll() {
    this.tasks.forEach(task => {
      clearInterval(task.timer);
    });
    this.tasks = [];
  },
  
  stop() {
    // Adding alias for stopAll to handle shutdown correctly
    this.stopAll();
  }
};

// Define empty arrays for database routes
const dbRoutes = [];

// Function to monitor database health
function startDbHealthMonitor() {
  const interval = config.DB_HEALTH_CHECK_INTERVAL || 60000;  scheduledTasks.addTask('dbHealthCheck', async () => {    
    try {
      // Import database functions dynamically to prevent circular dependencies
      const { checkAllDatabasesHealth, connectAllDatabases, hasConnection } = await import('./config/db.js');
      
      // First check if connection is available at all
      if (!hasConnection()) {
        logger.warning('Database connection is not available, attempting reconnection');
        try {
          await connectAllDatabases(1);
        } catch (reconnErr) {
          logger.error(`Failed to reconnect to database: ${reconnErr.message}`);
        }
        return;
      }
      
      // Safely check health of all database connections with double protection
      let healthResults;
      try {
        healthResults = await Promise.resolve(checkAllDatabasesHealth()).catch(err => {
          logger.error(`Failed to check database health: ${err.message}`);
          return {
            main: { status: 'error', error: err.message },
            profiles: { status: 'error', error: err.message }
          };
        });
      } catch (innerError) {
        logger.error(`Unexpected error during health check: ${innerError.message}`);
        healthResults = {
          main: { status: 'error', error: innerError.message },
          profiles: { status: 'error', error: innerError.message }
        };
      }
      
      // Log database health status
      for (const [type, status] of Object.entries(healthResults)) {
        if (status.status !== 'healthy' && status.status !== 'connected') {
          logger.warning(`${type} database connection not healthy: ${status.status}`);
            // Try to reconnect to unhealthy database
          logger.info(`Attempting to reconnect to ${type} database`);
          try {
            // Import database functions dynamically to prevent circular dependencies
            const { connectAllDatabases } = await import('./config/db.js');
            
            await Promise.resolve(connectAllDatabases(1)).catch(err => {
              logger.error(`Failed to reconnect to ${type} database: ${err.message}`);
              // Continue server operations even if reconnection fails
            });
          } catch (reconnectError) {
            logger.error(`Error during database reconnection: ${reconnectError.message}`);
            // Continue server operations even if reconnection fails
          }
        }
      }
    } catch (error) {
      // This outer catch provides an additional safety net
      logger.error(`DB health check critical failure: ${error.message}`);
      logger.info('Server will continue running with limited database functionality');
    }
  }, interval);
}

// Function to monitor connection pool
function startConnectionPoolMonitor() {
  const interval = config.CONNECTION_POOL_CHECK_INTERVAL || 300000;
  scheduledTasks.addTask('connectionPoolMonitor', async () => {
    try {
      // First check if we have a connection monitor function available
      try {
        // Dynamically import to avoid circular dependencies
        const { checkMongoConnectionPool } = await import('./utils/dbReconnector.js').catch(() => {
          return { checkMongoConnectionPool: null };
        });
        
        if (typeof checkMongoConnectionPool === 'function') {
          await checkMongoConnectionPool();
          return;
        }
      } catch (importError) {
        logger.debug(`Could not use dedicated pool monitor: ${importError.message}`);
      }
      
      // Fallback: Check if mongoose connection exists and is ready
      if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        logger.debug('MongoDB connection not ready, skipping pool check');
        return;
      }
      
      // Then check if db and serverConfig are available
      if (!mongoose.connection.db || !mongoose.connection.db.serverConfig) {
        logger.debug('MongoDB server configuration not available');
        return;
      }
      
      // Check if pool exists
      const pool = mongoose.connection.db.serverConfig.s?.pool;
      if (!pool) {
        logger.debug('MongoDB connection pool not available');
        return;
      }
      
      // Now safely log the pool stats
      logger.debug(`DB connection pool: ${pool.totalConnectionCount || 0} total, ${pool.availableConnectionCount || 0} available`);
    } catch (error) {
      logger.error(`Connection pool check failed: ${error.message}`);
      // Error in pool check shouldn't affect server operation
    }
  }, interval);
}

// Function to start connection monitoring
function startConnectionMonitoring(interval) {
  scheduledTasks.addTask('connectionMonitoring', () => {
    const activeConnections = socketStore ? socketStore.size : 0;
    logger.info(`Active connections: ${activeConnections}`);
  }, interval);
}

// Add this middleware definition that was missing
function dbFeatureCheck(required) {
  return (req, res, next) => {
    if (required && mongoose.connection.readyState !== 1) {
      return res.render('db-unavailable', {
        message: 'This feature requires database connectivity which is currently unavailable.'
      });
    }
    next();
  };
}

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
    ));    // Verify DB connection before proceeding with robust health check
    const { isDatabaseConnectionHealthy, connectDB, ensureModelsRegistered } = await import('./config/db.js');
    
    const isHealthy = await isDatabaseConnectionHealthy('main');
    if (!isHealthy || mongoose.connection.readyState !== 1) {
      logger.warning('Database not connected during app initialization, trying to reconnect...');
      const dbConnected = await connectDB(2, true); // Force reconnection
      
      if (!dbConnected) {
        logger.warning('Could not establish database connection, some features may not work properly');
      } else {
        // Even if connection appears successful, verify it works with a real operation
        try {
          await ensureModelsRegistered();
          logger.info('Initializing scheduled tasks');
          // Additional database health verification
          const isReallyHealthy = await isDatabaseConnectionHealthy('main');
          if (!isReallyHealthy) {
            logger.warning('Database connection appears unreliable, some features may not work properly');
          }
        } catch (dbError) {
          logger.error(`Database initialization error: ${dbError.message}`);
          logger.warning('Database models could not be properly registered');
        }
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
  // Routes that don't strictly require database access
  const basicRoutes = [
    { path: '/', handler: indexRoute, dbRequired: false },
    { path: '/psychodelic-trigger-mania', handler: psychodelicTriggerManiaRouter, dbRequired: false },
    { path: '/help', handler: helpRoute, dbRequired: false }
  ];

  // Setup routes with appropriate database checks
  basicRoutes.forEach(route => {
    app.use(route.path, dbFeatureCheck(false), route.handler);
  });
  
  dbRoutes.forEach(route => {
    app.use(route.path, dbFeatureCheck(true), route.handler);
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
  // Initialize the LMStudio worker thread
  const lmstudio = new Worker(path.join(__dirname, 'workers/lmstudio.js'));
  
  // Handle worker exit
  lmstudio.on('exit', (code) => {
    logger.error(`Worker thread exited with code ${code}`);
    
    // Notify all connected clients
    if (io) {
      io.emit('system-error', 'The AI service has restarted. Please refresh your page.');
    }
    
    // Start a new worker after a short delay
    setTimeout(() => {
      const newWorker = new Worker(path.join(__dirname, 'workers/lmstudio.js'));
      
      // Update all socket references with new worker
      if (socketStore) {
        for (const [id, data] of socketStore.entries()) {
          socketStore.set(id, { ...data, worker: newWorker });
        }
      }
      
      logger.info('Worker thread restarted');
    }, 1000);
  });

  // Simple filter function to avoid bad words
  function filter(content) {
    if (!content || !filteredWords || !filteredWords.length) return content;
    
    if (typeof content !== 'string') {
      content = String(content);
    }
    
    return content
      .split(' ')
      .map(word => filteredWords.includes(word.toLowerCase()) ? '[filtered]' : word)
      .join(' ')
      .trim();
  }

  // XP system functions
  const xpSystem = {
    requirements: [100, 250, 450, 700, 1200],
    
    calculateLevel(xp) {
      let level = 0;
      while (level < this.requirements.length && xp >= this.requirements[level]) {
        level++;
      }
      return level;
    },
    
    awardXP(socket, amount, reason = 'interaction') {
      if (!socket.bambiData) return;
      
      const oldXP = socket.bambiData.xp || 0;
      const oldLevel = this.calculateLevel(oldXP);
      
      // Add XP
      socket.bambiData.xp = oldXP + amount;
      const newLevel = this.calculateLevel(socket.bambiData.xp);
      
      // Notify client of XP gain
      socket.emit('xp:update', {
        xp: socket.bambiData.xp,
        level: newLevel,
        xpEarned: amount,
        reason: reason
      });
      
      // Check for level up
      if (newLevel > oldLevel) {
        socket.emit('level-up', { level: newLevel });
        logger.info(`User ${socket.bambiUsername} leveled up to ${newLevel}`);
      }
      
      // Save to database if available
      if (socket.bambiUsername && socket.bambiUsername !== 'anonBambi') {
        updateProfileXP(socket.bambiUsername, socket.bambiData.xp);
      }
    }
  };
  
  // Function to update profile XP in DB
  async function updateProfileXP(username, xp) {
    try {
      if (mongoose.connection.readyState !== 1) return;
      
      const Profile = mongoose.model('Profile');
      await Profile.findOneAndUpdate(
        { username },
        { $set: { xp } },
        { new: true, upsert: false }
      );
    } catch (error) {
      logger.error(`Failed to update profile XP: ${error.message}`);
    }
  }
  
  // Function to get profile data for a user
  async function getProfileData(username) {
    try {
      if (mongoose.connection.readyState !== 1) return null;
      
      const Profile = mongoose.model('Profile');
      return await Profile.findOne({ username });
    } catch (error) {
      logger.error(`Failed to get profile data: ${error.message}`);
      return null;
    }
  }

  io.on('connection', (socket) => {
    try {
      const cookies = socket.handshake.headers.cookie
        ? socket.handshake.headers.cookie
          .split(';')
          .map(cookie => cookie.trim().split('='))
          .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
          }, {})
        : {};
      let username = decodeURIComponent(cookies['bambiname'] || 'anonBambi').replace(/%20/g, ' ');
      logger.info('Cookies received in handshake:', socket.handshake.headers.cookie);
      
      // Initialize user data
      socket.bambiUsername = username;
      socket.bambiData = { 
        xp: 0, 
        username: username,
        sessionId: null
      };
      
      if (username === 'anonBambi') {
        socket.emit('prompt username');
      } else {
        // Load profile data if user is not anonymous
        getProfileData(username).then(profile => {
          if (profile) {
            socket.bambiData.xp = profile.xp || 0;
            socket.emit('profile-data', { profile });
            socket.emit('profile-update', { 
              xp: profile.xp,
              level: xpSystem.calculateLevel(profile.xp || 0)
            });
          }
        });
      }
      
      // Send database status notification to client
      const { notifyDbStatus } = require('./utils/dbStatusNotifier.js');
      notifyDbStatus(socket);

      // Add socket to global store
      socketStore.set(socket.id, { socket, worker: lmstudio, files: [] });
      logger.info(`Client connected: ${socket.id} sockets: ${socketStore.size}`);
      
      // Chat message handling
      socket.on('chat message', async (msg) => {
        try {
          const timestamp = new Date().toISOString();
          io.emit('chat message', {
            ...msg,
            timestamp: timestamp,
            username: socket.bambiUsername,
          });
          
          // Give XP for chat interactions
          xpSystem.awardXP(socket, 1, 'chat');
        } catch (error) {
          logger.error('Error in chat message handler:', error);
        }
      });

      // Username setting
      socket.on('set username', (username) => {
        try {
          const encodedUsername = encodeURIComponent(username);
          socket.handshake.headers.cookie = `bambiname=${encodedUsername}; path=/`;
          socket.bambiUsername = username;
          socket.emit('username set', username);
          logger.info('Username set:', username);
          
          // Load profile data for the new username
          getProfileData(username).then(profile => {
            if (profile) {
              socket.bambiData.xp = profile.xp || 0;
              socket.emit('profile-data', { profile });
              socket.emit('profile-update', { 
                xp: profile.xp,
                level: xpSystem.calculateLevel(profile.xp || 0) 
              });
            }
          });
        } catch (error) {
          logger.error('Error in set username handler:', error);
        }
      });

      // Get profile data
      socket.on('get-profile-data', async (data, callback) => {
        try {
          const profile = await getProfileData(data.username);
          callback({ success: true, profile });
        } catch (error) {
          logger.error('Error getting profile data:', error);
          callback({ success: false, error: 'Failed to load profile data' });
        }
      });

      // LMStudio message handling
      socket.on("message", (message) => {
        try {
          const filteredMessage = filter(message);
          lmstudio.postMessage({
            type: "message",
            data: filteredMessage,
            socketId: socket.id,
            username: socket.bambiUsername
          });
          
          // Award XP for AI interactions
          xpSystem.awardXP(socket, 5, 'ai-prompt');
          
          // Create or update session
          const sessionId = Math.random().toString(36).substring(2, 15);
          socket.bambiData.sessionId = sessionId;
          socket.emit('session-created', { sessionId });
          
          // Notify about conversation start
          socket.emit('conversation-start');
        } catch (error) {
          logger.error('Error in message handler:', error);
          socket.emit('error', { message: 'Failed to process your message' });
        }
      });

      // Trigger word handling
      socket.on("triggers", (triggers) => {
        try {
          lmstudio.postMessage({ 
            type: "triggers", 
            triggers,
            socketId: socket.id
          });
          logger.info(`Triggers set for ${socket.bambiUsername}:`, triggers.triggerNames || 'none');
        } catch (error) {
          logger.error('Error in triggers handler:', error);
        }
      });

      // System settings handling
      socket.on('system-settings', (settings) => {
        try {
          lmstudio.postMessage({
            type: 'system-settings',
            settings,
            socketId: socket.id
          });
        } catch (error) {
          logger.error('Error in system settings handler:', error);
        }
      });

      // Session management
      socket.on('save-session', (data) => {
        try {
          const sessionId = data.sessionId || socket.bambiData.sessionId;
          if (!sessionId) return;
          
          // Would normally save to DB, but we'll just acknowledge for now
          socket.emit('session-saved', { success: true, sessionId });
        } catch (error) {
          logger.error('Error saving session:', error);
          socket.emit('session-saved', { success: false, error: 'Failed to save session' });
        }
      });

      socket.on('load-session', async (data) => {
        try {
          const sessionId = data.sessionId;
          if (!sessionId) return;
          
          // Would normally load from DB
          // For now just notify the session is loaded
          socket.emit('session-loaded', { 
            success: true, 
            sessionId,
            session: { id: sessionId, username: socket.bambiUsername }
          });
        } catch (error) {
          logger.error('Error loading session:', error);
          socket.emit('session-loaded', { success: false, error: 'Failed to load session' });
        }
      });

      // Collar text handling
      socket.on('collar', async (collarData) => {
        try {
          const filteredCollar = filter(collarData.data);
          lmstudio.postMessage({
            type: 'collar',
            data: filteredCollar,
            socketId: socket.id
          });
          
          // Emit to target socket if specified
          if (collarData.socketId) {
            io.to(collarData.socketId).emit('collar', filteredCollar);
          }
          
          // Award XP for collar usage
          xpSystem.awardXP(socket, 2, 'collar');
        } catch (error) {
          logger.error('Error in collar handler:', error);
        }
      });

      // Handle worker messages
      lmstudio.on("message", async (msg) => {
        try {
          if (msg.type === "log") {
            logger.info(msg.data, msg.socketId);
          } else if (msg.type === 'response') {
            // Convert object responses to strings
            const responseData = typeof msg.data === 'object' ? JSON.stringify(msg.data) : msg.data;
            
            // Send response to client
            io.to(msg.socketId).emit("response", responseData);
            
            // Award XP when AI responds
            const socketData = socketStore.get(msg.socketId);
            if (socketData && socketData.socket) {
              xpSystem.awardXP(socketData.socket, 3, 'ai-response');
            }
          }
        } catch (error) {
          logger.error('Error in lmstudio message handler:', error);
          
          // Try to send an error message to the client
          if (msg && msg.socketId) {
            io.to(msg.socketId).emit("error", "Error processing response");
          }
        }
      });

      // Handle worker info messages
      lmstudio.on('info', (info) => {
        try {
          logger.info('Worker info:', info);
        } catch (error) {
          logger.error('Error in lmstudio info handler:', error);
        }
      });

      // Handle worker errors
      lmstudio.on('error', (err) => {
        try {
          logger.error('Worker error:', err);
        } catch (error) {
          logger.error('Error in lmstudio error handler:', error);
        }
      });

      // Handle client disconnection
      socket.on('disconnect', (reason) => {
        try {
          logger.info('Client disconnected:', socket.id, 'Reason:', reason);
          
          // Get socket data and clean up
          const socketData = socketStore.get(socket.id);
          if (socketData) {
            socketStore.delete(socket.id);
          }
          
          logger.info(`Client disconnected: ${socket.id} sockets: ${socketStore.size}`);
        } catch (error) {
          logger.error('Error in disconnect handler:', error);
        }
      });
    } catch (error) {
      logger.error('Error in connection handler:', error);
    }
  });
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
 * Main server initialization sequence
 */
async function startServer() {
  try {
    logger.info('Step 1/5: Connecting to MongoDB...');
    
    // Import database functions
    const { 
      connectAllDatabases, 
      ensureModelsRegistered, 
      inFallbackMode, 
      checkAllDatabasesHealth, 
      isDatabaseConnectionHealthy 
    } = await import('./config/db.js');
    
    // Connect to all databases with 3 retry attempts
    const dbResults = await connectAllDatabases(3);
    
    // Check connection results
    if (!dbResults.main) {
      logger.warning('⚠️ Failed to connect to main MongoDB database after multiple attempts.');
      logger.warning('⚠️ Server will start with LIMITED FUNCTIONALITY - database-dependent features disabled.');
    } else if (!(await isDatabaseConnectionHealthy())) {
      logger.warning('⚠️ Database connection reported success but connection is not ready.');
      logger.warning('⚠️ Server will start with LIMITED FUNCTIONALITY - database-dependent features disabled.');
    } 
    
    // Ensure all models are properly registered
    try {
      await ensureModelsRegistered();
      logger.debug('All database models registered successfully');
    } catch (modelError) {
      logger.error(`Failed to register database models: ${modelError.message}`);
    }
    
    // Log connection status
    const dbHealth = await checkAllDatabasesHealth();
    
    if (inFallbackMode()) {
      logger.warning('⚠️ Connected to FALLBACK DATABASE - running with limited functionality');
    } else if (dbResults.main && (await isDatabaseConnectionHealthy())) {
      logger.success(`MongoDB connection established (${dbHealth.main?.database || 'unknown'})`);
      if (dbResults.profiles) {
        logger.success(`Profiles database connected (${dbHealth.profiles?.database || 'unknown'})`);
      }
    }

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
    }    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
    process.on('SIGINT', () => gracefulShutdown('SIGINT', server));
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception:', err);
      gracefulShutdown('UNCAUGHT_EXCEPTION', server);
    });
    process.on('unhandledRejection', (reason, promise) => {
      // Don't shut down for database connection issues
      const errorMessage = reason instanceof Error ? reason.message : String(reason);
      
      // Check if it's a database-related error
      if (errorMessage.includes('ECONNREFUSED') && errorMessage.includes('27017')) {
        logger.error('Database connection failed:', errorMessage);
        logger.warning('Database connection error - server will continue with limited functionality');
        
        // Attempt reconnection in the background
        setTimeout(async () => {
          try {
            logger.info('Attempting background reconnect to database...');
            await Promise.resolve(connectAllDatabases(1)).catch(e => {
              logger.error(`Background reconnection attempt failed: ${e.message}`);
            });
          } catch (reconnectError) {
            logger.error(`Error during background reconnection: ${reconnectError.message}`);
          }
        }, 10000); // Try reconnecting in 10 seconds
      } else {
        // For other types of rejections, log and shutdown
        logger.error('Unhandled rejection at:', promise, 'reason:', reason);
        gracefulShutdown('UNHANDLED_REJECTION', server);
      }
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