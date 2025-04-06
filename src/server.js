import { promises as fsPromises } from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// modules
import { Worker } from 'worker_threads';
import { Server } from 'socket.io';
import cors from 'cors';
import axios from 'axios';
import fileUpload from 'express-fileupload';

//routes
import indexRoute from './routes/index.js';
import psychodelicTriggerManiaRouter from './routes/psychodelic-trigger-mania.js';
import helpRoute from './routes/help.js';
import scrapersRoute, { initializeScrapers } from './routes/scrapers.js';
import scraperAPIRoutes from './routes/scraperRoutes.js';

//wokers
import workerCoordinator from './workers/workerCoordinator.js';

//configs
import errorHandler from './middleware/error.js';
import footerConfig from './config/footer.config.js';
import Logger from './utils/logger.js';
import connectToMongoDB from './utils/dbConnection.js';
import gracefulShutdown from './utils/gracefulShutdown.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logger
const logger = new Logger('Server');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 300000, // 300 seconds
  pingInterval: 25000, // 25 seconds
});

// Create necessary directories for audio processing
const audioDir = path.join(__dirname, 'temp', 'audio');
fs.mkdirSync(audioDir, { recursive: true });

//filteredWords
const filteredWords = JSON.parse(await fsPromises.readFile(path.join(__dirname, 'filteredWords.json'), 'utf8'));

logger.info('Loading environment variables...');

app.use(cors({
  origin: ['https://bambisleep.chat', 'https://fickdichselber.com'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

// Add file upload middleware for audio files
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  abortOnLimit: true
}));

const MAX_LISTENERS_BASE = 10;
let currentMaxListeners = MAX_LISTENERS_BASE;

function adjustMaxListeners(worker, increment = true) {
  try {
    const adjustment = increment ? 1 : -1;
    const currentListeners = worker.listenerCount('message');
    if (currentListeners + adjustment > currentMaxListeners) {
      currentMaxListeners = currentListeners + adjustment;
      worker.setMaxListeners(currentMaxListeners);
    }
  } catch (error) {
    logger.error('Error in adjustMaxListeners:', error);
  }
}

Worker.prototype.setMaxListeners(currentMaxListeners);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

logger.info('Initializing server components...');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/workers', express.static(path.join(__dirname, 'workers')));
app.use('/audio', express.static(path.join(__dirname, './assets/audio')));
app.use('/temp/audio', express.static(path.join(__dirname, 'temp', 'audio')));

app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'node_modules/socket.io/client-dist/socket.io.js'));
});

app.locals.footer = footerConfig;

const routes = [
  { path: '/', handler: indexRoute },
  { path: '/psychodelic-trigger-mania', handler: psychodelicTriggerManiaRouter },
  { path: '/help', handler: helpRoute },
  { path: '/scrapers', handler: scrapersRoute },
];

// Initialize Speecher worker
let speecherWorker;

function initializeSpeecherWorker() {
  try {
    speecherWorker = new Worker(path.join(__dirname, 'workers/speecher.js'));
    adjustMaxListeners(speecherWorker, true);
    
    speecherWorker.on('message', (msg) => {
      if (msg.type === 'log') {
        logger.info(`[Speecher Worker] ${msg.data}`);
      }
    });
    
    speecherWorker.on('error', (err) => {
      logger.error('Speecher Worker error:', err);
      // Attempt to restart the worker
      initializeSpeecherWorker();
    });
    
    logger.success('Speecher Worker initialized');
    return true;
  } catch (error) {
    logger.error('Error initializing Speecher Worker:', error);
    return false;
  }
}

