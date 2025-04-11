import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import Logger from '../utils/logger.js';
import mongoose from 'mongoose';
import { socketAuth } from './middleware.js';

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = new Logger('SocketManager');

// Active socket connections and worker instances tracking
const socketStore = new Map();
const activeWorkers = new Map();

/**
 * Main function to setup and initialize Socket.io connections
 * @param {SocketIO.Server} io - The Socket.io server instance
 * @returns {SocketIO.Server} - The configured Socket.io server
 */
export function initializeSockets(io) {
  // Set up main namespace
  const mainNamespace = io.of('/');
  setupMainNamespace(mainNamespace);
  
  // Set up bambis namespace
  const bambisNamespace = io.of('/bambis');
  setupBambisNamespace(bambisNamespace);
  
  return io;
}

/**
 * Set up the main socket.io namespace with all event handlers
 * @param {SocketIO.Namespace} io - The main namespace
 */
function setupMainNamespace(io) {
  // Apply auth middleware
  io.use(socketAuth);
  
  io.on('connection', (socket) => {
    logger.success(`Client connected: ${socket.id}`);
    
    // Get username from cookie
    const username = getUsernameFromCookie(socket);
    socket.username = username;
    
    // Join user-specific room if authenticated
    if (username && username !== 'anonBambi') {
      socket.join(`user:${username}`);
      
      // Load user profile
      loadUserBambi(socket, username);
    }
    
    // Initialize worker thread for this connection
    const worker = startWorkerForSocket(socket);
    socketStore.set(socket.id, { socket, worker, files: [] });
    
    // Set up all event handlers
    setupConnectionHandlers(socket, io);
    setupChatHandlers(socket, io, worker, username);
    setupLLMHandlers(socket, io, worker, username);
    setupUserHandlers(socket, io);
    setupWorkerHandlers(socket, io, worker);
    
    // Disconnect handling
    socket.on('disconnect', () => handleDisconnect(socket, io));
  });
}

/**
 * Set up the bambis namespace with profile-related event handlers
 * @param {SocketIO.Namespace} io - The bambis namespace
 */
function setupBambisNamespace(io) {
  io.use(socketAuth);
  
  io.on('connection', (socket) => {
    logger.success(`Bambi client connected: ${socket.id}`);
    
    // Set up bambi-specific event handlers
    socket.on('bambi:view', (username) => handleBambiView(socket, io, username));
    socket.on('bambi:save', (data) => handleBambiSave(socket, io, data));
    socket.on('bambi:heart', (data) => handleBambiHeart(socket, io, data));
    
    // Disconnect handling
    socket.on('disconnect', () => {
      logger.info(`Bambi client disconnected: ${socket.id}`);
    });
  });
}

/**
 * Set up connection-related event handlers
 * @param {SocketIO.Socket} socket - The socket instance
 * @param {SocketIO.Namespace} io - The namespace
 */
function setupConnectionHandlers(socket, io) {
  socket.on('connection_info', (info) => {
    logger.info(`Connection type for ${socket.id}: ${info.type}`);
    socket.connectionType = info.type; // 'service-worker' or 'direct'
    
    // Store connection info in session if available
    if (socket.request.session) {
      socket.request.session.connectionType = info.type;
      socket.request.session.save();
    }
    
    // Apply different connection settings based on connection type
    if (info.type === 'service-worker') {
      // Service worker connections need longer timeouts
      socket.conn.pingInterval = 30000; // 30 seconds
      socket.conn.pingTimeout = 15000; // 15 seconds
      
      socket.emit('connection_info_ack', { 
        status: 'connected',
        type: 'service-worker',
        id: socket.id,
        username: socket.username || null
      });
    } else if (info.type === 'direct') {
      // Direct connections get more frequent heartbeats
      socket.conn.pingInterval = 10000; // 10 seconds
      socket.conn.pingTimeout = 5000; // 5 seconds
      
      socket.emit('connection_info_ack', { 
        status: 'connected',
        type: 'direct',
        id: socket.id,
        username: socket.username || null
      });
    }
    
    // Update worker with connection info
    const worker = activeWorkers.get(socket.id);
    if (worker) {
      worker.postMessage({
        type: 'connection_info',
        connectionType: info.type,
        socketId: socket.id
      });
    }
  });
  
  // Handle reconnection attempts
  socket.on('reconnect_attempt', (attemptNumber) => {
    logger.info(`Reconnection attempt ${attemptNumber} for ${socket.id}`);
    
    // If this was a service worker connection, notify client
    if (socket.connectionType === 'service-worker') {
      io.to(socket.id).emit('system', {
        type: 'info',
        message: `Reconnecting (attempt ${attemptNumber})...`
      });
    }
  });

  // Handle successful reconnection
  socket.on('reconnect', () => {
    logger.success(`Client ${socket.id} reconnected successfully`);
    
    // Re-establish any state that was lost during the disconnection
    if (socket.username && socket.username !== 'anonBambi') {
      // Re-join the user-specific room
      socket.join(`user:${socket.username}`);
    }
    
    // Notify client about successful reconnection
    io.to(socket.id).emit('system', {
      type: 'success',
      message: 'Reconnected successfully'
    });
  });

  // Handle errors
  socket.on('error', (error) => {
    logger.error(`Socket error for ${socket.id}: ${error.message}`);
  });
}

