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
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

//routes
import indexRoute from './routes/index.js';
import psychodelicTriggerManiaRouter from './routes/psychodelic-trigger-mania.js';
import helpRoute from './routes/help.js';

//configs
import errorHandler from './middleware/error.js';
import { patterns } from './middleware/bambisleepChalk.js';
import footerConfig from './config/footer.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 262626,
  pingInterval: 25252,
});

//filteredWords
const filteredWords = JSON.parse(await fsPromises.readFile(path.join(__dirname, 'filteredWords.json'), 'utf8'));

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
app.use('/audio', express.static(path.join(__dirname, './assets/audio')));

app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'node_modules/socket.io/client-dist/socket.io.js'));
});

async function fetchTTS(text) {
  try {
    const response = await axios.get(`http://${process.env.SPEECH_HOST}:${process.env.SPEECH_PORT}/api/tts`, {
      params: { text },
      responseType: 'arraybuffer',
    });
    return response;
  } catch (error) {
    console.error(patterns.server.error('Error fetching TTS audio:', error));
    throw error;
  }
}

app.use('/api/tts', async (req, res, next) => {
  const text = req.query.text;
  if (typeof text !== 'string' || text.trim() === '') {
    return res.status(400).send('Invalid input: text must be a non-empty string');
  } else {
    try {
      const response = await fetchTTS(text);
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', response.data.length);
      res.send(response.data);
    } catch (error) {
      console.error(patterns.server.error('Error fetching TTS audio:'), error);
      if (error.response) {
        if (error.response.status === 401) {
          console.error(patterns.server.error('Unauthorized access - invalid token'));
          res.status(401).send('Unauthorized access');
        } else {
          console.error(patterns.server.error('Error details:'), error.response.data.toString());
          res.status(500).send('Error fetching TTS audio');
        }
      } else {
        console.error(patterns.server.error('Error details:'), error.message);
        res.status(500).send('Error fetching TTS audio');
      }
      next();
    }
  }
});

app.post('/api/zonos', (req, res) => {
  const text = req.body.text;
  const sanitizedText = text.replace(/\s+/g, '-').toLowerCase();
  const trimmedText = sanitizedText.length > 30 ? sanitizedText.substring(0, 30) : sanitizedText;
  const uniqueId = uuidv4();
  const filename = `${trimmedText}-${uniqueId}.wav`;

  io.emit('status', 'Processing started');

  const childProcess = spawn('python3', ['zonos.py', text, filename]);

  childProcess.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
    io.emit('status', `stdout: ${data}`);
  });

  childProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
    io.emit('status', `stderr: ${data}`);
  });

  childProcess.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
    io.emit('status', `Process exited with code ${code}`);
    const audioPath = path.join(__dirname, `./assets/audio/${filename}`);
    if (fs.existsSync(audioPath)) {
      res.json({ audioPath: `/audio/${filename}` });
      io.emit('status', 'Audio file generated successfully');
    } else {
      const errorMessage = 'Error: Audio file not found';
      res.status(500).json({ error: errorMessage });
      io.emit('status', errorMessage);
    }
  });
});

app.locals.footer = footerConfig;

const routes = [
  { path: '/', handler: indexRoute },
  { path: '/psychodelic-trigger-mania', handler: psychodelicTriggerManiaRouter },
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

    app.get('/zonos', (req, res) => {
      res.render('zonos', { audioPath: null, filename: null });
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
        console.log(patterns.server.info('Cookies received in handshake:', socket.handshake.headers.cookie));
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
            const { worker } = socketStore.get(socket.id);
            socketStore.delete(socket.id);
            console.log(patterns.server.info(`Client disconnected: ${socket.id} clients: ${userSessions.size} sockets: ${socketStore.size}`));
            worker.terminate();
            adjustMaxListeners(worker);
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
    const PORT = process.env.SERVER_PORT || 6969;
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