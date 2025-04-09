import { promises as fsPromises } from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import http from 'http';
import os from 'os';
import path from 'path';
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
import bambisRouter from './routes/bambis.js';

//schemas
import { Bambi } from './schemas/BambiSchema.js';

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
  pingTimeout: 86400000, // 1 day
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
app.use('/images', express.static(path.join(__dirname, 'public/images')));

app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'node_modules/socket.io/client-dist/socket.io.js'));
});

app.locals.footer = footerConfig;

const routes = [
  { path: '/', handler: indexRoute },
  { path: '/psychodelic-trigger-mania', handler: psychodelicTriggerManiaRouter },
  { path: '/help', handler: helpRoute },
  { path: '/scrapers', handler: scrapersRoute },
  { path: '/bambis', handler: bambisRouter }, // Add this line
];

// Configure Kokoro TTS API settings - updated to use KOKORO_HOST and KOKORO_PORT from .env
const KOKORO_HOST = process.env.KOKORO_HOST || 'localhost';
const KOKORO_PORT = process.env.KOKORO_PORT || 8880;
const KOKORO_API_URL = process.env.KOKORO_API_URL || `http://${KOKORO_HOST}:${KOKORO_PORT}/v1`;
const KOKORO_DEFAULT_VOICE = process.env.KOKORO_DEFAULT_VOICE || 'af_sky';
const KOKORO_API_KEY = process.env.KOKORO_API_KEY || 'not-needed';