/**
 * Set up chat message event handlers
 * @param {SocketIO.Socket} socket - The socket instance 
 * @param {SocketIO.Namespace} io - The namespace
 * @param {Worker} worker - The worker thread
 * @param {string} username - The username
 */
function setupChatHandlers(socket, io, worker, username) {
  socket.on('chat message', (msg) => {
    // Basic input validation
    if (!msg || !msg.data || typeof msg.data !== 'string' || msg.data.trim() === '') {
      return;
    }
    
    logger.info(`Chat message from ${username}: ${msg.data.substring(0, 50)}${msg.data.length > 50 ? '...' : ''}`);
    
    // Broadcast message to all clients
    const messageData = {
      username: username,
      message: msg.data,
      timestamp: new Date().toISOString()
    };
    io.emit('chat message', messageData);

    // Forward to worker if needed
    if (worker) {
      worker.postMessage({
        type: 'message',
        data: msg.data,
        socketId: socket.id,
        username: username
      });
    }
  });
}

/**
 * Set up LLM-related event handlers
 * @param {SocketIO.Socket} socket - The socket instance
 * @param {SocketIO.Namespace} io - The namespace
 * @param {Worker} worker - The worker thread
 * @param {string} username - The username 
 */
function setupLLMHandlers(socket, io, worker, username) {
  // Standard message to LLM
  socket.on('message', (msg) => {
    // Basic input validation
    if (!msg || typeof msg !== 'string' || msg.trim() === '') {
      return;
    }
    
    if (!worker) {
      socket.emit('system', { type: 'error', message: 'AI service unavailable' });
      return;
    }
    
    logger.info(`LLM request from ${username}: ${msg.substring(0, 50)}${msg.length > 50 ? '...' : ''}`);
    
    // Send message to worker
    worker.postMessage({
      type: 'message',
      data: msg,
      socketId: socket.id,
      username: username
    });
    
    // Let user know request is processing
    socket.emit('llm:status', { status: 'processing' });
  });
  
  // Handle trigger updates
  socket.on('triggers', (data) => {
    if (!worker) return;
    
    worker.postMessage({
      type: 'triggers',
      data: data,
      socketId: socket.id
    });
  });
  
  // Legacy route for backward compatibility
  socket.on('update triggers', (triggers) => {
    if (!worker) return;
    
    logger.info(`Trigger update from ${username}`);
    worker.postMessage({
      type: 'triggers',
      triggers: triggers,
      socketId: socket.id
    });
  });

  // Handle collar updates
  socket.on('collar', (msg) => {
    if (!worker) return;
    
    logger.info(`Collar event from ${username}`);
    
    worker.postMessage({
      type: 'collar',
      data: msg.data,
      socketId: socket.id
    });
    
    // Broadcast collar status to all clients
    io.emit('collar:update', msg.data);
  });
  
  // Handle query messages for AI processing
  socket.on('query', (data) => {
    if (!worker) {
      socket.emit('error', { error: 'Worker not available' });
      return;
    }
    
    logger.info(`Query from ${username}: ${JSON.stringify(data).substring(0, 50)}...`);
    
    worker.postMessage({
      type: 'query',
      data: data,
      requestId: data.requestId,
      socketId: socket.id
    });
  });
}

