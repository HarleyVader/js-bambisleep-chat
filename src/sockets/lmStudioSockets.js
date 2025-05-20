import Logger from '../utils/logger.js';
import messageQueue from '../utils/messageQueue.js';

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

  // Handle system-settings event from bambi-sessions.js
  socket.on('system-settings', (settings) => {
    if (!settings) return;

    // Forward trigger details to LMStudio worker
    if (settings.triggerDetails) {
      lmstudio.postMessage({
        type: "triggers",
        triggers: {
          triggerNames: settings.activeTriggers.join(','),
          triggerDetails: settings.triggerDetails
        },
        socketId: socket.id
      });
    }

    // Forward collar settings if enabled
    if (settings.collarSettings?.enabled && settings.collarSettings.text) {
      lmstudio.postMessage({
        type: 'collar',
        data: settings.collarSettings.text,
        socketId: socket.id
      });
    }

    // Persist to active session if exists
    if (socket.activeSessionId) {
      persistSessionSettings(socket.activeSessionId, settings);
    }
  });

  // Handle conversation-start event
  socket.on('conversation-start', () => {
    // Tell client to send system settings
    socket.emit('request-system-settings');
    logger.info('Requested system settings for new conversation');
  });

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
      logger.info(msg.data);
    } else if (msg.type === 'response') {
      // Simple string conversion for consistency
      const responseData = typeof msg.data === 'object' ? JSON.stringify(msg.data) : msg.data;
      
      // Find the target socket
      const targetSocket = io.sockets.sockets.get(msg.socketId);
      
      if (targetSocket && targetSocket.connected) {
        // Send as simple string to avoid parsing issues
        targetSocket.emit("response", responseData);
        logger.debug(`Sent response to ${msg.socketId}`);
      } else {
        logger.info(`Socket ${msg.socketId} disconnected, can't send response`);
      }
      
      // Also emit as chat message if needed
      if (msg.meta?.emitAsChat) {
        const chatMessage = {
          username: 'BambiAI',
          data: responseData,
          timestamp: new Date().toISOString()
        };
        
        if (targetSocket && targetSocket.connected) {
          targetSocket.emit("chat message", chatMessage);
        }
      }
    } else if (msg.type === 'xp:update') {
      if (msg.socketId && msg.username) {
        io.to(msg.socketId).emit("xp:update", {
          username: msg.username,
          xp: msg.data.xp,
          level: msg.data.level,
          xpEarned: msg.data.xpEarned
        });
      }
    } else if (msg.type === 'collar') {
      if (msg.socketId && msg.data) {
        io.to(msg.socketId).emit("collar", msg.data);
      }
    } else if (msg.type === 'detected-triggers') {
      if (msg.socketId && msg.triggers) {
        io.to(msg.socketId).emit("detected-triggers", { 
          triggers: msg.triggers
        });
      }
    }
  } catch (error) {
    logger.error('Error in worker message handler:', error);
    
    if (msg.socketId) {
      io.to(msg.socketId).emit("error", "An error occurred while processing your message");
    }
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
    const filteredMessage = typeof message === 'object' ? 
                           filterContent(message.data) : 
                           filterContent(message);

    // Session ID if available
    const sessionId = socket.activeSessionId || 
                      (typeof message === 'object' ? message.sessionId : null);

    // Send to LMStudio worker
    lmstudio.postMessage({
      type: "message",
      data: filteredMessage,
      socketId: socket.id,
      username: username,
      sessionId: sessionId,
      timestamp: new Date().toISOString()
    });

    logger.lmstudioMessage(username, socket.id, lmstudio.threadId || 'unknown');
  } catch (error) {
    logger.error('Error in message handler:', error);
    socket.emit('error', { message: 'Failed to process your message' });
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
    // Ensure consistent format before sending to worker
    let formattedTriggers = triggers;

    // Normalize the format if needed
    if (typeof triggers === 'string') {
      formattedTriggers = { triggerNames: triggers };
    } else if (Array.isArray(triggers)) {
      formattedTriggers = { triggerNames: triggers.join(',') };
    }

    lmstudio.postMessage({ type: "triggers", triggers: formattedTriggers });
    logger.info('Triggers updated for LMStudio worker');
  } catch (error) {
    logger.error('Error in triggers handler:', error);
  }
}

/**
 * Handle collar command for LMStudio processing
 */
function handleCollarForLMStudio(socket, lmstudio, collarData, filterContent) {
  try {
    // Filter collar content
    const filteredCollar = filterContent(collarData.data);

    // Extract uppercase words as potential triggers
    const triggerRegex = /\b([A-Z][A-Z\s&]+)\b/g;
    const potentialTriggers = filteredCollar.match(triggerRegex) || [];

    // Simple trigger handling - no need for complex validation
    if (potentialTriggers.length > 0) {
      // Send trigger update to worker
      lmstudio.postMessage({
        type: "triggers",
        triggers: potentialTriggers.join(',')
      });

      logger.info(`Collar triggers: ${potentialTriggers.join(', ')}`);
    }

    // Send to LMStudio worker for processing
    lmstudio.postMessage({
      type: 'collar',
      data: filteredCollar,
      socketId: socket.id
    });

    logger.info(`Collar: ${filteredCollar?.substring(0, 50)}...`);
  } catch (error) {
    logger.error('Collar handler error:', error);
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

/**
 * Persist session settings to the database
 * 
 * @param {string} sessionId - Active session ID
 * @param {Object} settings - System settings to persist
 */
function persistSessionSettings(sessionId, settings) {
  try {
    mongoose.model('SessionHistory').findByIdAndUpdate(
      sessionId,
      {
        $set: {
          'metadata.lastActivity': new Date(),
          'metadata.triggers': settings.activeTriggers || [],
          'metadata.collarActive': settings.collarSettings?.enabled || false,
          'metadata.collarText': settings.collarSettings?.text || '',
          'metadata.spiralSettings': settings.spiralSettings || {}
        }
      },
      { new: false },
      function(err) {
        if (err) logger.error(`Error persisting session settings: ${err.message}`);
      }
    );
  } catch (error) {
    logger.error(`Error updating session settings: ${error.message}`);
  }
}

export { setupLMStudioSockets };