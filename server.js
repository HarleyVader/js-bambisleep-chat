import fs from 'fs';
import { promises as fsPromises } from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import os from 'os';
import path from 'path';
import { Worker } from 'worker_threads';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import multer from 'multer';

//routes
import indexRoute from './routes/index.js';
import psychodelicTriggerManiaRouter from './routes/psychodelic-trigger-mania.js';
import chatRoutes from './routes/chat.js';
import helpRoute from './routes/help.js';

//configs
import errorHandler from './middleware/error.js';
import { patterns } from './middleware/bambisleepChalk.js';
import footerConfig from './config/footer.config.js';

//workers
import { generateTTS, deleteFile } from './workers/tts_worker.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

//filteredwords
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data = await fsPromises.readFile(path.join(__dirname, 'filteredWords.json'), 'utf8');
const filteredWords = JSON.parse(data);

console.log(patterns.server.info('Loading environment variables...'));

app.use(cors({
  origin: ['https://bambisleep.chat', 'https://fickdichselber.com'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

const MAX_LISTENERS_BASE = 10;
let currentMaxListeners = MAX_LISTENERS_BASE;

function adjustMaxListeners(worker) {
  try {
    const currentListeners = worker.listenerCount('message');
    if (currentListeners + 1 > currentMaxListeners) {
      currentMaxListeners = currentListeners + 1;
      worker.setMaxListeners(currentMaxListeners);
    }
  } catch (error) {
    console.error(patterns.server.error('Error in adjustMaxListeners:', error));
  }
}

Worker.prototype.setMaxListeners(currentMaxListeners);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

console.log(patterns.server.info('Initializing server components...'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/workers', express.static(path.join(__dirname, 'workers')));

app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'node_modules/socket.io/client-dist/socket.io.js'));
});

const cacheDir = path.join(__dirname, 'cache');

// Ensure the cache directory exists
if (!await fsPromises.access(cacheDir).catch(() => true)) {
  await fsPromises.mkdir(cacheDir);
}

async function fetchTTS(text, speakerWav, language) {
  console.log(patterns.server.info('Starting TTS fetch...'));
  console.log(patterns.server.info(`Request parameters: text=${text}, speakerWav=${speakerWav}, language=${language}`));

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const ttsFile = await generateTTS(text, speakerWav, language);
      console.log(patterns.server.success('TTS fetch successful.'));
      return ttsFile;
    } catch (error) {
      attempt++;
      console.error(patterns.server.error(`[BACKEND ERROR] Attempt ${attempt} - Error fetching TTS audio:`, error.message));

      if (attempt >= maxRetries) {
        throw new Error('Error fetching TTS audio after multiple attempts');
      }
    }
  }
}

app.get('/api/tts', async (req, res) => {
  const { text, speakerWav, language } = req.query;

  try {
    const ttsFile = await fetchTTS(text, speakerWav, language);
    res.sendFile(ttsFile, (err) => {
      if (err) {
        console.error(patterns.server.error('[BACKEND ERROR] Error sending TTS file:', err.message));
        res.status(500).send('Internal Server Error');
      } else {
        deleteFile(ttsFile).catch((deleteErr) => {
          console.error(patterns.server.error('[BACKEND ERROR] Error deleting TTS file:', deleteErr.message));
        });
      }
    });
  } catch (error) {
    console.error(patterns.server.error('[BACKEND ERROR] /api/tts route:', error.message));
    res.status(500).send('Internal Server Error');
  }
});

const upload = multer({ dest: 'uploads/' });

app.post('/api/upload-audio', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const filePath = path.join(__dirname, 'uploads', req.file.filename);
  console.log('File uploaded to:', filePath);

  // Store the uploaded file path in the socketStore
  const socketId = req.headers['socket-id'];
  if (socketId && socketStore.has(socketId)) {
    const { files } = socketStore.get(socketId);
    files.push(filePath);
  }

  res.json({ filePath });
});

app.locals.footer = footerConfig;

const routes = [
  { path: '/', handler: indexRoute },
  { path: '/psychodelic-trigger-mania', handler: psychodelicTriggerManiaRouter },
  { path: '/chat', handler: chatRoutes },
  { path: '/help', handler: helpRoute },
];

function setupRoutes() {
  try {
    routes.forEach(route => {
      app.use(route.path, route.handler);
    });

    app.get('/', (req, res) => {
      const validConstantsCount = 9; // Define the variable with an appropriate value
      res.render('index', { validConstantsCount: validConstantsCount });
    });

  } catch (error) {
    console.error(patterns.server.error('Error in setupRoutes:', error));
  }
}

