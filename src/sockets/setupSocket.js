import Logger from '../utils/logger.js';
import { getSessionHistoryModel } from '../models/SessionHistory.js';

// Initialize logger
const logger = new Logger('SocketHandler');

// Setup socket connection and event handlers
function setupSocket(socket, io, socketStore) {
  const username = socket.request.session?.username || 
                  (socket.handshake.headers.cookie?.match(/bambiname=([^;]+)/)?.[1] 
                  ? decodeURIComponent(socket.handshake.headers.cookie.match(/bambiname=([^;]+)/)[1]) 
                  : 'anonBambi');
  
  // Store username on socket for easy access
  socket.bambiUsername = username;
  
  // Setup basic socket handlers
  setupChatHandlers(socket, username, io);
  setupSystemHandlers(socket, username);
  setupSessionHandlers(socket, io, socketStore);
  
  // Track connection for analytics
  trackConnection(socket, username);
  
  // Handle disconnection
  socket.on('disconnect', () => handleDisconnect(socket, username));
}

// Set up image generation handlers
function setupImageHandlers(socket, username) {
  socket.on('generate-image', data => {
    if (!data || !username) return;
    
    const { prompt, negativePrompt, width, height } = data;
    
    if (!prompt) {
      socket.emit('image-generation-error', { error: 'Prompt is required' });
      return;
    }
    
    // Image generation functionality has been removed
    logger.info(`Image generation request received but functionality has been removed - ${username}: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`);
    socket.emit('image-generation-error', { 
      error: 'Image generation functionality has been removed',
      message: 'This feature is no longer available'
    });
  });
  
  socket.on('check-job-status', data => {
    if (!data || !data.jobId || !username) return;
    
    const { jobId } = data;
    
    // Job status functionality has been removed
    logger.info(`Job status check request received but functionality has been removed - ${username}: ${jobId}`);
    socket.emit('job-status-error', { 
      error: 'Image job status functionality has been removed',
      message: 'This feature is no longer available'
    });
  });
}

// Set up chat message handlers
function setupChatHandlers(socket, username, io) {
  socket.on('chat message', msg => {
    try {
      // Validate message format
      if (!msg || !msg.data) {
        logger.warning(`Invalid message format received from ${username}`);
        return;
      }
      
      // Process the message
      const processedMsg = processMessage(msg);
      
      // Add timestamp if not present
      if (!processedMsg.timestamp) {
        processedMsg.timestamp = new Date();
      }
      
      // Add session ID if available
      if (socket.activeSessionId) {
        processedMsg.sessionId = socket.activeSessionId;
      }
      
      // Log the message
      logger.chatMessage(username, processedMsg.data, socket.id);
      
      // Save to database and broadcast
      saveAndBroadcast(socket, io, username, processedMsg);
    } catch (error) {
      logger.error(`Error handling chat message: ${error.message}`);
    }
  });
}

// Set up system control handlers
function setupSystemHandlers(socket, username) {
  socket.on('system-update', data => {
    if (!data || !username) return;
    
    // Save system settings to user profile
    saveToProfile(username, data);
    
    // Notify client of successful update
    socket.emit('system-update-success');
  });
  
  socket.on('system-settings', settings => {
    if (!settings) return;
    
    // Add socket ID and username to the settings
    const enrichedSettings = {
      ...settings,
      socketId: socket.id,
      username: username || 'anonBambi'
    };
    
    // Forward settings to appropriate worker
    sendToWorker('lmstudio', 'system-settings', enrichedSettings);
    
    logger.info(`System settings updated for ${username || 'anonBambi'}`);
  });
}

// Set up session handlers
function setupSessionHandlers(socket, io) {
  const username = socket.bambiUsername;
  
  // Load session
  socket.on('load-session', async (sessionId) => {
    try {
      const SessionHistory = await getSessionHistoryModel();
      const session = await SessionHistory.findById(sessionId);
      
      if (!session) return;
      
      // Store active session ID on socket
      socket.activeSessionId = sessionId;
      
      // Send to client
      socket.emit('session-loaded', {
        session,
        sessionId
      });
      
      // If this session has messages, tell worker to load them
      if (session.messages && session.messages.length > 0) {
        // Find worker for this socket
        const socketData = socketStore.get(socket.id);
        if (socketData && socketData.worker) {
          socketData.worker.postMessage({
            type: 'load-history',
            sessionId,
            messages: session.messages,
            socketId: socket.id,
            username
          });
        }
      }
    } catch (error) {
      logger.error('Error loading session:', error.message);
    }
  });
  
  // Save session
  socket.on('save-session', async (data) => {
    if (!data || !username || username === 'anonBambi') return;
    
    try {
      const SessionHistory = await getSessionHistoryModel();
      
      // Update existing or create new session
      if (data.sessionId) {
        await SessionHistory.findByIdAndUpdate(
          data.sessionId,
          {
            $set: {
              'metadata.lastActivity': new Date(),
              'metadata.triggers': data.settings?.activeTriggers || [],
              'metadata.collarActive': data.settings?.collarSettings?.enabled || false,
              'metadata.collarText': data.settings?.collarSettings?.text || '',
              'metadata.spiralSettings': data.settings?.spiralSettings || {}
            },
            $push: {
              messages: { 
                $each: data.messages || [] 
              }
            }
          }
        );
        
        socket.emit('session-saved', { sessionId: data.sessionId });
      } else {
        // Create new session
        const newSession = new SessionHistory({
          username: username,
          title: data.title || `Session ${new Date().toLocaleString()}`,
          messages: data.messages || [],
          metadata: {
            createdAt: new Date(),
            lastActivity: new Date(),
            triggers: data.settings?.activeTriggers || [],
            collarActive: data.settings?.collarSettings?.enabled || false,
            collarText: data.settings?.collarSettings?.text || '',
            spiralSettings: data.settings?.spiralSettings || {}
          }
        });
        
        await newSession.save();
        socket.activeSessionId = newSession._id;
        socket.emit('session-created', { sessionId: newSession._id });
      }
    } catch (error) {
      logger.error('Error saving session:', error.message);
    }
  });
}

// Track user connection
function trackConnection(socket, username) {
  if (!username) return;
  
  updateUserStatus(username, true);
  socket.broadcast.emit('user-connected', username);
}

// Handle user disconnection
function handleDisconnect(socket, username) {
  if (!username) return;
  
  updateUserStatus(username, false);
  socket.broadcast.emit('user-disconnected', username);
}

module.exports = setupSocket;