/**
 * Set up user-related event handlers
 * @param {SocketIO.Socket} socket - The socket instance
 * @param {SocketIO.Namespace} io - The namespace
 */
function setupUserHandlers(socket, io) {
  const username = getUsernameFromCookie(socket);
  if (username && username !== 'anonBambi') {
    // Send auth status to client on connection
    socket.emit('auth:status', { 
      authenticated: true,
      username: username 
    });
    
    // Load the bambi data for this user
    loadUserBambi(socket, username);
  }
  
  socket.on('set username', (newUsername) => {
    // Validate username
    if (!newUsername || typeof newUsername !== 'string' || newUsername.trim() === '') {
      socket.emit('username:error', 'Invalid username');
      return;
    }
    
    const sanitizedUsername = newUsername.trim().substring(0, 30);
    logger.info(`Username set: ${sanitizedUsername} for socket ${socket.id}`);
    
    // Update socket
    socket.username = sanitizedUsername;
    
    // Join user-specific room
    socket.join(`user:${sanitizedUsername}`);
    
    // Set username in cookie
    socket.emit('set:cookie', {
      name: 'bambiname',
      value: encodeURIComponent(sanitizedUsername),
      days: 30
    });
    
    socket.emit('username:set', sanitizedUsername);
  });
  
  socket.on('bambi update', (bambiData) => {
    logger.info(`Bambi update from ${socket.username || 'anonymous'}`);
    
    // Forward to relevant handler or API endpoint
    io.to(socket.id).emit('bambi update status', { 
      success: true, 
      message: 'Bambi update received' 
    });
  });
}

/**
 * Set up worker-related event handlers
 * @param {SocketIO.Socket} socket - The socket instance
 * @param {SocketIO.Namespace} io - The namespace
 * @param {Worker} worker - The worker thread
 */
function setupWorkerHandlers(socket, io, worker) {
  if (!worker) return;
  
  worker.on('message', (message) => {
    // Process worker messages
    handleWorkerMessage(socket, io, message);
  });
}

/**
 * Start a worker thread for a socket connection
 * @param {SocketIO.Socket} socket - The socket instance
 * @returns {Worker|null} - The worker thread instance or null
 */
function startWorkerForSocket(socket) {
  try {
    const workerPath = path.join(__dirname, '..', 'workers', 'lmstudio.js');
    const worker = new Worker(workerPath);
    
    logger.success(`Worker started for socket ${socket.id}`);
    
    worker.on('message', (message) => {
      if (message.socketId) {
        handleWorkerMessage(socket, socket.nsp, message);
      } else {
        logger.warning(`Worker message without socketId: ${JSON.stringify(message)}`);
      }
    });
    
    worker.on('error', (error) => {
      logger.error(`Worker error for socket ${socket.id}: ${error.message}`);
      socket.emit('error', { 
        error: 'AI processing error', 
        details: error.message 
      });
    });
    
    worker.on('exit', (code) => {
      logger.warning(`Worker exited with code ${code} for socket ${socket.id}`);
      activeWorkers.delete(socket.id);
      
      // Notify client if abnormal exit
      if (code !== 0) {
        socket.emit('error', { 
          error: 'AI processing service restarting',
          reconnect: true
        });
      }
    });
    
    // Store worker reference
    activeWorkers.set(socket.id, worker);
    
    return worker;
  } catch (error) {
    logger.error(`Failed to start worker for socket ${socket.id}: ${error.message}`);
    socket.emit('error', { 
      error: 'Failed to initialize AI processing', 
      details: error.message
    });
    return null;
  }
}

/**
 * Handle disconnect event for a socket
 * @param {SocketIO.Socket} socket - The socket instance
 */
function handleDisconnect(socket) {
  try {
    logger.info(`Client disconnected: ${socket.id}`);
    
    // Get socket data
    const socketData = socketStore.get(socket.id);
    if (socketData) {
      // Terminate worker if it exists
      if (socketData.worker) {
        socketData.worker.terminate()
          .catch(err => logger.error(`Error terminating worker: ${err.message}`));
      }
      
      // Clean up any other resources
      
      // Remove socket from store
      socketStore.delete(socket.id);
    }
    
    // Delete from active workers map
    if (activeWorkers.has(socket.id)) {
      activeWorkers.delete(socket.id);
    }
  } catch (error) {
    logger.error(`Error handling disconnect for ${socket.id}:`, error);
  }
}