app.get('/api/tts', async (req, res) => {
  const text = req.query.text;
  if (typeof text !== 'string' || text.trim() === '') {
    return res.status(400).send('Invalid input: text must be a non-empty string');
  }
  
  try {
    if (!speecherWorker) {
      const initialized = initializeSpeecherWorker();
      if (!initialized) {
        return res.status(500).send('TTS service unavailable');
      }
    }
    
    // Create a promise to handle the worker response
    const ttsPromise = new Promise((resolve, reject) => {
      const messageId = Date.now().toString();
      
      const responseHandler = (message) => {
        if (message.id === messageId) {
          speecherWorker.removeListener('message', responseHandler);
          
          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message.audioPath);
          }
        }
      };
      
      speecherWorker.on('message', responseHandler);
      
      // Send request to worker
      speecherWorker.postMessage({
        type: 'tts',
        id: messageId,
        text: text
      });
      
      // Set timeout to avoid hanging requests
      setTimeout(() => {
        speecherWorker.removeListener('message', responseHandler);
        reject(new Error('TTS request timed out'));
      }, 30000); // 30 second timeout
    });
    
    // Handle the TTS response
    const audioPath = await ttsPromise;
    
    // FIX: Check if file exists before sending
    if (!fs.existsSync(audioPath)) {
      logger.error(`Audio file not found: ${audioPath}`);
      return res.status(500).send('Audio file not found');
    }
    
    // Set proper content type
    res.setHeader('Content-Type', 'audio/wav');
    
    // FIX: Use the audioPath directly without trying to resolve it relative to __dirname
    res.sendFile(audioPath, (err) => {
      if (err) {
        logger.error(`Error sending audio file: ${err}`);
        if (!res.headersSent) {
          res.status(500).send('Error sending audio file');
        }
      }
      
      // Clean up temp file after sending
      fs.unlink(audioPath, (unlinkErr) => {
        if (unlinkErr) logger.error(`Error cleaning up audio file: ${unlinkErr}`);
      });
    });
  } catch (error) {
    logger.error('Error generating TTS:', error);
    if (!res.headersSent) {
      res.status(500).send(`Error generating TTS: ${error.message}`);
    }
  }
});

function setupRoutes() {
  try {
    routes.forEach(route => {
      app.use(route.path, route.handler);
    });

    app.get('/', (req, res) => {
      const validConstantsCount = 9;
      res.render('index', { validConstantsCount: validConstantsCount });
    });

    app.post('/scrape', (req, res) => {
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
    });

    // Example route to scan a directory
    app.post('/scan', (req, res) => {
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
    });

    app.use('/api/scraper', scraperAPIRoutes);

  } catch (error) {
    logger.error('Error in setupRoutes:', error);
  }
}

function setupSockets() {
  try {
    logger.info('Setting up socket middleware...');

    const socketStore = new Map();

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
        if (username === 'anonBambi') {
          socket.emit('prompt username');
        }

        const lmstudio = new Worker(path.join(__dirname, 'workers/lmstudio.js'));
        adjustMaxListeners(lmstudio, true);

        socketStore.set(socket.id, { socket, worker: lmstudio, files: [] });
        logger.success(`Client connected: ${socket.id} sockets: ${socketStore.size}`);

        socket.on('chat message', async (msg) => {
          try {
            const timestamp = new Date().toISOString();
            io.emit('chat message', {
              ...msg,
              timestamp: timestamp,
              username: username,
            });
          } catch (error) {
            logger.error('Error in chat message handler:', error);
          }
        });

        socket.on('set username', (username) => {
          try {
            const encodedUsername = encodeURIComponent(username);
            socket.handshake.headers.cookie = `bambiname=${encodedUsername}; path=/`;
            socket.emit('username set', username);
            logger.info('Username set:', username);
          } catch (error) {
            logger.error('Error in set username handler:', error);
          }
        });

        socket.on("message", (message) => {
          try {
            const filteredMessage = filter(message);
            lmstudio.postMessage({
              type: "message",
              data: filteredMessage,
              socketId: socket.id,
              username: username
            });
          } catch (error) {
            logger.error('Error in message handler:', error);
          }
        });

        socket.on("triggers", (triggers) => {
          try {
            lmstudio.postMessage({ type: "triggers", triggers });
          } catch (error) {
            logger.error('Error in triggers handler:', error);
          }
        });

        socket.on('collar', async (collarData) => {
          try {
            const filteredCollar = filter(collarData.data);
            lmstudio.postMessage({
              type: 'collar',
              data: filteredCollar,
              socketId: socket.id
            });
            io.to(collarData.socketId).emit('collar', filteredCollar);
          } catch (error) {
            logger.error('Error in collar handler:', error);
          }
        });

        lmstudio.on("message", async (msg) => {
          try {
            if (msg.type === "log") {
              logger.info(msg.data, msg.socketId);
            } else if (msg.type === 'response') {
              const responseData = typeof msg.data === 'object' ? JSON.stringify(msg.data) : msg.data;
              io.to(msg.socketId).emit("response", responseData);
            }
          } catch (error) {
            logger.error('Error in lmstudio message handler:', error);
          }
        });

        lmstudio.on('info', (info) => {
          try {
            logger.info('Worker info:', info);
          } catch (error) {
            logger.error('Error in lmstudio info handler:', error);
          }
        });

        lmstudio.on('error', (err) => {
          try {
            logger.error('Worker error:', err);
          } catch (error) {
            logger.error('Error in lmstudio error handler:', error);
          }
        });

        socket.on('disconnect', (reason) => {
          logger.info(`Client disconnected: ${socket.id}, Reason: ${reason}`);
          if (reason === 'transport error') {
            logger.error('Transport error occurred. Possible network or configuration issue.');
          }
          try {
            const { worker } = socketStore.get(socket.id);
            if (worker) {
              worker.terminate();
              adjustMaxListeners(worker, false);
            }
            logger.info(`Client disconnected: ${socket.id} sockets: ${socketStore.size}`);
            socketStore.delete(socket.id);
          } catch (error) {
            logger.error('Error during disconnect cleanup:', error);
          }
        });
      } catch (error) {
        logger.error('Error in connection handler:', error);
      }
    });
  } catch (error) {
    logger.error('Error in setupSockets:', error);
  }
}

