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
  
  // Profiles namespace
  const profileIo = io.of('/profiles');
  setupProfileHandlers(profileIo);
  
  return io;
}

function setupMainHandlers(io) {
  io.on('connection', (socket) => {
    logger.success(`Client connected: ${socket.id}`);
    
    // Get username from cookie
    const username = getUsernameFromCookie(socket);
    
    // Load user profile
    loadUserProfile(socket, username);
    
    // Initialize LLM worker
    const lmstudio = new Worker(path.join(__dirname, '../workers/lmstudio.js'));
    socketStore.set(socket.id, { socket, worker: lmstudio, files: [] });
    
    // Chat message handling
    socket.on('chat message', handleChatMessage(socket, io, username));
    
    // LLM message handling
    socket.on('message', handleLLMMessage(socket, lmstudio, username));
    
    // Username handling
    socket.on('set username', handleSetUsername(socket));
    
    // Triggers handling
    socket.on('triggers', handleTriggers(lmstudio));
    
    // Collar handling
    socket.on('collar', handleCollar(socket, io, lmstudio));
    
    // Worker message handling
    lmstudio.on('message', handleWorkerMessage(socket, io));
    
    // Disconnect handling
    socket.on('disconnect', handleDisconnect(socket, socketStore));
    
    // LLM error handling
    lmstudio.on('error', (err) => {
      logger.error('Worker error:', err);
    });
  });
}

function setupProfileHandlers(profileIo) {
  profileIo.on('connection', (socket) => {
    logger.success(`Profile client connected: ${socket.id}`);
    
    // Handle profile view
    socket.on('profile:view', handleProfileView(socket, profileIo));
    
    // Handle profile update
    socket.on('profile:save', handleProfileSave(socket, profileIo));
    
    // Handle profile heart/like
    socket.on('profile:heart', handleProfileHeart(socket, profileIo));
    
    // Disconnect handling
    socket.on('disconnect', () => {
      logger.info(`Profile client disconnected: ${socket.id}`);
    });
  });
}

// Helper functions for socket handlers would be defined here
// I've only included a few as examples

function handleProfileView(socket, io) {
  return async (username) => {
    try {
      if (!username) {
        socket.emit('profile:error', 'Invalid username provided');
        return;
      }
      
      const bambi = await mongoose.model('Bambi').findOne({ username });
      
      if (bambi) {
        // Get current user info
        const currentUser = getUsernameFromCookie(socket);
        
        // Record view if not owner
        if (currentUser && currentUser !== username) {
          bambi.lastViewed = new Date();
          await bambi.save();
        }
        
        socket.emit('profile:data', { bambi });
      } else {
        socket.emit('profile:error', 'Profile not found');
      }
    } catch (error) {
      logger.error(`Error fetching profile: ${error.message}`);
      socket.emit('profile:error', 'Error loading profile');
    }
  };
}

// Helper function to get username from cookie
function getUsernameFromCookie(socket) {
  try {
    return decodeURIComponent(
      socket.handshake.headers.cookie?.split(';')
        .find(c => c.trim().startsWith('bambiname='))
        ?.split('=')[1] || 'anonBambi'
    );
  } catch (error) {
    logger.error('Error extracting username from cookie:', error);
    return 'anonBambi';
  }
}

// Other handler functions would be defined here...