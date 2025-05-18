import Logger from '../utils/logger.js';
import { getSessionHistoryModel } from '../models/SessionHistory.js';
import { getProfile, updateProfile } from '../models/Profile.js';

const logger = new Logger('SessionSockets');

// Track which sockets have already had session handlers attached
const registeredSockets = new Set();

export default function setupSessionSockets(socket, io, socketStore) {
  // Prevent duplicate handlers by checking if this socket already has handlers
  if (registeredSockets.has(socket.id)) {
    logger.info(`Session socket handlers already set up for socket ${socket.id}, skipping`);
    return;
  }
  
  // Mark this socket as having handlers registered
  registeredSockets.add(socket.id);
  
  // Add detailed logging
  logger.info(`Setting up session socket handlers for socket ${socket.id}`);
  
  // Clean up on disconnect
  socket.on('disconnect', () => {
    registeredSockets.delete(socket.id);
  });
  
  // Set up the handlers
  setupSocketHandlers(socket, io, socketStore);
}

function setupSocketHandlers(socket, io, socketStore) {
  // Handle saving a session
  socket.on('save-session', async (data, callback) => {
    try {
      const username = socket.handshake.headers.cookie?.match(/bambiname=([^;]+)/)?.[1];
      
      if (!username || username === 'anonBambi') {
        return callback({
          success: false,
          message: 'Authentication required'
        });
      }
      
      const decodedUsername = decodeURIComponent(username);
      const SessionHistory = getSessionHistoryModel();
      
      // Validate data
      if (!data || !data.messages || !Array.isArray(data.messages)) {
        return callback({
          success: false,
          message: 'Invalid session data'
        });
      }
      
      let session;
      
      if (data.id) {
        // Try to update existing session
        session = await SessionHistory.findById(data.id);
        
        // Verify ownership
        if (!session || session.username !== decodedUsername) {
          return callback({
            success: false,
            message: 'Session not found or access denied'
          });
        }
        
        // Update session data
        session.title = data.title || session.title;
        session.messages = data.messages;
        session.metadata.lastActivity = new Date();
        session.metadata.triggers = data.triggers || [];
        
        await session.save();
        
        logger.info(`Updated session ${session._id} for user ${decodedUsername}`);
      } else {
        // Create new session
        session = new SessionHistory({
          username: decodedUsername,
          socketId: socket.id,
          title: data.title || 'Untitled Session',
          messages: data.messages,
          metadata: {
            createdAt: new Date(),
            lastActivity: new Date(),
            triggers: data.triggers || [],
            collarActive: false,
            lastActiveIP: socket.handshake.address
          }
        });
        
        await session.save();
        
        logger.info(`Created new session ${session._id} for user ${decodedUsername}`);
      }
      
      // Update profile with active triggers if specified
      if (data.triggers && Array.isArray(data.triggers)) {
        try {
          const profile = await getProfile(decodedUsername);
          
          if (profile) {
            // Create systemControls object if it doesn't exist
            if (!profile.systemControls) {
              profile.systemControls = {};
            }
            
            // Update active triggers
            profile.systemControls.activeTriggers = data.triggers;
            await profile.save();
            
            logger.info(`Updated active triggers for user ${decodedUsername}`);
          }
        } catch (error) {
          logger.error(`Error updating profile triggers: ${error.message}`);
        }
      }
      
      // Send success response
      callback({
        success: true,
        sessionId: session._id.toString(),
        message: 'Session saved successfully'
      });
      
    } catch (error) {
      logger.error(`Error saving session: ${error.message}`);
      callback({
        success: false,
        message: 'Error saving session'
      });
    }
  });
  
  // Handle updating active triggers
  socket.on('update-active-triggers', async (data) => {
    try {
      const { username, triggers } = data;
      
      if (!username || !triggers || !Array.isArray(triggers)) {
        return;
      }
      
      // Update profile with new triggers
      try {
        const profile = await getProfile(username);
        
        if (profile) {
          // Create systemControls object if it doesn't exist
          if (!profile.systemControls) {
            profile.systemControls = {};
          }
          
          // Update active triggers
          profile.systemControls.activeTriggers = triggers;
          await profile.save();
          
          // Broadcast profile update to this user's other connections
          socket.emit('profile-update', {
            level: profile.level,
            xp: profile.xp,
            systemControls: profile.systemControls
          });
          
          logger.info(`Updated active triggers for user ${username}`);
        }
      } catch (error) {
        logger.error(`Error updating profile triggers: ${error.message}`);
      }
    } catch (error) {
      logger.error(`Error handling trigger update: ${error.message}`);
    }
  });
  
  // Handle trigger used - award XP
  socket.on('trigger-used', async (data) => {
    try {
      const { username, trigger } = data;
      
      if (!username || !trigger) {
        return;
      }
      
      // Award XP for using a trigger (use existing awardXP function)
      socket.emit('award-xp', {
        username,
        amount: 3, // XP_REWARDS.TRIGGER_USED from chatSockets.js
        source: 'trigger'
      });
      
      logger.info(`Trigger used by ${username}: ${trigger}`);
    } catch (error) {
      logger.error(`Error handling trigger used: ${error.message}`);
    }
  });
  
  // Join a session room - for future collaborative features
  socket.on('join-session', async (sessionId) => {
    try {
      if (!sessionId) return;
      
      // Leave any existing session rooms
      Object.keys(socket.rooms).forEach(room => {
        if (room !== socket.id && room.startsWith('session-')) {
          socket.leave(room);
        }
      });
      
      // Join the new session room
      socket.join(`session-${sessionId}`);
      logger.info(`Socket ${socket.id} joined session room: session-${sessionId}`);
    } catch (error) {
      logger.error(`Error joining session room: ${error.message}`);
    }
  });
}