logger.success('Socket middleware setup complete');

function setupErrorHandlers() {
  try {
    app.use((err, req, res, next) => {
      const status = err.status || 500;
      logger.error(`[${status}] ${err.message}`);
      res.status(status).json({
        error:
          process.env.NODE_ENV === 'production'
            ? 'An error occurred'
            : err.message
      });
    });

    app.use((err, req, res, next) => {
      if (err.status === 503) {
        res.status(503).render('profile', { error: true });
      } else {
        next(err);
      }
    });
  } catch (error) {
    logger.error('Error in setupErrorHandlers:', error);
  }
}

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
  }
}

function filter(message) {
  try {
    if (typeof message !== 'string') {
      message = String(message);
    }
    return message
      .split(' ')
      .map((word) => {
        return filteredWords.includes(word.toLowerCase()) ? '[filtered]' : word;
      })
      .join(' ')
      .trim();
  } catch (error) {
    logger.error('Error in filter:', error);
  }
}

let serverInstance;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function initializeServer() {
  try {
    // Step 1: Connect to MongoDB ONCE
    logger.info('Step 1/6: Connecting to MongoDB...');
    await connectToMongoDB();
    
    // Wait for mongoose connection to be fully established
    while (mongoose.connection.readyState !== 1) {
      logger.info('Waiting for MongoDB connection to be fully ready...');
      await delay(500);
    }
    logger.success('MongoDB connection fully established and ready');
    
    // Step 2: Setup routes first to ensure models are defined
    logger.info('Step 2/6: Setting up server components...');
    setupRoutes();
    await delay(150);
    
    // Step 3: Now initialize scrapers system
    logger.info('Step 3/6: Initializing scrapers system...');
    await delay(150);
    const scrapersInitialized = await initializeScrapers();
    if (scrapersInitialized) {
      logger.success('Scrapers system initialization successful');
    } else {
      logger.warning('Scrapers system initialization incomplete - continuing startup');
    }
    await delay(200);
    
    // Continue with the rest of initialization...
    // Step 4: Initialize worker coordinator
    logger.info('Step 4/6: Initializing worker coordinator...');
    await delay(150);
    await workerCoordinator.initialize();
    await delay(200);
    
    // Step 5: Initialize the speecher worker
    logger.info('Step 5/6: Initializing speech synthesis worker...');
    await delay(150);
    initializeSpeecherWorker();
    await delay(200);
    
    // Step 6: Setup routes, sockets, and error handlers
    logger.info('Step 6/6: Setting up server components...');
    setupRoutes();
    await delay(150);
    setupSockets();
    await delay(150);
    setupErrorHandlers();
    app.use(errorHandler);
    await delay(200);
    
    // Step 7: Start listening on port
    logger.info('Step 7/7: Starting HTTP server...');
    
    // Set up signal handlers for graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
    process.on('SIGINT', () => gracefulShutdown('SIGINT', server));
    process.on('uncaughtException', async (err) => {
      logger.error('Uncaught Exception:', err);
      try {
        await gracefulShutdown('UNCAUGHT_EXCEPTION', server);
      } catch (error) {
        logger.error('Error during shutdown after uncaught exception:', error);
        process.exit(1);
      }
    });
    
    const PORT = process.env.SERVER_PORT || 6969;
    await delay(200);
    
    serverInstance = server.listen(PORT, async () => {
      logger.success(`Server running on http://${getServerAddress()}:${PORT}`);
      logger.success('Server initialization sequence completed successfully');
    });
  } catch (err) {
    logger.error('Error in server initialization sequence:', err);
    process.exit(1);
  }
}

initializeServer();