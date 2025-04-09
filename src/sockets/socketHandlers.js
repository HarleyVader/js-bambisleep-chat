// Update your socket handlers to handle the new service worker approach

import { Logger } from '../utils/logger.js';
const logger = new Logger('SocketHandlers');

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    logger.success(`Client connected: ${socket.id}`);
    
    // Handle setting username
    socket.on('set username', (username) => {
      if (username && typeof username === 'string') {
        socket.bambiname = username;
        socket.join(`user:${username}`); // Join a room specific to this user
        logger.info(`Username set: ${username} for socket ${socket.id}`);
      }
    });
    
    // Handle chat messages
    socket.on('chat message', (msg) => {
      if (!msg.data || typeof msg.data !== 'string') {
        return;
      }
      
      const username = socket.bambiname || 'Anonymous';
      const timestamp = new Date().toISOString();
      
      io.emit('chat message', {
        data: msg.data,
        username: username,
        timestamp: timestamp
      });
      
      logger.info(`Chat message from ${username}: ${msg.data}`);
    });
    
    // Handle collar messages
    socket.on('collar', (msg) => {
      if (!msg.data || typeof msg.data !== 'string') {
        return;
      }
      
      const socketId = socket.id;
      const username = socket.bambiname || 'Anonymous';
      
      // Send the collar message back to the same client
      socket.emit('collar', msg.data);
      
      logger.info(`Collar message from ${username}: ${msg.data}`);
    });
    
    // Handle bambi actions (like delete)
    socket.on('bambi_action', (data) => {
      const username = socket.bambiname;
      
      if (!username) {
        socket.emit('error', { message: 'You must be authenticated' });
        return;
      }
      
      if (data.action === 'delete' && data.username === username) {
        // Handle bambi deletion
        logger.info(`Bambi deletion requested by ${username}`);
        // Your deletion code here...
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`Client disconnected: ${socket.id} - ${reason}`);
    });
  });
}