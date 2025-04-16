import mongoose from 'mongoose';
import Logger from '../utils/logger.js';
import { getProfile, updateProfile } from '../models/Profile.js';
import { getModel } from '../config/db.js'; // Import getModel from the correct location
import { withDbConnection } from '../utils/dbTransaction.js';

const logger = new Logger('ProfileSockets');

/**
 * Set up socket handlers for profile-related events
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {string} username - Current username
 */
export default function setupProfileSockets(socket, io, username) {
  // Join a room specific to this user's profile
  if (username && username !== 'anonBambi') {
    socket.join(`profile:${username}`);
    
    // Store the username in the socket for later use
    socket.bambiProfile = { username };
    
    // Handle profile update via socket
    socket.on('update-profile', async (data) => {
      try {
        // Check authentication via cookie
        if (data.username !== username) {
          socket.emit('error', { message: 'You can only update your own profile' });
          return;
        }
        
        const Profile = getModel('Profile');
        const profile = await withDbConnection(async () => {
          return await Profile.findOne({ username: data.username });
        });
        
        if (!profile) {
          socket.emit('error', { message: 'Profile not found' });
          return;
        }
        
        // Update allowed fields
        const allowedFields = [
          'displayName', 'avatar', 'headerImage', 'headerColor',
          'about', 'description', 'seasons'
        ];
        
        allowedFields.forEach(field => {
          if (data[field] !== undefined) {
            profile[field] = data[field];
          }
        });
        
        await withDbConnection(async () => {
          await profile.save();
        });
        
        // Emit success event
        socket.emit('profile-updated', {
          success: true,
          message: 'Profile updated successfully',
          data: profile
        });
        
        logger.info(`Profile updated for ${username}`);
      } catch (error) {
        logger.error('Error updating profile:', error);
        socket.emit('error', { message: 'Failed to update profile' });
      }
    });
    
    // Handle system controls update
    socket.on('update-system-controls', async (data) => {
      try {
        // Check authentication via cookie
        if (data.username !== username) {
          socket.emit('error', { message: 'You can only update your own system controls' });
          return;
        }
        
        const Profile = getModel('Profile');
        const profile = await withDbConnection(async () => {
          return await Profile.findOne({ username: data.username });
        });
        
        if (!profile) {
          socket.emit('error', { message: 'Profile not found' });
          return;
        }
        
        // Initialize systemControls if not exists
        if (!profile.systemControls) {
          profile.systemControls = {};
        }
        
        // Update system controls
        const controlFields = [
          'activeTriggers', 'collarEnabled', 'collarText', 
          'multiplierSettings', 'colorSettings'
        ];
        
        controlFields.forEach(field => {
          if (data[field] !== undefined) {
            profile.systemControls[field] = data[field];
          }
        });
        
        await withDbConnection(async () => {
          await profile.save();
        });
        
        // Emit success event
        socket.emit('system-controls-updated', {
          success: true,
          message: 'System controls updated successfully',
          data: profile.systemControls
        });
        
        // Also broadcast system controls update to LMStudio
        // This ensures real-time updates to the worker
        if (data.activeTriggers && data.triggerDescriptions) {
          const triggersWithDescriptions = data.activeTriggers.map(trigger => {
            const description = data.triggerDescriptions[trigger] || '';
            return { name: trigger, description };
          });
          
          io.to(socket.id).emit('triggers', {
            triggerNames: data.activeTriggers.join(' '),
            triggerDetails: triggersWithDescriptions
          });
        }
        
        if (data.collarText !== undefined) {
          io.to(socket.id).emit('collar', {
            data: data.collarText,
            enabled: data.collarEnabled || false,
            socketId: socket.id
          });
        }
        
        logger.info(`System controls updated for ${username}`);
      } catch (error) {
        logger.error('Error updating system controls:', error);
        socket.emit('error', { message: 'Failed to update system controls' });
      }
    });
  }
  
  // User joins a profile room (for profile updates in other tabs/windows)
  socket.on('join-profile', (profileUsername) => {
    if (profileUsername) {
      socket.join(`profile:${profileUsername}`);
      logger.info(`Socket ${socket.id} joined profile room for ${profileUsername}`);
    }
  });

  // Handle profile loading
  socket.on('profile:load', async () => {
    await loadUserProfile(socket, username);
  });
}

