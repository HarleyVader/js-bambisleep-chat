import mongoose from 'mongoose';
import Logger from '../utils/logger.js';
import { getProfile } from '../models/Profile.js';

const logger = new Logger('ProfileSockets');

/**
 * Set up socket handlers for profile-related events
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {SocketIO.Server} io - Socket.io server instance
 * @param {string} username - Current username
 */
export default function setupProfileSockets(socket, io, username) {
  // Handle username prompt if anonymous
  if (username === 'anonBambi') {
    socket.emit('prompt username');
  } else {
    loadUserProfile(socket, username);
  }

  // Connect to profile room for real-time updates
  socket.on('join-profile', (profileUsername) => {
    if (profileUsername) {
      socket.join(`profile-${profileUsername}`);
      logger.info(`Socket ${socket.id} joined profile room: ${profileUsername}`);
    }
  });

  // Handle username setting
  socket.on('set username', handleSetUsername(socket));
  
  // Handle profile viewing
  socket.on('profile:view', (profileUsername) => handleProfileView(socket, profileUsername));
  
  // Handle profile updates
  socket.on('update profile', (profileData) => handleProfileUpdate(socket, io, username, profileData));
  socket.on('profile:save', (profileData) => handleProfileSave(socket, io, username, profileData));
  socket.on('profile:update', (data) => handleProfileFieldUpdate(socket, username, data));
  
  // Handle profile interactions
  socket.on('toggle-trigger', (data) => handleTriggerToggle(socket, io, data));
  socket.on('profile:heart', (data) => handleProfileHeart(socket, io, data, username));
  socket.on('delete-profile', (data) => handleProfileDelete(socket, io, data));
}

/**
 * Load a user's profile
 * 
 * @param {Socket} socket - Socket.io socket instance
 * @param {string} username - Username to load profile for
 */
async function loadUserProfile(socket, username) {
  try {
    const Profile = getProfile();
    const profile = await Profile.findOne({ username });
    
    if (profile) {
      socket.bambiProfile = profile;
      socket.emit('profile loaded', {
        username: profile.username,
        displayName: profile.displayName,
        level: profile.level,
        triggers: profile.triggers
      });
      
      // Update lastActive timestamp
      profile.lastActive = Date.now();
      await profile.save();
    }
  } catch (err) {
    logger.error(`Error loading profile for ${username}:`, err);
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
    
    const profile = await mongoose.model('Bambi').findOne({ username: profileUsername });
    
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
        await profile.save();
        
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
        let profile = await ProfileModel.findOne({ username });
        
        if (profile) {
          // Maximum 10 triggers
          const triggers = profileData.triggers.slice(0, 10);
          profile.triggers = triggers;
          await profile.save();
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
    const profile = await mongoose.model('Bambi').findOneAndUpdate(
      { username: currentUsername },
      { 
        $set: {
          ...sanitizedData,
          lastActive: new Date()
        }
      },
      { new: true, upsert: true }
    );
    
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
    
    const profile = await mongoose.model('Bambi').findOne({ username });
    if (!profile) return;
    
    // Only allow updates to certain fields via socket
    if (data.field === 'favoriteSeasons' && Array.isArray(data.value)) {
      profile.favoriteSeasons = data.value.filter(season => 
        ['spring', 'summer', 'autumn', 'winter'].includes(season));
      await profile.save();
      
      socket.emit('profile:updated', {
        field: data.field,
        value: profile.favoriteSeasons
      });
    }
    
    // Update last active time
    profile.lastActive = Date.now();
    await profile.save();
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
    
    const profile = await mongoose.model('Bambi').findOne({ username });
    if (profile) {
      profile.toggleTrigger(triggerName, active);
      await profile.save();
      
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
    
    const targetProfile = await getProfile().findOne({ username: targetUsername });
    
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
    
    await targetProfile.save();
    
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
    const deletedProfile = await mongoose.model('Bambi').findOneAndDelete({ username });
    
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

export { setupProfileSockets };