/**
 * Handle messages from worker threads
 * @param {SocketIO.Socket} socket - The socket instance
 * @param {SocketIO.Namespace} io - The namespace
 * @param {object} data - The message data
 */
function handleWorkerMessage(socket, io, data) {
  try {
    if (!data) return;
    
    if (data.type === 'response') {
      // Send AI response to client - Use the correct data field and event name
      socket.emit('response', data.data);
      logger.success(`LLM response sent to ${socket.id}`);
    } else if (data.type === 'query_response') {
      // For query-specific responses
      socket.emit('query response', data.data);
    } else if (data.type === 'status') {
      // Send status update to client
      socket.emit('llm:status', {
        status: data.status,
        message: data.message
      });
      
      logger.info(`LLM status update: ${data.status} - ${data.message || ''}`);
    } else if (data.type === 'error') {
      // Send error to client
      socket.emit('system', {
        type: 'error',
        message: data.message || 'AI processing error'
      });
      
      logger.error(`LLM worker error: ${data.message}`);
    } else if (data.type === 'broadcast') {
      // Broadcast message to all clients
      io.emit('broadcast', {
        message: data.message,
        sender: data.sender || 'System'
      });
      
      logger.info(`Broadcast message sent: ${data.message}`);
    } else if (data.level && data.message && data.module) {
      // Format based on the TextScraper worker format
      logger.info(`Worker [${data.module}]: ${data.message}`);
    } else {
      // Default case - just emit the message
      socket.emit('message', data);
    }
  } catch (error) {
    logger.error('Error handling worker message:', error);
  }
}

/**
 * Get username from cookie
 * @param {SocketIO.Socket} socket - The socket instance
 * @returns {string} - The username or 'anonBambi' if not found
 */
function getUsernameFromCookie(socket) {
  try {
    const cookies = socket.handshake.headers.cookie || '';
    const bambinameCookie = cookies.split(';')
      .find(c => c.trim().startsWith('bambiname='));
    
    if (!bambinameCookie) return 'anonBambi';
    
    return decodeURIComponent(bambinameCookie.split('=')[1]);
  } catch (error) {
    logger.error('Error extracting username from cookie:', error);
    return 'anonBambi';
  }
}

/**
 * Load user bambi data
 * @param {SocketIO.Socket} socket - The socket instance
 * @param {string} username - The username
 */
async function loadUserBambi(socket, username) {
  try {
    if (!username || username === 'anonBambi') {
      return;
    }
    
    const bambi = await mongoose.model('Bambi').findOne({ username });
    
    if (bambi) {
      // Update last active timestamp
      bambi.lastActive = new Date();
      await bambi.save();
      
      socket.emit('bambi:loaded', {
        username: bambi.username,
        avatarUrl: bambi.bambiPictureUrl,
        level: bambi.level || 1
      });
    }
  } catch (error) {
    logger.error(`Error loading bambi for ${username}:`, error);
  }
}

/**
 * Handle bambis view event
 * @param {SocketIO.Socket} socket - The socket instance
 * @param {SocketIO.Namespace} io - The namespace
 * @param {string} username - The username to view
 */
function handleBambiView(socket, io, username) {
  try {
    if (!username) {
      socket.emit('bambi:error', 'Invalid username provided');
      return;
    }
    
    logger.info(`Bambi view request for ${username} from ${socket.id}`);
    
    mongoose.model('Bambi').findOne({ username })
      .then(bambi => {
        if (bambi) {
          // Get current user info
          const currentUser = getUsernameFromCookie(socket);
          
          // Record view if not owner
          if (currentUser && currentUser !== username) {
            bambi.viewCount = (bambi.viewCount || 0) + 1;
            bambi.lastViewed = new Date();
            bambi.save().catch(err => logger.error(`Error saving view count: ${err.message}`));
          }
          
          socket.emit('bambi:data', { bambi });
        } else {
          socket.emit('bambi:error', 'Bambi not found');
        }
      })
      .catch(error => {
        logger.error(`Error fetching bambi: ${error.message}`);
        socket.emit('bambi:error', 'Error loading bambi');
      });
  } catch (error) {
    logger.error('Error handling bambi view:', error);
    socket.emit('bambi:error', 'Server error processing bambi request');
  }
}

