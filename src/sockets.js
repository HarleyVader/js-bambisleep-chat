import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import { User, UserProfile } from './models/user.js';
import { SocketStats, ServerStats } from './schemas/Stats.js';
import { createNodeHandler } from './utils/nodeHandler.js';
import Logger from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logger
const logger = new Logger('Socket');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/bambi-profiles', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Session middleware
const sessionMiddleware = session({
  secret: 'bambi-forest-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: 'mongodb://localhost:27017/bambi-profiles',
    collection: 'sessions' 
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  }
});

// Apply session middleware to Express
app.use(sessionMiddleware);

// Share session with Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Configure Express
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize database node handler
const nodeHandler = createNodeHandler();

// Track online users
const onlineUsers = new Map();

// Listener management for workers
const MAX_LISTENERS_BASE = 10;
let currentMaxListeners = MAX_LISTENERS_BASE;

const adjustMaxListeners = (worker, increment = true) => {
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
};

// Message filtering function
const filter = (message, filteredWords = []) => {
  try {
    if (typeof message !== 'string') {
      message = String(message);
    }
    
    if (filteredWords.length > 0) {
      return message
        .split(' ')
        .map((word) => {
          return filteredWords.includes(word.toLowerCase()) ? '[filtered]' : word;
        })
        .join(' ')
        .trim();
    }
    
    return message.trim();
  } catch (error) {
    logger.error('Error in filter:', error);
    return message;
  }
};

// Message relay system - handles different types of messages
class SocketRelay {
  constructor(io) {
    this.io = io;
    this.messageHandlers = new Map();
    this.stats = {
      totalMessages: 0,
      messageTypes: {},
      errorsCount: 0,
      lastError: null
    };
    
    // Register default message handlers
    this.registerHandler('chat', this.handleChatMessage);
    this.registerHandler('dm', this.handleDirectMessage);
    this.registerHandler('system', this.handleSystemMessage);
    this.registerHandler('broadcast', this.handleBroadcast);
  }

  registerHandler(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  async processMessage(socket, message) {
    try {
      this.stats.totalMessages++;
      
      // Extract message type, default to 'chat'
      const type = message.type || 'chat';
      
      // Track message type stats
      if (!this.stats.messageTypes[type]) {
        this.stats.messageTypes[type] = 0;
      }
      this.stats.messageTypes[type]++;
      
      // Find and execute the appropriate handler
      const handler = this.messageHandlers.get(type);
      if (handler) {
        await handler.call(this, socket, message);
      } else {
        // Default to chat message if no handler found
        await this.handleChatMessage(socket, message);
      }
      
      // Save message stats to database
      await this.saveMessageStats(socket, message);
      
      // Log server stats
      await this.logServerStats('messages', 1, { messageType: type });
      
    } catch (error) {
      this.stats.errorsCount++;
      this.stats.lastError = {
        message: error.message,
        timestamp: new Date()
      };
      logger.error('Message processing error:', error);
      socket.emit('error', { message: 'Failed to process message' });
      
      // Log error stats
      await this.logServerStats('errors', 1, { error: error.message });
    }
  }

  async saveMessageStats(socket, message) {
    try {
      const userId = socket.request.session.userId;
      if (!userId) return;
      
      // Save message stats to database using the imported SocketStats model
      await SocketStats.create({
        userId,
        messageType: message.type || 'chat',
        timestamp: new Date(),
        content: message.content ? message.content.substring(0, 100) : null, // Store truncated content for analysis
        metadata: {
          socketId: socket.id,
          username: socket.request.session.username
        }
      });
    } catch (error) {
      logger.error('Error saving message stats:', error);
    }
  }
  
  async logServerStats(metric, value, metadata = {}) {
    try {
      // Use the imported ServerStats model to log server metrics
      await ServerStats.create({
        metric,
        value,
        timestamp: new Date(),
        metadata
      });
    } catch (error) {
      logger.error(`Error logging server stats for ${metric}:`, error);
    }
  }

  async handleChatMessage(socket, message) {
    const session = socket.request.session;
    const timestamp = new Date().toISOString();
    
    // Send to all connected clients
    this.io.emit('chat message', {
      ...message,
      timestamp,
      username: session.username
    });
  }

  async handleDirectMessage(socket, message) {
    const session = socket.request.session;
    const { targetUserId, content } = message;
    
    if (!targetUserId) {
      return socket.emit('error', { message: 'Target user ID is required for direct messages' });
    }
    
    // Send to specific user and back to sender
    this.io.to(`user:${targetUserId}`).emit('direct message', {
      content,
      timestamp: new Date().toISOString(),
      fromUserId: session.userId,
      fromUsername: session.username
    });
    
    // Confirm to sender
    socket.emit('dm sent', {
      toUserId: targetUserId,
      content,
      timestamp: new Date().toISOString()
    });
  }

  async handleSystemMessage(socket, message) {
    // System messages are sent by the server to specific users or all users
    const { targetUserId, content, broadcast } = message;
    
    if (broadcast) {
      // Send to all users
      this.io.emit('system message', {
        content,
        timestamp: new Date().toISOString()
      });
    } else if (targetUserId) {
      // Send to specific user
      this.io.to(`user:${targetUserId}`).emit('system message', {
        content,
        timestamp: new Date().toISOString()
      });
    }
  }

  async handleBroadcast(socket, message) {
    const session = socket.request.session;
    if (!session.isAdmin) {
      return socket.emit('error', { message: 'Unauthorized: Admin privileges required for broadcast' });
    }
    
    // Broadcast to all connected clients
    this.io.emit('broadcast', {
      content: message.content,
      timestamp: new Date().toISOString(),
      fromAdmin: session.username
    });
  }

  getStats() {
    return {
      ...this.stats,
      currentTime: new Date().toISOString()
    };
  }
}

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/login');
};

