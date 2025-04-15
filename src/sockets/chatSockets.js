import ChatMessage from '../models/ChatMessage.js';
import { getProfile } from '../models/Profile.js';
import Logger from '../utils/logger.js';

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
  // Add detailed logging to track when this is called
  logger.info(`Setting up chat socket handlers for socket ${socket.id} (registered: ${registeredSockets.has(socket.id)})`);
  
  // Prevent duplicate handlers by checking if this socket already has handlers
  if (registeredSockets.has(socket.id)) {
    logger.info(`Chat socket handlers already set up for socket ${socket.id}, skipping`);
    return;
  }
  
  // Mark this socket as having handlers registered
  registeredSockets.add(socket.id);
  logger.info(`Registered socket ${socket.id} for chat handlers (total registered: ${registeredSockets.size})`);
  
  // Clean up on disconnect
  socket.on('disconnect', () => {
    registeredSockets.delete(socket.id);
  });
  
  // Set up the handlers
  setupSocketHandlers(socket, io, socketStore, filteredWords);
}

function setupSocketHandlers(socket, io, socketStore, filteredWords = []) {
  // Handle chat messages for this specific socket
  socket.on('chat message', async (msg) => {
    try {
      // Validate message format
      if (!msg || !msg.data || typeof msg.data !== 'string') {
        logger.warning('Invalid message format received');
        return;
      }

      // Ensure username is set
      const username = msg.username || 'anonBambi';
      
      // Create and save the message
      const chatMessage = new ChatMessage({
        username: username,
        data: msg.data,
        timestamp: new Date()
      });
      
      await chatMessage.save();
      logger.info(`Chat message from ${username}: ${msg.data}`);
      
      // Broadcast the message to all clients
      io.emit('chat message', {
        username: username,
        data: msg.data,
        timestamp: chatMessage.timestamp
      });
      
      // Award XP for sending a chat message if user is not anonymous
      if (username && username !== 'anonBambi') {
        await awardXP(username, XP_REWARDS.CHAT_MESSAGE, 'chat_message', socket);
      }
      
    } catch (error) {
      logger.error(`Error handling chat message: ${error.message}`);
    }
  });
  
  // Handle XP awards
  socket.on('award-xp', async (data) => {
    try {
      if (!data.username || !data.amount) return;
      
      await awardXP(data.username, data.amount, data.action, socket);
    } catch (error) {
      logger.error(`Error awarding XP: ${error.message}`);
    }
  });
  
  // Handle profile update requests
  socket.on('request-profile-update', async (data) => {
    try {
      if (!data.username) return;
      
      const Profile = getProfile();
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
 * @param {string} source - The source/reason for the XP award
 * @param {object} socket - The socket.io socket to emit updates to
 */
async function awardXP(username, amount, source, socket) {
  try {
    const Profile = getProfile();
    const profile = await Profile.findOne({ username });
    
    if (!profile) {
      logger.warning(`Profile not found for XP award: ${username}`);
      return;
    }
    
    // Store current level for comparison
    const currentLevel = profile.level;
    
    // Add XP to the profile
    profile.xp = (profile.xp || 0) + amount;
    
    // Check if user should level up
    while (profile.level < XP_REQUIREMENTS.length && 
           profile.xp >= XP_REQUIREMENTS[profile.level]) {
      // Remove XP needed for level up
      profile.xp -= XP_REQUIREMENTS[profile.level];
      // Increase level
      profile.level++;
    }
    
    // Add to XP history
    if (!profile.xpHistory) {
      profile.xpHistory = [];
    }
    
    profile.xpHistory.push({
      timestamp: new Date(),
      amount,
      source,
      description: `Awarded for ${source}`
    });
    
    // Keep history to last 100 entries
    if (profile.xpHistory.length > 100) {
      profile.xpHistory = profile.xpHistory.slice(-100);
    }
    
    await profile.save();
    logger.info(`XP updated for ${username}: +${amount} XP, Level: ${profile.level}`);
    
    // Emit profile update
    socket.emit('profile-update', {
      level: profile.level,
      xp: profile.xp,
      systemControls: profile.systemControls
    });
    
    // Notify about level up
    if (profile.level > currentLevel) {
      logger.info(`${username} leveled up to level ${profile.level}!`);
      socket.emit('level-up', {
        level: profile.level
      });
    }
  } catch (error) {
    logger.error(`Error in awardXP: ${error.message}`);
  }
}