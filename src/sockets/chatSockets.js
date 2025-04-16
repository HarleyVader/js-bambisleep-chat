import ChatMessage from '../models/ChatMessage.js';
import Logger from '../utils/logger.js';
import { withDbConnection } from '../config/db.js';
import Profile from '../models/Profile.js';  // Import the Profile model directly

const logger = new Logger('ChatSockets');

// XP settings
const XP_REWARDS = {
  CHAT_MESSAGE: 2,
  TRIGGER_USED: 3,
  COLLAR_USED: 15
};

// XP requirements for each level
const XP_REQUIREMENTS = [100, 250, 450, 700, 1200];

// Track which sockets have already had chat handlers attached
const registeredSockets = new Set();

// Update to accept a socket directly rather than setting up its own connection handler
export default function setupChatSockets(socket, io, socketStore, filteredWords = []) {
  // Prevent duplicate handlers by checking if this socket already has handlers
  if (registeredSockets.has(socket.id)) {
    logger.info(`Chat socket handlers already set up for socket ${socket.id}, skipping`);
    return;
  }
  
  // Mark this socket as having handlers registered
  registeredSockets.add(socket.id);
  
  // Add detailed logging to track when this is called
  logger.info(`Setting up chat socket handlers for socket ${socket.id} (registered: ${registeredSockets.has(socket.id)})`);
  
  // Clean up on disconnect
  socket.on('disconnect', () => {
    registeredSockets.delete(socket.id);
  });
  
  // Set up the handlers
  setupSocketHandlers(socket, io, socketStore, filteredWords);
}

function setupSocketHandlers(socket, io, socketStore, filteredWords = []) {
  // Verify socket is connected
  if (!socket.connected) {
    logger.warning(`Attempting to set up handlers for disconnected socket: ${socket.id}`);
  }
  
  // Handle chat messages for this specific socket
  socket.on('chat message', async (msg) => {
    try {
      // Validate message format
      if (!msg || !msg.data || typeof msg.data !== 'string') {
        logger.warning('Invalid message format received:', msg);
        return;
      }

      // Log more details
      logger.info(`Processing chat message: ${JSON.stringify(msg)}`);
      
      // Ensure username is set
      const username = msg.username || 'anonBambi';
      
      // Create and save the message
      await ChatMessage.saveMessage({
        username: username,
        data: msg.data,
        timestamp: new Date()
      });
      logger.info(`Chat message from ${username}: ${msg.data}`);
      
      // Broadcast the message to all clients
      io.emit('chat message', {
        username: username,
        data: msg.data,
        timestamp: new Date()
      });
      
      // Award XP for sending a chat message if user is not anonymous
      if (username && username !== 'anonBambi') {
        const xpResult = await awardXP(username, XP_REWARDS.CHAT_MESSAGE);
        if (xpResult && xpResult.leveledUp) {
          socket.emit('level-up', {
            level: xpResult.level
          });
        }
      }
      
    } catch (error) {
      logger.error(`Error handling chat message: ${error.message}`, error.stack);
    }
  });
  
  // Handle XP awards
  socket.on('award-xp', async (data) => {
    try {
      if (!data.username || !data.amount) return;
      
      const xpResult = await awardXP(data.username, data.amount);
      if (xpResult && xpResult.leveledUp) {
        socket.emit('level-up', {
          level: xpResult.level
        });
      }
    } catch (error) {
      logger.error(`Error awarding XP: ${error.message}`);
    }
  });
  
  // Handle profile update requests
  socket.on('request-profile-update', async (data) => {
    try {
      if (!data.username) return;
      
      const profile = await Profile.findOne({ username: data.username });
      
      if (!profile) {
        logger.warning(`Profile not found for update: ${data.username}`);
        return;
      }
      
      socket.emit('profile-update', {
        level: profile.level,
        xp: profile.xp,
        systemControls: profile.systemControls
      });
    } catch (error) {
      logger.error(`Error fetching profile update: ${error.message}`);
    }
  });
}

/**
 * Award XP to a user and handle level up logic
 * @param {string} username - The username of the profile to award XP to
 * @param {number} amount - The amount of XP to award
 */
async function awardXP(username, amount) {
  if (!username || username === 'anonymous' || username === 'anonBambi') {
    return null;
  }
  
  try {
    return await withDbConnection(async () => {
      // Use the imported Profile model directly
      const profile = await Profile.findOne({ username });
      
      if (!profile) {
        logger.warning(`Attempted to award XP to non-existent profile: ${username}`);
        return null;
      }
      
      // Calculate current level
      const currentLevel = profile.level || 1;
      
      // Add XP
      profile.xp = (profile.xp || 0) + amount;
      
      // Calculate new level based on XP thresholds
      // Simple formula: level = 1 + floor(xp / 100)
      const newLevel = 1 + Math.floor(profile.xp / 100);
      
      // Check if user has leveled up
      if (newLevel > currentLevel) {
        profile.level = newLevel;
        logger.info(`User ${username} leveled up to ${newLevel}!`);
      }
      
      // Save profile changes
      await profile.save();
      
      return {
        xp: profile.xp,
        level: profile.level,
        leveledUp: newLevel > currentLevel
      };
    });
  } catch (error) {
    logger.error(`Error in awardXP: ${error.message}`);
    return null;
  }
}