// Initialize socket relay
const socketRelay = new SocketRelay(io);

// Core Socket.io connection handler with user session management
const setupRelaySocket = () => {
  io.on('connection', (socket) => {
    const session = socket.request.session;
    const userId = session.userId;
    
    if (userId) {
      logger.info(`User connected: ${userId}`);
      onlineUsers.set(userId, socket.id);
      
      // Track connection in stats
      nodeHandler.logConnection({
        userId,
        socketId: socket.id,
        timestamp: new Date()
      });
      
      // Log connection stats
      socketRelay.logServerStats('connections', 1, { 
        userId,
        socketId: socket.id
      });
      
      // Broadcast user online status
      socket.broadcast.emit('user:online', userId);
      
      // Join user's room for private updates
      socket.join(`user:${userId}`);
      
      // Send list of online users
      socket.emit('online:users', Array.from(onlineUsers.keys()));
      
      // Handle relay messages
      socket.on('relay', async (message) => {
        await socketRelay.processMessage(socket, message);
      });
      
      // Handle profile updates
      socket.on('profile:update', async (data) => {
        try {
          if (!userId || !data.field || data.value === undefined) return;
          
          const updateData = {};
          updateData[data.field] = data.value;
          
          // Use node handler for database operations
          const profile = await nodeHandler.updateUserProfile(userId, updateData);
          
          if (!profile) return;
          
          // Emit to all user's connected devices
          io.to(`user:${userId}`).emit('profile:updated', {
            field: data.field,
            value: data.value
          });
          
          // Notify friends of the update
          if (profile.friends && profile.friends.length > 0) {
            const notificationData = {
              userId,
              username: session.username,
              field: data.field,
              timestamp: new Date()
            };
            
            profile.friends.forEach(friendId => {
              io.to(`user:${friendId}`).emit('friend:profile:updated', notificationData);
            });
          }
        } catch (error) {
          logger.error('Profile update error:', error);
        }
      });
      
      // Handle adding/removing friends
      socket.on('friend:add', async (friendId) => {
        try {
          // Use node handler for database operations
          await nodeHandler.addFriend(userId, friendId);
          
          // Notify the friend
          io.to(`user:${friendId}`).emit('friend:request:accepted', {
            userId,
            username: session.username
          });
          
          // Send updated profile back to user
          const updatedProfile = await UserProfile.findOne({ userId });
          socket.emit('profile:friends:updated', updatedProfile.friends);
        } catch (error) {
          logger.error('Add friend error:', error);
        }
      });
      
      socket.on('friend:remove', async (friendId) => {
        try {
          // Use node handler for database operations
          await nodeHandler.removeFriend(userId, friendId);
          
          // Notify the friend
          io.to(`user:${friendId}`).emit('friend:removed', {
            userId,
            username: session.username
          });
          
          // Send updated profile back to user
          const updatedProfile = await UserProfile.findOne({ userId });
          socket.emit('profile:friends:updated', updatedProfile.friends);
        } catch (error) {
          logger.error('Remove friend error:', error);
        }
      });
      
      // Handle database operations
      socket.on('db:operation', async (data) => {
        try {
          const { operation, collection, query, update, options } = data;
          
          // Check if user has permission to perform this operation
          if (!session.isAdmin) {
            return socket.emit('error', { message: 'Unauthorized database operation' });
          }
          
          const result = await nodeHandler.performOperation(operation, collection, query, update, options);
          socket.emit('db:result', result);
          
          // Log database operation
          socketRelay.logServerStats('operations', 1, { 
            operation, 
            collection 
          });
        } catch (error) {
          logger.error('Database operation error:', error);
          socket.emit('error', { message: 'Database operation failed' });
        }
      });
      
      // Handle health check request
      socket.on('health:check', async () => {
        try {
          const health = await nodeHandler.checkHealth();
          socket.emit('health:status', health);
        } catch (error) {
          logger.error('Health check error:', error);
          socket.emit('health:status', { 
            status: 'error', 
            message: error.message 
          });
        }
      });
      
      // Handle stats request
      socket.on('stats:request', async () => {
        try {
          const stats = await nodeHandler.getStats();
          
          // Add socket relay stats
          stats.socketStats = socketRelay.getStats();
          
          // Add server stats from the database
          const lastHour = new Date(Date.now() - 60 * 60 * 1000);
          const serverMetrics = await ServerStats.find({
            timestamp: { $gte: lastHour }
          }).lean();
          
          // Group by metric type
          const metricsByType = serverMetrics.reduce((acc, metric) => {
            if (!acc[metric.metric]) {
              acc[metric.metric] = [];
            }
            acc[metric.metric].push({
              value: metric.value,
              timestamp: metric.timestamp,
              metadata: metric.metadata
            });
            return acc;
          }, {});
          
          stats.serverMetrics = metricsByType;
          
          socket.emit('stats:data', stats);
        } catch (error) {
          logger.error('Stats request error:', error);
          socket.emit('error', { message: 'Failed to retrieve stats' });
        }
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`User disconnected: ${userId}`);
        
        // Log disconnection in stats
        nodeHandler.logDisconnection({
          userId,
          socketId: socket.id,
          timestamp: new Date()
        });
        
        // Log disconnection stats
        socketRelay.logServerStats('connections', -1, {
          userId,
          socketId: socket.id,
          type: 'disconnect'
        });
        
        onlineUsers.delete(userId);
        socket.broadcast.emit('user:offline', userId);
      });
    }
  });
};