/**
 * Load a user's profile
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {string} username - Username to load profile for
 */
async function loadUserProfile(socket, username) {
  try {
    const profile = await withDbConnection(async () => {
      return await getProfile(username);
    });
    
    if (profile) {
      socket.emit('profile:loaded', profile);
    } else {
      socket.emit('profile:error', { message: 'Profile not found' });
    }
  } catch (error) {
    logger.error(`Error loading profile for ${username}:`, error);
    socket.emit('profile:error', { message: 'Error loading profile' });
  }
}

/**
 * Handle setting a username
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @returns {Function} - Event handler function
 */
function handleSetUsername(socket) {
  return (username) => {
    try {
      const encodedUsername = encodeURIComponent(username);
      socket.handshake.headers.cookie = `bambiname=${encodedUsername}; path=/`;
      socket.emit('username set', username);
      logger.info('Username set:', username);
    } catch (error) {
      logger.error('Error setting username:', error);
      socket.emit('error', { message: 'Failed to set username' });
    }
  };
}

/**
 * Handle profile view request
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {string} profileUsername - Username of profile to view
 */
async function handleProfileView(socket, profileUsername) {
  try {
    if (!profileUsername) {
      socket.emit('profile:error', 'Invalid username provided');
      return;
    }
    
    const profile = await withDbConnection(async () => {
      return await mongoose.model('Bambi').findOne({ username: profileUsername });
    });
    
    if (profile) {
      // Get current user for tracking who viewed this profile
      const currentUser = socket.bambiProfile?.username || 
                         decodeURIComponent(socket.handshake.headers.cookie
                           ?.split(';')
                           .find(c => c.trim().startsWith('bambiname='))
                           ?.split('=')[1] || '');
      
      // Record the view if this isn't the profile owner
      if (currentUser && currentUser !== profileUsername) {
        profile.lastViewed = new Date();
        await withDbConnection(async () => {
          await profile.save();
        });
        
        // Only add view activity if we have the addActivity method
        if (typeof profile.addActivity === 'function') {
          profile.addActivity('viewed', `Profile viewed by ${currentUser}`);
        }
      }
      
      socket.emit('profile:data', {
        profile: profile
      });
    } else {
      socket.emit('profile:error', 'Profile not found');
    }
  } catch (error) {
    logger.error(`Error fetching profile data: ${error.message}`);
    socket.emit('profile:error', 'Error loading profile');
  }
}

/**
 * Handle profile update request
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {string} username - Current username
 * @param {Object} profileData - Profile data to update
 */
async function handleProfileUpdate(socket, io, username, profileData) {
  try {
    if (username === 'anonBambi') {
      socket.emit('profile error', 'You need to set a username first');
      return;
    }

    // Redirect to profile editor for complex updates
    socket.emit('redirect to profile editor', {
      message: 'Please use the profile editor to update your profile',
      url: '/profile/edit'
    });
    
    // Still handle simple updates like triggers
    if (profileData.triggers && Array.isArray(profileData.triggers)) {
      try {
        const ProfileModel = mongoose.model('Bambi');
        let profile = await withDbConnection(async () => {
          return await ProfileModel.findOne({ username });
        });
        
        if (profile) {
          // Maximum 10 triggers
          const triggers = profileData.triggers.slice(0, 10);
          profile.triggers = triggers;
          await withDbConnection(async () => {
            await profile.save();
          });
          socket.emit('triggers updated', profile.triggers);
          
          // Notify other clients
          io.to(`profile-${username}`).emit('profile:updated', {
            field: 'triggers',
            value: profile.triggers
          });
        }
      } catch (error) {
        logger.error('Error updating triggers via socket:', error);
        socket.emit('profile error', 'Failed to update triggers');
      }
    }
  } catch (error) {
    logger.error('Error handling profile update via socket:', error);
    socket.emit('profile error', 'Server error occurred');
  }
}

/**
 * Handle saving profile data
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {string} username - Current username 
 * @param {Object} profileData - Profile data to save
 */
