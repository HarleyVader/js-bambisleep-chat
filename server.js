import http from 'http';
import { Server } from 'socket.io';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Import app and other components
import { 
  app, 
  sessionMiddleware, 
  loadFilteredWords,
  initializeScraperSystem,
  initializeWorkerSystem
} from './src/app.js';

// Import utilities
import Logger from './src/utils/logger.js';
import connectToMongoDB from './src/utils/dbConnection.js';
import gracefulShutdown from './src/utils/gracefulShutdown.js';

// Socket handlers
import { initSocketHandlers } from '../bambisleep-profile/src/socket/handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logger
const logger = new Logger('Server');

dotenv.config();

// Create HTTP server and socket.io instance
const server = http.createServer(app);
const io = new Server(server);

// Initialize profile socket handlers
const profileIo = io.of('/profiles');
initSocketHandlers(profileIo);

// Load filtered words for message filtering
let filteredWords = [];

// Worker management
const MAX_LISTENERS_BASE = 10;
let currentMaxListeners = MAX_LISTENERS_BASE;
const socketStore = new Map();

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

// Filter messages using the filtered words list
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
    return message;
  }
}

// Get server network address
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
    return 'localhost';
  }
}

// Setup socket.io handlers
function setupSockets() {
  try {
    logger.info('Setting up socket middleware...');

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
        
        // Username handling
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

        // Profile socket handlers
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
          } catch (error) {
            logger.error(`Heart socket error: ${error.message}`);
            socket.emit('profile:error', 'Error processing heart action');
          }
        });

        // Add handlers for profile updates and messages (previously in eventBus)
        socket.on('profile:updated', ({ username, profile }) => {
          // Broadcast to all connected sockets
          io.emit('profile:updated', { username, profile });
        });
        
        socket.on('profile:message', (messageData) => {
          io.emit('chat message', {
            ...messageData,
            source: 'profile'
          });
        });

        // Worker event handlers
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

        lmstudio.on('error', (err) => {
          logger.error('Worker error:', err);
        });

        // Disconnect handling
        socket.on('disconnect', (reason) => {
          logger.info(`Client disconnected: ${socket.id}, Reason: ${reason}`);
          try {
            const { worker } = socketStore.get(socket.id) || {};
            if (worker) {
              worker.terminate();
              adjustMaxListeners(worker, false);
            }
            socketStore.delete(socket.id);
            logger.info(`Socket store size after disconnect: ${socketStore.size}`);
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

// Delay helper function
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Server initialization sequence
async function initializeServer() {
  try {
    // Step 1: Connect to MongoDB
    logger.info('Step 1/6: Connecting to MongoDB...');
    await connectToMongoDB();

    // Step 2: Load filtered words
    logger.info('Step 2/6: Loading filtered words...');
    filteredWords = await loadFilteredWords();
    
    // Step 3: Setup sockets
    logger.info('Step 3/6: Setting up socket handlers...');
    setupSockets();
    
    // Step 4: Initialize scrapers and workers (removed eventBus setup)
    logger.info('Step 4/5: Initializing subsystems...');
    await initializeScraperSystem();
    await initializeWorkerSystem();

    // Step 5: Start server (was Step 6 before)
    logger.info('Step 5/5: Starting HTTP server...');
    
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
    server.listen(PORT, async () => {
      logger.success(`Server running on http://${getServerAddress()}:${PORT}`);
      logger.success('Server initialization sequence completed successfully');
    });
  } catch (err) {
    logger.error('Error in server initialization sequence:', err);
    process.exit(1);
  }
}

// Start the server
initializeServer();