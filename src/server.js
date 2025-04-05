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

//routes
import indexRoute from './routes/index.js';
import psychodelicTriggerManiaRouter from './routes/psychodelic-trigger-mania.js';
import helpRoute from './routes/help.js';
import scrapersRoute, { initializeScrapers } from './routes/scrapers.js';

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

//filteredWords
const filteredWords = JSON.parse(await fsPromises.readFile(path.join(__dirname, 'filteredWords.json'), 'utf8'));

logger.info('Loading environment variables...');

app.use(cors({
  origin: ['https://bambisleep.chat', 'https://fickdichselber.com'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
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

async function initializeServer() {
  try {
    // Connect to MongoDB first
    await connectToMongoDB();
    
    if (serverInstance && serverInstance.listening) {
      logger.error('Server is already listening');
      return;
    }
    
    // Initialize scrapers system
    const scrapersInitialized = await initializeScrapers();
    if (scrapersInitialized) {
      logger.success('Scrapers system initialized');
    } else {
      logger.warning('Scrapers system initialization failed or incomplete');
    }
    
    // Rest of your initialization code
    setupRoutes();
    setupSockets();
    setupErrorHandlers();
    app.use(errorHandler);
    
    // Update signal handlers to use the imported function
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
    logger.info('Starting server...');
    serverInstance = server.listen(PORT, async () => {
      logger.success(`Server running on http://${getServerAddress()}:${PORT}`);
    });
    logger.success('Server initialization complete');
  } catch (err) {
    logger.error('Error in initializeServer:', err);
    process.exit(1);
  }
}

initializeServer();