function setupSockets() {
  try {
    console.log(patterns.server.info('Setting up socket middleware...'));

    const userSessions = new Set();
    const socketStore = new Map();

    io.on('connection', (socket) => {
      try {
        console.log(patterns.server.info('Cookies received in handshake:', socket.handshake.headers.cookie));
        userSessions.add(socket.id);

        const lmstudio = new Worker(path.join(__dirname, 'workers/lmstudio.js'));
        adjustMaxListeners(lmstudio);

        socketStore.set(socket.id, { socket, worker: lmstudio, files: [] });
        console.log(patterns.server.success(`Client connected: ${socket.id} clients: ${userSessions.size} sockets: ${socketStore.size}`));

        // Prompt for bambiname username
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
        if (username === 'anonBambi') {
          socket.emit('prompt username');
        }

        socket.on('chat message', async (msg) => {
          try {
            const timestamp = new Date().toISOString();
            io.emit('chat message', {
              ...msg,
              timestamp: timestamp,
              username: username,
            });
          } catch (error) {
            console.error(patterns.server.error('Error in chat message handler:', error));
          }
        });

        socket.on('set username', (username) => {
          try {
            const encodedUsername = encodeURIComponent(username);
            socket.handshake.headers.cookie = `bambiname=${encodedUsername}; path=/`;
            socket.emit('username set', username);
            console.log(patterns.server.info('Username set:', username));
          } catch (error) {
            console.error(patterns.server.error('Error in set username handler:', error));
          }
        });

        socket.on("message", (message) => {
          try {
            const filteredMessage = filter(message);
            const email = socket.request.session?.email || 'defaultEmail';
            lmstudio.postMessage({
              type: "message",
              data: filteredMessage,
              triggers: "",
              socketId: socket.id,
              email: email,
              username: username
            });
          } catch (error) {
            console.error(patterns.server.error('Error in message handler:', error));
          }
        });

        socket.on("triggers", (triggers) => {
          try {
            lmstudio.postMessage({ type: "triggers", triggers });
          } catch (error) {
            console.error(patterns.server.error('Error in triggers handler:', error));
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
            console.error(patterns.server.error('Error in collar handler:', error));
          }
        });

        lmstudio.on("message", async (msg) => {
          try {
            if (msg.type === "log") {
              console.log(patterns.server.info(msg.data, msg.socketId));
            } else if (msg.type === 'response') {
              const responseData = typeof msg.data === 'object' ? JSON.stringify(msg.data) : msg.data;
              io.to(msg.socketId).emit("response", responseData);
            }
          } catch (error) {
            console.error(patterns.server.error('Error in lmstudio message handler:', error));
          }
        });

        lmstudio.on('info', (info) => {
          try {
            console.info(patterns.server.info('Worker info:'), info);
          } catch (error) {
            console.error(patterns.server.error('Error in lmstudio info handler:', error));
          }
        });

        lmstudio.on('error', (err) => {
          try {
            console.error(patterns.server.error('Worker error:'), err);
          } catch (error) {
            console.error(patterns.server.error('Error in lmstudio error handler:', error));
          }
        });

        socket.on('disconnect', (reason) => {
          try {
            console.log(patterns.server.info('Client disconnected:', socket.id, 'Reason:', reason));
            userSessions.delete(socket.id);
            const { worker, files } = socketStore.get(socket.id);
            socketStore.delete(socket.id);
            console.log(patterns.server.info(`Client disconnected: ${socket.id} clients: ${userSessions.size} sockets: ${socketStore.size}`));
            worker.terminate();
            adjustMaxListeners(worker);

            // Remove the uploaded files
            files.forEach(filePath => {
              fs.unlink(filePath, (err) => {
                if (err) {
                  console.error(patterns.server.error('Error deleting file:', filePath, err));
                } else {
                  console.log(patterns.server.success('Deleted file:', filePath));
                }
              });
            });
          } catch (error) {
            console.error(patterns.server.error('Error in disconnect handler:', error));
          }
        });
      } catch (error) {
        console.error(patterns.server.error('Error in connection handler:', error));
      }
    });
  } catch (error) {
    console.error(patterns.server.error('Error in setupSockets:', error));
  }
}

console.log(patterns.server.success('Socket middleware setup complete'));

function setupErrorHandlers() {
  try {
    app.use((err, req, res, next) => {
      const status = err.status || 500;
      console.error(patterns.server.error(`[${status}] ${err.message}`));
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
    console.error(patterns.server.error('Error in setupErrorHandlers:', error));
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
    console.error(patterns.server.error('Error in getServerAddress:', error));
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
    console.error(patterns.server.error('Error in filter:', error));
  }
}

function gracefulShutdown(signal, server) {
  try {
    console.log(patterns.server.warning(`Received ${signal}. Shutting down gracefully...`));
    server.close(() => {
      console.log(patterns.server.success('Closed out remaining connections.'));
      process.exit(0);
    });

    setTimeout(() => {
      console.error(patterns.server.error('Could not close connections in time, forcefully shutting down'));
      process.exit(1);
    }, 1000);
  } catch (error) {
    console.error(patterns.server.error('Error in gracefulShutdown:', error));
  }
}

let serverInstance;

async function initializeServer() {
  try {
    if (serverInstance && serverInstance.listening) {
      console.error(patterns.server.error('Server is already listening'));
      return;
    }
    setupRoutes();
    setupSockets();
    setupErrorHandlers();
    app.use(errorHandler);
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
    process.on('SIGINT', () => gracefulShutdown('SIGINT', server));
    process.on('uncaughtException', async (err) => {
      console.error('Uncaught Exception:', err);
      try {
        await new Promise((resolve) => {
          console.log('Received uncaughtException. Shutting down gracefully...');
          // Give existing connections time to close
          setTimeout(resolve, 1000);
        });
      } catch (error) {
        console.error('Error during shutdown:', error);
      } finally {
        process.exit(1);
      }
    });
    const PORT = process.env.PORT || 6969;
    console.log(patterns.server.info('Starting server...'));
    serverInstance = server.listen(PORT, async () => {
      console.log(patterns.server.success(`Server running on http://${getServerAddress()}:${PORT}`));
    });
    console.log(patterns.server.success('Server initialization complete'));
  } catch (err) {
    console.error(patterns.server.error('Error in initializeServer:', err));
    process.exit(1);
  }
}

initializeServer();