import Logger from '../utils/logger.js';

const logger = new Logger('LMStudioSockets');

/**
 * Set up socket handlers for LMStudio-related events
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {Worker} lmstudio - LMStudio worker thread
 * @param {Function} filterContent - Function to filter content
 */
export default function setupLMStudioSockets(socket, io, lmstudio, filterContent) {
  // Get username from socket or cookie for logging purposes
  let socketUsername;
  try {
    socketUsername = decodeURIComponent(socket.handshake.headers.cookie
                    ?.split(';')
                    .find(c => c.trim().startsWith('bambiname='))
                    ?.split('=')[1] || 'anonBambi');
  } catch (error) {
    socketUsername = 'anonBambi';
    logger.warning('Could not extract username from socket:', error.message);
  }
  
  // Make username available to socket instance
  socket.bambiUsername = socketUsername;
  
  // Set up message handler for worker responses
  lmstudio.on("message", (msg) => handleWorkerMessage(socket, io, msg));
  
  // Set up worker error handling
  lmstudio.on('error', (err) => {
    logger.error('Worker error:', err);
  });
  
  lmstudio.on('info', (info) => {
    logger.info('Worker info:', info);
  });
  
  // Handle user messages
  socket.on("message", (message) => handleUserMessage(socket, lmstudio, message, filterContent));
  
  // Handle trigger updates
  socket.on("triggers", (triggers) => handleTriggerUpdate(lmstudio, triggers));
  
  // Handle collar interactions for LMStudio processing
  socket.on('collar', (collarData) => handleCollarForLMStudio(socket, lmstudio, collarData, filterContent));
  
  // Handle session history loading
  socket.on('load-history', (data) => {
    if (!data.messages || !data.messages.length) return;
    
    logger.info(`Loading ${data.messages.length} historical messages for socket ${socket.id}`);
    
    // Send message history to worker for context
    lmstudio.postMessage({
      type: "load-history",
      messages: data.messages,
      socketId: socket.id,
      username: socketUsername
    });
  });
  
  // Add session sync handlers
  setupSessionSyncHandlers(socket, lmstudio);
}

/**
 * Handle messages from the LMStudio worker
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {Object} msg - Message from worker
 */
function handleWorkerMessage(socket, io, msg) {
  try {
    if (msg.type === "log") {
      logger.info(msg.data, msg.socketId);
    } else if (msg.type === 'response') {
      const responseData = typeof msg.data === 'object' ? JSON.stringify(msg.data) : msg.data;
      io.to(msg.socketId).emit("response", responseData);
    } else if (msg.type === 'xp:update') {
      // Forward XP updates to the specific socket that triggered the action
      if (msg.socketId && msg.username) { // Add check for username
        io.to(msg.socketId).emit("xp:update", {
          username: msg.username,
          xp: msg.data.xp,
          level: msg.data.level,
          generatedWords: msg.data.generatedWords,
          xpEarned: msg.data.xpEarned
        });
        
        logger.info(`XP update for ${msg.username || 'unknown user'}: +${msg.data.xpEarned} XP`);
      }
    }
  } catch (error) {
    logger.error('Error in worker message handler:', error);
  }
}

/**
 * Handle user message to LMStudio
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {Worker} lmstudio - LMStudio worker thread
 * @param {string} message - User message
 * @param {Function} filterContent - Content filter function
 */
function handleUserMessage(socket, lmstudio, message, filterContent) {
  try {
    // Try to get username from the socket first if we already extracted it
    let username = socket.bambiUsername;
    
    // If not available, try to extract from cookie again
    if (!username) {
      try {
        username = decodeURIComponent(socket.handshake.headers.cookie
                    ?.split(';')
                    .find(c => c.trim().startsWith('bambiname='))
                    ?.split('=')[1] || 'anonBambi');
      } catch (error) {
        username = 'anonBambi';
        logger.warning('Could not extract username from cookie:', error.message);
      }
    }
    
    // Filter message content
    const filteredMessage = filterContent(message);
    
    // Send to LMStudio worker
    lmstudio.postMessage({
      type: "message",
      data: filteredMessage,
      socketId: socket.id,
      username: username
    });
    
    logger.info(`Message from ${username} sent to LMStudio worker`);
  } catch (error) {
    logger.error('Error in message handler:', error);
  }
}

/**
 * Handle trigger updates
 * 
 * @param {Worker} lmstudio - LMStudio worker thread
 * @param {Array} triggers - Array of trigger data
 */
function handleTriggerUpdate(lmstudio, triggers) {
  try {
    lmstudio.postMessage({ type: "triggers", triggers });
    logger.info('Triggers updated for LMStudio worker');
  } catch (error) {
    logger.error('Error in triggers handler:', error);
  }
}

/**
 * Handle collar command for LMStudio processing
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {Worker} lmstudio - LMStudio worker thread
 * @param {Object} collarData - Collar command data
 * @param {Function} filterContent - Content filter function
 */
function handleCollarForLMStudio(socket, lmstudio, collarData, filterContent) {
  try {
    // Filter collar content
    const filteredCollar = filterContent(collarData.data);
    
    // Send to LMStudio worker for processing
    lmstudio.postMessage({
      type: 'collar',
      data: filteredCollar,
      socketId: socket.id
    });
    
    logger.info(`Collar command processed by LMStudio: ${filteredCollar?.substring(0, 50)}`);
  } catch (error) {
    logger.error('Error in collar handler for LMStudio:', error);
  }
}

/**
 * Handle session sync events
 * Ensure session data is properly saved even when connections are lost
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {Worker} lmstudio - LMStudio worker thread
 */
function setupSessionSyncHandlers(socket, lmstudio) {
  // Sync session on disconnection or page unload
  socket.on('disconnect', () => {
    try {
      // Tell the worker to sync this session with the database
      lmstudio.postMessage({
        type: "syncSession",
        socketId: socket.id,
        username: socket.bambiUsername || 'anonBambi',
        reason: "socketDisconnect"
      });
      
      logger.info(`Requested session sync on disconnect for ${socket.bambiUsername || 'anonBambi'}`);
    } catch (error) {
      logger.error(`Error syncing session on disconnect: ${error.message}`);
    }
  });
  
  // Explicit session sync when user navigates away
  socket.on('beforeunload', () => {
    try {
      lmstudio.postMessage({
        type: "syncSession",
        socketId: socket.id,
        username: socket.bambiUsername || 'anonBambi',
        reason: "pageUnload"
      });
      
      logger.info(`Requested session sync on page unload for ${socket.bambiUsername || 'anonBambi'}`);
    } catch (error) {
      logger.error(`Error syncing session on page unload: ${error.message}`);
    }
  });
}

export { setupLMStudioSockets };