async function handleProfileSave(socket, io, username, profileData) {
  try {
    // Get username with better fallback logic
    const currentUsername = socket.bambiProfile?.username || 
                         decodeURIComponent(socket.handshake.headers.cookie?.split(';')
                           .find(c => c.trim().startsWith('bambiname='))
                           ?.split('=')[1] || '');
    
    if (!currentUsername || currentUsername === 'anonBambi') {
      socket.emit('profile:error', 'You must be logged in to update your profile');
      return;
    }
    
    logger.info(`Socket profile update for user: ${currentUsername}`);
    
    // Sanitize input data
    const sanitizedData = {
      about: (profileData.about || '').substring(0, 2000),
      description: (profileData.description || '').substring(0, 500),
      profilePictureUrl: profileData.profilePictureUrl,
      headerImageUrl: profileData.headerImageUrl
    };
    
    // Only update with valid URLs
    const urlPattern = /^(https?:\/\/|\/)[a-zA-Z0-9_\/.\-~:]+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i;
    if (sanitizedData.profilePictureUrl && !urlPattern.test(sanitizedData.profilePictureUrl)) {
      delete sanitizedData.profilePictureUrl;
    }
    if (sanitizedData.headerImageUrl && !urlPattern.test(sanitizedData.headerImageUrl)) {
      delete sanitizedData.headerImageUrl;
    }
    
    // Find and update the user's profile
    const profile = await withDbConnection(async () => {
      return await mongoose.model('Bambi').findOneAndUpdate(
        { username: currentUsername },
        { 
          $set: {
            ...sanitizedData,
            lastActive: new Date()
          }
        },
        { new: true, upsert: true }
      );
    });
    
    // Send success message back to the client that made the update
    socket.emit('profile:saved', {
      success: true,
      profile: profile,
      message: 'Profile updated successfully'
    });
    
    // Broadcast to all other clients viewing this profile
    io.to(`profile-${currentUsername}`).emit('profile:updated', {
      username: currentUsername,
      profile: profile
    });
    
    logger.success(`Profile updated for ${currentUsername} via socket`);
  } catch (error) {
    logger.error('Socket profile update error:', error);
    socket.emit('profile:error', 'Error updating profile');
  }
}

/**
 * Handle updating a single profile field
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {string} username - Current username
 * @param {Object} data - Update data with field and value
 */
async function handleProfileFieldUpdate(socket, username, data) {
  try {
    if (username === 'anonBambi') return;
    
    const profile = await withDbConnection(async () => {
      return await mongoose.model('Bambi').findOne({ username });
    });
    if (!profile) return;
    
    // Only allow updates to certain fields via socket
    if (data.field === 'favoriteSeasons' && Array.isArray(data.value)) {
      profile.favoriteSeasons = data.value.filter(season => 
        ['spring', 'summer', 'autumn', 'winter'].includes(season));
      await withDbConnection(async () => {
        await profile.save();
      });
      
      socket.emit('profile:updated', {
        field: data.field,
        value: profile.favoriteSeasons
      });
    }
    
    // Update last active time
    profile.lastActive = Date.now();
    await withDbConnection(async () => {
      await profile.save();
    });
  } catch (error) {
    logger.error('Error updating profile field:', error);
    socket.emit('profile:error', 'Failed to update profile field');
  }
}

/**
 * Handle trigger toggling
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {Object} data - Toggle data
 */
async function handleTriggerToggle(socket, io, { username, triggerName, active }) {
  try {
    if (!username) return;
    
    const profile = await withDbConnection(async () => {
      return await mongoose.model('Bambi').findOne({ username });
    });
    if (profile) {
      profile.toggleTrigger(triggerName, active);
      await withDbConnection(async () => {
        await profile.save();
      });
      
      // Broadcast to anyone viewing this profile
      io.to(`profile-${username}`).emit('trigger-toggled', {
        triggerName,
        active,
        activeTriggerSession: profile.activeTriggerSession
      });
      
      logger.info(`Trigger ${triggerName} ${active ? 'activated' : 'deactivated'} for ${username}`);
    }
  } catch (error) {
    logger.error(`Error toggling trigger: ${error.message}`);
    socket.emit('error', { message: 'Failed to toggle trigger' });
  }
}