// Log TTS configuration during startup
logger.info(`Kokoro TTS API configured with URL: ${KOKORO_API_URL}`);
logger.info(`Using default voice: ${KOKORO_DEFAULT_VOICE}`);

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

    // Add voice listing endpoint
    app.get('/api/tts/voices', async (req, res) => {
      try {
        const response = await axios({
          method: 'get',
          url: `${KOKORO_API_URL}/voices`,
          headers: {
            'Authorization': `Bearer ${KOKORO_API_KEY}`
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

    // Replace your existing TTS route with this middleware-style implementation
    app.get('/api/tts', async (req, res, next) => {
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
    });

    app.use('/api/scraper', scraperAPIRoutes);

    // Handle profile updates
    app.post('/bambis/update-profile', async (req, res) => {
      try {
        // Get username from session or cookie
        const username = req.session?.user?.username || 
                         decodeURIComponent(req.cookies['bambiname'] || '');
        
        if (!username) {
          return res.status(401).json({ 
              success: false, 
              message: 'You must be logged in to update your profile' 
          });
        }
        
        // Find and update the user's profile
        const bambi = await mongoose.model('Bambi').findOneAndUpdate(
            { username },
            { 
                $set: {
                    about: req.body.about,
                    description: req.body.description,
                    profilePictureUrl: req.body.profilePictureUrl,
                    headerImageUrl: req.body.headerImageUrl,
                    lastActive: new Date()
                }
            },
            { new: true, upsert: true }
        );
        
        // Respond with success
        res.json({ 
            success: true, 
            message: 'Profile updated successfully',
            bambi
        });
        
        // Emit socket event for real-time updates
        io.emit('profile:updated', {
            username,
            bambi
        });
        
      } catch (error) {
          logger.error('Profile update error:', error);
          res.status(500).json({ 
              success: false, 
              message: 'Server error occurred while updating profile' 
          });
      }
    });

  } catch (error) {
    logger.error('Error in setupRoutes:', error);
  }
}

// Add a dedicated fetchTTS function for Kokoro
async function fetchTTSFromKokoro(text, voice = KOKORO_DEFAULT_VOICE) {
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
      url: `${KOKORO_API_URL}/audio/speech`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KOKORO_API_KEY}`
      },
      data: requestData,
      responseType: 'arraybuffer',
      timeout: 30000
    });

    return response;
  } catch (error) {
    logger.error(`Error fetching TTS audio: ${error.message}`);
    throw error;
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
        
        // IMPROVED USERNAME HANDLING
        if (username === 'anonBambi') {
          socket.emit('prompt username');
        } else {
          // Load user's Bambi profile if it exists
          mongoose.model('Bambi').findOne({ username }).then(bambi => {
            if (bambi) {
              socket.bambiProfile = bambi;
              socket.emit('profile loaded', {
                username: bambi.username,
                displayName: bambi.displayName,
                level: bambi.level,
                triggers: bambi.triggers
              });
              
              // Update lastActive timestamp
              bambi.lastActive = Date.now();
              bambi.save().catch(err => logger.error('Error updating lastActive:', err));
            }
          }).catch(err => logger.error('Error loading Bambi profile:', err));
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

        // Add profile update event
        socket.on('update profile', async (profileData) => {
          try {
            if (username === 'anonBambi') {
              socket.emit('profile error', 'You need to set a username first');
              return;
            }
        
            // Don't duplicate functionality from the HTTP API
            // Instead, notify the user to use the profile editor
            socket.emit('redirect to profile editor', {
              message: 'Please use the profile editor to update your profile',
              url: '/bambis/edit'
            });
            
            // Optionally, we can still update simple things like triggers
            if (profileData.triggers && Array.isArray(profileData.triggers)) {
              try {
                const Bambi = mongoose.model('Bambi');
                let bambi = await Bambi.findOne({ username });
                
                if (bambi) {
                  // Use the manageTriggers method
                  const triggers = profileData.triggers.slice(0, 10); // Max 10
                  bambi.triggers = triggers;
                  await bambi.save();
                  socket.emit('triggers updated', bambi.triggers);
                }
              } catch (error) {
                logger.error('Error updating triggers via socket:', error);
                socket.emit('profile error', 'Failed to update triggers');
              }
            }
          } catch (error) {
            logger.error('Error handling profile update via socket:', error);
            socket.emit('profile error', 'Server error occurred');
          }
        });

        socket.on('profile:heart', async (data) => {
          try {
            const targetUsername = data.username;
            const currentUsername = socket.bambiProfile?.username || 
                                   decodeURIComponent(socket.handshake.headers.cookie
                                     ?.split(';')
                                     .find(c => c.trim().startsWith('bambiname='))
                                     ?.split('=')[1] || '');
            
            if (!currentUsername || currentUsername === 'anonBambi') {
              socket.emit('profile:error', 'You must be logged in to heart a profile');
              return;
            }
            
            const targetBambi = await mongoose.model('Bambi').findOne({ username: targetUsername });
            
            if (!targetBambi) {
              socket.emit('profile:error', 'Profile not found');
              return;
            }
            
            // Check if user has already hearted this profile
            const heartIndex = targetBambi.hearts.users.indexOf(currentUsername);
            let hearted = false;
            
            if (heartIndex === -1 && data.action !== 'unheart') {
              // Add heart
              targetBambi.hearts.users.push(currentUsername);
              targetBambi.hearts.count += 1;
              hearted = true;
            } else if (heartIndex !== -1 && data.action !== 'heart') {
              // Remove heart
              targetBambi.hearts.users.splice(heartIndex, 1);
              targetBambi.hearts.count = Math.max(0, targetBambi.hearts.count - 1);
            }
            
            await targetBambi.save();
            
            // Emit to all clients for real-time updates
            io.emit('profile:hearted', {
              username: targetUsername,
              count: targetBambi.hearts.count,
              hearted: hearted
            });
            
            logger.info(`User ${currentUsername} ${hearted ? 'hearted' : 'unhearted'} profile ${targetUsername}`);
          } catch (error) {
            logger.error(`Heart socket error: ${error.message}`);
            socket.emit('profile:error', 'Error processing heart action');
          }
        });

        socket.on('profile:update', async (data) => {
          try {
            if (username === 'anonBambi') return;
            
            const bambi = await mongoose.model('Bambi').findOne({ username });
            if (!bambi) return;
            
            // Only allow updates to certain fields via socket
            if (data.field === 'favoriteSeasons' && Array.isArray(data.value)) {
              bambi.favoriteSeasons = data.value.filter(season => 
                ['spring', 'summer', 'autumn', 'winter'].includes(season));
              await bambi.save();
              
              socket.emit('profile:updated', {
                field: data.field,
                value: bambi.favoriteSeasons
              });
            }
            
            // Update last active time
            bambi.lastActive = Date.now();
            await bambi.save();
          } catch (error) {
            logger.error('Error in profile:update handler:', error);
          }
        });

        // Handle profile view request via socket with improved error handling
        socket.on('profile:view', async (username) => {
          try {
            if (!username) {
              socket.emit('profile:error', 'Invalid username provided');
              return;
            }
            
            const bambi = await mongoose.model('Bambi').findOne({ username });
            
            if (bambi) {
              // Get current user for tracking who viewed this profile
              const currentUser = socket.bambiProfile?.username || 
                                 decodeURIComponent(socket.handshake.headers.cookie
                                   ?.split(';')
                                   .find(c => c.trim().startsWith('bambiname='))
                                   ?.split('=')[1] || '');
              
              // Record the view if this isn't the profile owner
              if (currentUser && currentUser !== username) {
                bambi.lastViewed = new Date();
                await bambi.save();
                
                // Only add view activity if we have the addActivity method
                if (typeof bambi.addActivity === 'function') {
                  bambi.addActivity('viewed', `Profile viewed by ${currentUser}`);
                }
              }
              
              socket.emit('profile:data', {
                bambi: bambi
              });
            } else {
              socket.emit('profile:error', 'Profile not found');
            }
          } catch (error) {
            logger.error(`Error fetching profile data: ${error.message}`);
            socket.emit('profile:error', 'Error loading profile');
          }
        });

        // Add better error handling for profile:save
        socket.on('profile:save', async (profileData) => {
          try {
            // Get username with better fallback logic
            const username = socket.bambiProfile?.username || 
                            decodeURIComponent(socket.handshake.headers.cookie?.split(';')
                              .find(c => c.trim().startsWith('bambiname='))
                              ?.split('=')[1] || '');
            
            if (!username || username === 'anonBambi') {
              socket.emit('profile:error', 'You must be logged in to update your profile');
              return;
            }
            
            logger.info(`Socket profile update for user: ${username}`);
            
            // Sanitize input data
            const sanitizedData = {
              about: (profileData.about || '').substring(0, 2000),
              description: (profileData.description || '').substring(0, 500),
              profilePictureUrl: profileData.profilePictureUrl,
              headerImageUrl: profileData.headerImageUrl
            };
            
            // Only update with valid URLs
            const urlPattern = /^(https?:\/\/|\/)[a-zA-Z0-9_\/.\-~:]+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i;
            if (sanitizedData.profilePictureUrl && !urlPattern.test(sanitizedData.profilePictureUrl)) {
              delete sanitizedData.profilePictureUrl;
            }
            if (sanitizedData.headerImageUrl && !urlPattern.test(sanitizedData.headerImageUrl)) {
              delete sanitizedData.headerImageUrl;
            }
            
            // Find and update the user's profile
            const bambi = await mongoose.model('Bambi').findOneAndUpdate(
              { username },
              { 
                $set: {
                  ...sanitizedData,
                  lastActive: new Date()
                }
              },
              { new: true, upsert: true }
            );
            
            // Send success message back to the client that made the update
            socket.emit('profile:saved', {
              success: true,
              bambi: bambi,
              message: 'Profile updated successfully'
            });
            
            // Broadcast to all other clients viewing this profile
            socket.broadcast.emit('profile:updated', {
              username,
              bambi: bambi
            });
            
            logger.success(`Profile updated for ${username} via socket`);
          } catch (error) {
            logger.error('Socket profile update error:', error);
            socket.emit('profile:error', 'Error updating profile');
          }
        });

        // Add this to your existing socket.io connection handler in setupSockets()
        socket.on('profile:save', async (profileData) => {
          try {
            // Get username from socket connection
            const username = socket.bambiProfile?.username || 
                            decodeURIComponent(socket.handshake.headers.cookie?.split(';')
                              .find(c => c.trim().startsWith('bambiname='))
                              ?.split('=')[1] || '');
            
            if (!username || username === 'anonBambi') {
              socket.emit('profile:error', 'You must be logged in to update your profile');
              return;
            }
            
            logger.info(`Socket profile update for user: ${username}`);
            
            // Find and update the user's profile
            const bambi = await mongoose.model('Bambi').findOneAndUpdate(
              { username },
              { 
                $set: {
                  about: profileData.about,
                  description: profileData.description,
                  profilePictureUrl: profileData.profilePictureUrl,
                  headerImageUrl: profileData.headerImageUrl,
                  lastActive: new Date()
                }
              },
              { new: true, upsert: true }
            );
            
            // Send success message back to the client that made the update
            socket.emit('profile:saved', {
              success: true,
              bambi: bambi,
              message: 'Profile updated successfully'
            });
            
            // Broadcast to all other clients viewing this profile
            socket.broadcast.emit('profile:updated', {
              username,
              bambi: bambi
            });
            
            logger.success(`Profile updated for ${username} via socket`);
          } catch (error) {
            logger.error('Socket profile update error:', error);
            socket.emit('profile:error', 'Error updating profile');
          }
        });

        // Handle profile view request via socket
        socket.on('profile:view', async (username) => {
          try {
            if (!username) return;
            
            const bambi = await mongoose.model('Bambi').findOne({ username });
            
            if (bambi) {
              socket.emit('profile:data', {
                bambi: bambi
              });
              
              // Update last viewed timestamp
              bambi.lastViewed = new Date();
              await bambi.save();
            } else {
              socket.emit('profile:error', 'Profile not found');
            }
          } catch (error) {
            logger.error(`Error fetching profile data: ${error.message}`);
            socket.emit('profile:error', 'Error loading profile');
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
    logger.info('Step 5/6: Initializing speech synthesis worker and preloading model...');
    await delay(150);
    await delay(200);

    // Step 6: Setup routes, sockets, and error handlers
    logger.info('Step 6/6: Setting up server components...');
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