/**
 * Handle bambi save event
 * @param {SocketIO.Socket} socket - The socket instance
 * @param {SocketIO.Namespace} io - The namespace
 * @param {object} data - The save data
 */
function handleBambiSave(socket, io, data) {
  try {
    if (!data) {
      socket.emit('bambi:save:error', 'No bambi data provided');
      return;
    }
    
    const username = getUsernameFromCookie(socket);
    if (!username || username === 'anonBambi') {
      socket.emit('bambi:save:error', 'You must be logged in to save a bambi');
      return;
    }
    
    logger.info(`Bambi save request for ${username}`);
    
    mongoose.model('Bambi').findOneAndUpdate(
      { username },
      {
        $set: {
          about: data.about,
          description: data.description,
          bambiPictureUrl: data.bambiPictureUrl,
          headerImageUrl: data.headerImageUrl,
          lastModified: new Date(),
          lastActive: new Date()
        }
      },
      { new: true, upsert: true }
    )
    .then(bambi => {
      socket.emit('bambi:save:success', { bambi });
      logger.success(`Bambi saved for ${username}`);
    })
    .catch(error => {
      logger.error(`Error saving bambi: ${error.message}`);
      socket.emit('bambi:save:error', 'Error saving bambi');
    });
  } catch (error) {
    logger.error('Error handling bambi save:', error);
    socket.emit('bambi:save:error', 'Server error processing bambi save');
  }
}

/**
 * Handle bambi heart event
 * @param {SocketIO.Socket} socket - The socket instance
 * @param {SocketIO.Namespace} io - The namespace
 * @param {object} data - The heart data
 */
function handleBambiHeart(socket, io, data) {
  try {
    if (!data || !data.username) {
      socket.emit('bambi:heart:error', 'Invalid request');
      return;
    }
    
    const currentUser = getUsernameFromCookie(socket);
    if (!currentUser || currentUser === 'anonBambi') {
      socket.emit('bambi:heart:error', 'You must be logged in to heart a bambi');
      return;
    }
    
    // Don't allow self-hearts
    if (currentUser === data.username) {
      socket.emit('bambi:heart:error', 'You cannot heart your own bambi');
      return;
    }
    
    logger.info(`Heart request for ${data.username} from ${currentUser}`);
    
    mongoose.model('Bambi').findOne({ username: data.username })
      .then(bambi => {
        if (!bambi) {
          socket.emit('bambi:heart:error', 'Bambi not found');
          return;
        }
        
        // Initialize hearts array if it doesn't exist
        if (!bambi.hearts) bambi.hearts = [];
        
        // Check if user already hearted
        const alreadyHearted = bambi.hearts.includes(currentUser);
        
        if (alreadyHearted) {
          // Remove heart
          bambi.hearts = bambi.hearts.filter(user => user !== currentUser);
          logger.info(`Heart removed from ${data.username} by ${currentUser}`);
        } else {
          // Add heart
          bambi.hearts.push(currentUser);
          logger.info(`Heart added to ${data.username} by ${currentUser}`);
        }
        
        return bambi.save();
      })
      .then(bambi => {
        if (bambi) {
          socket.emit('bambi:heart:success', { 
            hearted: bambi.hearts.includes(currentUser),
            count: bambi.hearts.length
          });
          
          // Notify bambi owner if they're online
          io.to(`user:${data.username}`).emit('bambi:hearted', { 
            from: currentUser,
            count: bambi.hearts.length
          });
        }
      })
      .catch(error => {
        logger.error(`Error processing heart: ${error.message}`);
        socket.emit('bambi:heart:error', 'Error processing heart request');
      });
  } catch (error) {
    logger.error('Error handling bambi heart:', error);
    socket.emit('bambi:heart:error', 'Server error processing heart');
  }
}

export { socketStore, activeWorkers };