// Bambisleep-chat specific socket setup with worker threads
const setupSockets = (filteredWords = []) => {
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
        
        // Log connection in server stats
        socketRelay.logServerStats('connections', 1, {
          socketId: socket.id,
          username,
          type: 'bambichat'
        });
        
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
            
            // Log message stats
            await SocketStats.create({
              userId: socket.id, // Using socketId instead of userId for anonymous users
              messageType: 'chat',
              timestamp: new Date(),
              content: msg?.content ? msg.content.substring(0, 100) : null,
              metadata: { username }
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
            const filteredMessage = filter(message, filteredWords);
            lmstudio.postMessage({
              type: "message",
              data: filteredMessage,
              socketId: socket.id,
              username: username
            });
            
            // Log AI message request
            socketRelay.logServerStats('messages', 1, {
              type: 'ai_request',
              username
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
            const filteredCollar = filter(collarData.data, filteredWords);
            lmstudio.postMessage({
              type: 'collar',
              data: filteredCollar,
              socketId: socket.id
            });
            io.to(collarData.socketId).emit('collar', filteredCollar);
            
            // Log collar message
            socketRelay.logServerStats('messages', 1, {
              type: 'collar',
              username
            });
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
                  
                  // Log profile update
                  socketRelay.logServerStats('operations', 1, {
                    type: 'profile_update',
                    username,
                    field: 'triggers'
                  });
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

        lmstudio.on("message", async (msg) => {
          try {
            if (msg.type === "log") {
              logger.info(msg.data, msg.socketId);
            } else if (msg.type === 'response') {
              const responseData = typeof msg.data === 'object' ? JSON.stringify(msg.data) : msg.data;
              io.to(msg.socketId).emit("response", responseData);
              
              // Log AI response
              socketRelay.logServerStats('messages', 1, {
                type: 'ai_response',
                socketId: msg.socketId
              });
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
};

// Initialize socket handlers based on mode
const initializeSockets = (mode = 'all', filteredWords = []) => {
  if (mode === 'relay' || mode === 'all') {
    setupRelaySocket();
  }
  
  if (mode === 'worker' || mode === 'all') {
    setupSockets(filteredWords);
  }
  
  return { io, socketRelay };
};

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
});

// Export for importing in server.js
export {
  io as socketServer,
  socketRelay,
  nodeHandler,
  onlineUsers,
  setupSockets,
  initializeSockets,
  filter,
  adjustMaxListeners
};