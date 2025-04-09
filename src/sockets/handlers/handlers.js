import { Worker } from 'worker_threads';
import path from 'path';
import mongoose from 'mongoose';
import Logger from '../../utils/logger.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = new Logger('SocketHandlers');

// Socket connection store
const socketStore = new Map();

export function setupSocketHandlers(io) {
  // Main socket namespace
  const mainIo = io.of('/');
  setupMainHandlers(mainIo);
  
  // bambis namespace
  const bambiIo = io.of('/bambis');
  setupBambiHandlers(bambiIo);
  
  return io;
}

function setupMainHandlers(io) {
  io.on('connection', (socket) => {
    logger.success(`Client connected: ${socket.id}`);
    
    // Get username from cookie
    const username = getUsernameFromCookie(socket);
    
    // Load user bambi
    loadUserBambi(socket, username);
    
    // Initialize LLM worker
    const lmstudio = initializeWorker(socket);
    socketStore.set(socket.id, { socket, worker: lmstudio, files: [] });
    
    // Chat message handling
    socket.on('chat message', (msg) => handleChatMessage(socket, io, username, msg));
    
    // LLM message handling
    socket.on('message', (msg) => handleLLMMessage(socket, lmstudio, username, msg));
    
    // Username handling
    socket.on('set username', (newUsername) => handleSetUsername(socket, newUsername));
    
    // Triggers handling
    socket.on('triggers', (data) => handleTriggers(lmstudio, data));
    
    // Collar handling
    socket.on('collar', (data) => handleCollar(socket, io, lmstudio, data));
    
    // Worker message handling
    lmstudio.on('message', (data) => handleWorkerMessage(socket, io, data));
    
    // Disconnect handling
    socket.on('disconnect', () => handleDisconnect(socket, socketStore));
  });
}

function initializeWorker(socket) {
  try {
    const worker = new Worker(path.join(__dirname, '../../workers/lmstudio.js'));
    
    worker.on('error', (err) => {
      logger.error(`Worker error for socket ${socket.id}:`, err);
      socket.emit('system', { type: 'error', message: 'AI service error. Please try again later.' });
    });
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        logger.warning(`Worker exited with code ${code} for socket ${socket.id}`);
        socket.emit('system', { type: 'warning', message: 'AI service restarting...' });
        
        // Attempt to restart the worker if it crashes
        const socketData = socketStore.get(socket.id);
        if (socketData) {
          socketData.worker = initializeWorker(socket);
          socketStore.set(socket.id, socketData);
        }
      }
    });
    
    worker.on('online', () => {
      logger.success(`Worker started for socket ${socket.id}`);
    });
    
    return worker;
  } catch (error) {
    logger.error(`Failed to initialize worker for socket ${socket.id}:`, error);
    socket.emit('system', { type: 'error', message: 'Failed to initialize AI service' });
    return null;
  }
}

function setupBambiHandlers(bambiIo) {
  bambiIo.on('connection', (socket) => {
    logger.success(`bambi client connected: ${socket.id}`);
    
    // Handle bambi view
    socket.on('bambi:view', (username) => handleBambiView(socket, bambiIo, username));
    
    // Handle bambi update
    socket.on('bambi:save', (data) => handleBambiSave(socket, bambiIo, data));
    
    // Handle bambi heart/like
    socket.on('bambi:heart', (data) => handleBambiHeart(socket, bambiIo, data));
    
    // Disconnect handling
    socket.on('disconnect', () => {
      logger.info(`bambi client disconnected: ${socket.id}`);
    });
  });
}

// Helper function to get username from cookie
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

// Load user bambi from database
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

function handleChatMessage(socket, io, username, msg) {
  try {
    // Basic input validation
    if (!msg || typeof msg !== 'string' || msg.trim() === '') {
      return;
    }
    
    logger.info(`Chat message from ${username}: ${msg.substring(0, 50)}${msg.length > 50 ? '...' : ''}`);
    
    // Broadcast message to all clients
    io.emit('chat message', {
      username,
      message: msg,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error handling chat message:', error);
  }
}

function handleLLMMessage(socket, worker, username, msg) {
  try {
    // Basic input validation
    if (!msg || typeof msg !== 'string' || msg.trim() === '') {
      return;
    }
    
    if (!worker) {
      socket.emit('system', { type: 'error', message: 'AI service unavailable' });
      return;
    }
    
    logger.info(`LLM request from ${username}: ${msg.substring(0, 50)}${msg.length > 50 ? '...' : ''}`);
    
    // Send message to worker - Changed from 'query' to 'message' to match worker's expected type
    worker.postMessage({
      type: 'message',
      data: msg,
      socketId: socket.id,
      username: username
    });
    
    // Let user know request is processing
    socket.emit('llm:status', { status: 'processing' });
  } catch (error) {
    logger.error('Error handling LLM message:', error);
    socket.emit('system', { type: 'error', message: 'Failed to process your request' });
  }
}

function handleSetUsername(socket, newUsername) {
  try {
    // Validate username
    if (!newUsername || typeof newUsername !== 'string' || newUsername.trim() === '') {
      socket.emit('username:error', 'Invalid username');
      return;
    }
    
    const sanitizedUsername = newUsername.trim().substring(0, 30);
    logger.info(`Username set: ${sanitizedUsername} for socket ${socket.id}`);
    
    // Set username in cookie
    socket.emit('set:cookie', {
      name: 'bambiname',
      value: encodeURIComponent(sanitizedUsername),
      days: 30
    });
    
    socket.emit('username:set', sanitizedUsername);
  } catch (error) {
    logger.error('Error setting username:', error);
    socket.emit('username:error', 'Failed to set username');
  }
}

function handleTriggers(worker, data) {
  try {
    if (!worker) return;
    
    worker.postMessage({
      type: 'triggers',
      data: data
    });
  } catch (error) {
    logger.error('Error handling triggers:', error);
  }
}

function handleCollar(socket, io, worker, data) {
  try {
    if (!worker) return;
    
    logger.info(`Collar event: ${JSON.stringify(data)}`);
    
    worker.postMessage({
      type: 'collar',
      data: data
    });
    
    // Broadcast collar status to all clients
    io.emit('collar:update', data);
  } catch (error) {
    logger.error('Error handling collar event:', error);
  }
}

function handleWorkerMessage(socket, io, data) {
  try {
    if (!data) return;
    
    if (data.type === 'response') {
      // Send AI response to client - Use the correct data field and event name
      socket.emit('response', data.data);
      
      logger.success(`LLM response sent to ${socket.id}`);
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
    }
  } catch (error) {
    logger.error('Error handling worker message:', error);
  }
}

function handleBambiView(socket, io, username) {
  try {
    if (!username) {
      socket.emit('bambi:error', 'Invalid username provided');
      return;
    }
    
    logger.info(`bambi view request for ${username} from ${socket.id}`);
    
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
          socket.emit('bambi:error', 'bambi not found');
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

function handlebambiSave(socket, io, data) {
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
    
    logger.info(`bambi save request for ${username}`);
    
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
      logger.success(`bambi saved for ${username}`);
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
          socket.emit('bambi:heart:error', 'bambi not found');
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

function handleDisconnect(socket, socketStore) {
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
  } catch (error) {
    logger.error(`Error handling disconnect for ${socket.id}:`, error);
  }
}

export { socketStore };