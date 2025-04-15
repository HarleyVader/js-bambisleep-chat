import Logger from '../utils/logger.js';

const logger = new Logger('ChatSockets');

/**
 * Set up socket handlers for chat-related events
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {Function} filterContent - Function to filter content
 */
export default function setupChatSockets(socket, io, filterContent) {
  // Handle chat messages
  socket.on('chat message', (msg) => handleChatMessage(socket, io, msg));
  
  // Handle collar commands
  socket.on('collar', (collarData) => handleCollarCommand(socket, io, collarData, filterContent));
}

/**
 * Handle chat message
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {Object} msg - Message data
 */
function handleChatMessage(socket, io, msg) {
  try {
    // Extract username from socket or cookie
    const username = socket.bambiProfile?.username || 
                    decodeURIComponent(socket.handshake.headers.cookie
                      ?.split(';')
                      .find(c => c.trim().startsWith('bambiname='))
                      ?.split('=')[1] || 'anonBambi');
    
    const timestamp = new Date().toISOString();
    
    // Broadcast chat message to all clients
    io.emit('chat message', {
      ...msg,
      timestamp: timestamp,
      username: username,
    });
    
    logger.info(`Chat message from ${username}: ${msg.text?.substring(0, 50)}${msg.text?.length > 50 ? '...' : ''}`);
  } catch (error) {
    logger.error('Error in chat message handler:', error);
  }
}

/**
 * Handle collar command
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {Object} collarData - Collar command data
 * @param {Function} filterContent - Content filter function
 */
function handleCollarCommand(socket, io, collarData, filterContent) {
  try {
    // Filter collar command content
    const filteredCollar = filterContent(collarData.data);
    
    // Forward to target socket
    io.to(collarData.socketId).emit('collar', filteredCollar);
    
    logger.info(`Collar command sent to ${collarData.socketId}`);
  } catch (error) {
    logger.error('Error in collar handler:', error);
  }
}

export { setupChatSockets };