/**
 * Handle profile heart interaction
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {Object} data - Heart data
 * @param {string} currentUsername - Current username
 */
async function handleProfileHeart(socket, io, data, currentUsername) {
  try {
    const targetUsername = data.username;
    const username = currentUsername;
    
    if (!username || username === 'anonBambi') {
      socket.emit('profile:error', 'You must be logged in to heart a profile');
      return;
    }
    
    const targetProfile = await withDbConnection(async () => {
      return await getProfile().findOne({ username: targetUsername });
    });
    
    if (!targetProfile) {
      socket.emit('profile:error', 'Profile not found');
      return;
    }
    
    // Check if user has already hearted this profile
    const heartIndex = targetProfile.hearts.users.indexOf(username);
    let hearted = false;
    
    if (heartIndex === -1 && data.action !== 'unheart') {
      // Add heart
      targetProfile.hearts.users.push(username);
      targetProfile.hearts.count += 1;
      hearted = true;
    } else if (heartIndex !== -1 && data.action !== 'heart') {
      // Remove heart
      targetProfile.hearts.users.splice(heartIndex, 1);
      targetProfile.hearts.count = Math.max(0, targetProfile.hearts.count - 1);
    }
    
    await withDbConnection(async () => {
      await targetProfile.save();
    });
    
    // Emit to all clients for real-time updates
    io.emit('profile:hearted', {
      username: targetUsername,
      count: targetProfile.hearts.count,
      hearted: hearted
    });
    
    logger.info(`User ${username} ${hearted ? 'hearted' : 'unhearted'} profile ${targetUsername}`);
  } catch (error) {
    logger.error(`Heart socket error: ${error.message}`);
    socket.emit('profile:error', 'Error processing heart action');
  }
}

/**
 * Handle profile deletion
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {Object} data - Delete data with username
 */
async function handleProfileDelete(socket, io, { username }) {
  try {
    // Find and delete the profile
    const deletedProfile = await withDbConnection(async () => {
      return await mongoose.model('Bambi').findOneAndDelete({ username });
    });
    
    if (deletedProfile) {
      // Emit to all clients viewing this profile
      io.to(`profile-${username}`).emit('profile-deleted', { username });
      
      // Emit to the user who deleted
      socket.emit('profile-delete-success', {
        success: true,
        message: 'Profile deleted successfully',
        redirectUrl: '/'
      });
      
      logger.success(`Profile deleted for ${username}`);
    } else {
      socket.emit('error', { message: 'Profile not found' });
    }
  } catch (err) {
    logger.error(`Error deleting profile: ${err.message}`);
    socket.emit('error', { message: 'Failed to delete profile' });
  }
}

/**
 * Handle XP updates
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {Object} data - XP update data
 * @param {string} username - Current username
 */
async function handleXPUpdate(socket, io, data, username) {
  try {
    const { wordCount, xpEarned } = data;
    
    if (username === 'anonBambi') {
      return;
    }
    
    const Profile = getProfile();
    const profile = await withDbConnection(async () => {
      return await Profile.findOne({ username });
    });
    
    if (profile) {
      // If xpEarned is provided, use it, otherwise calculate (1 XP per 5 words)
      const xp = xpEarned || Math.max(1, Math.floor(wordCount / 5));
      
      // Update tracked words
      profile.generatedWords = (profile.generatedWords || 0) + wordCount;
      
      // Calculate previous level for level-up detection
      const previousLevel = profile.level || 1;
      
      // Add XP
      profile.addXP(xp, 'message', `Generated ${wordCount} words`);
      
      await withDbConnection(async () => {
        await profile.save();
      });
      
      // Emit updated XP to the user
      socket.emit('xp:updated', {
        xp: profile.xp,
        level: profile.level,
        generatedWords: profile.generatedWords,
        xpEarned: xp,
        nextLevelXP: profile.getNextLevelXP()
      });
      
      // Check for level up
      if (profile.level > previousLevel) {
        socket.emit('level:up', {
          level: profile.level,
          xp: profile.xp
        });
      }
      
      logger.info(`User ${username} earned ${xp} XP for generating ${wordCount} words`);
    }
  } catch (error) {
    logger.error(`Error handling XP update: ${error.message}`);
  }
}

export { setupProfileSockets };