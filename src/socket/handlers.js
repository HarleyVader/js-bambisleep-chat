import { getProfile } from '../models/Profile.js';
import Logger from '../utils/logger.js';
import { formatError } from '../utils/errorHandler.js';

// Helper function for validating image URLs
const isValidImageUrl = (url) => {
  const urlPattern = /^(https?:\/\/|\/)[a-zA-Z0-9_\/.\-~:]+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i;
  return urlPattern.test(url);
};

// Initialize logger
const logger = new Logger('SocketHandlers');

// Add helper function to get Profile model when needed
function getProfileModel() {
  return getProfile();
}

// Socket error handler helper function
function handleSocketError(socket, error, eventName = 'error') {
  logger.error(`Socket error (${eventName}):`, error.message);
  socket.emit(eventName, formatError(error, process.env.NODE_ENV !== 'production'));
}

export default function setupSocketHandlers(io) {
  return function(socket) {
    logger.info(`New client connected: ${socket.id}`);
    
    // Join profile room
    socket.on('join-profile', async (username) => {
      if (!username) return;
      
      socket.join(`profile-${username}`);
      logger.info(`Client joined room: profile-${username}`);
      
      try {
        // Get Profile model on demand
        const Profile = getProfileModel();
        
        // Fetch profile data and send it to the client
        const profile = await Profile.findOne({ username });
        if (profile) {
          socket.emit('profile-data', profile);
        } else {
          socket.emit('profile-not-found');
        }
      } catch (err) {
        handleSocketError(socket, err);
      }
    });

    // Create a new profile
    socket.on('create-profile', async (profileData) => {
      if (!profileData || !profileData.username) {
        return socket.emit('error', { message: 'Invalid profile data' });
      }
      
      try {
        const Profile = getProfileModel(); // Get model when needed
        
        // Check if profile already exists
        const existingProfile = await Profile.findOne({ username: profileData.username });
        if (existingProfile) {
          return socket.emit('error', { message: 'Profile already exists' });
        }
        
        const profile = new Profile(profileData);
        await profile.save();
        
        // Emit to everyone that a new profile was created
        io.emit('new-profile-created', {
          username: profile.username
        });
        
        // Emit to the creator
        socket.emit('profile-created', profile);
        logger.info(`Profile created for ${profile.username}`);
      } catch (err) {
        handleSocketError(socket, err);
      }
    });

    // Update profile - improved with better validation
    socket.on('update-profile', async (data, callback) => {
      if (!data || !data.username) {
        const errorResponse = { success: false, message: 'Invalid profile data' };
        if (typeof callback === 'function') callback(errorResponse);
        return socket.emit('error', errorResponse);
      }
      
      try {
        const Profile = getProfileModel(); // Get model when needed
        
        // Sanitize input data to prevent malicious inputs
        const sanitizedData = {
          ...data,
          about: data.about?.substring(0, 2000) || data.about,
          description: data.description?.substring(0, 500) || data.description
        };
        
        // Process the update
        const result = await Profile.findOneAndUpdate(
          { username: data.username },
          { $set: sanitizedData },
          { new: true }
        );
        
        if (!result) {
          const errorResponse = { success: false, message: 'Profile not found' };
          if (typeof callback === 'function') callback(errorResponse);
          return;
        }
        
        // Broadcast the update to all connected clients viewing this profile
        socket.to(`profile-${data.username}`).emit('profile-updated', result);
        
        // Send success response via callback if provided
        if (typeof callback === 'function') {
          callback({ 
            success: true, 
            message: 'Profile updated successfully',
            data: result
          });
        }
        
        logger.info(`Profile updated for ${data.username}`);
      } catch (error) {
        handleSocketError(socket, error);
        if (typeof callback === 'function') {
          callback({ 
            success: false, 
            message: error.message || 'Failed to update profile' 
          });
        }
      }
    });

    // This method replaces individual profile-save, profile-update methods from server.js
    socket.on('profile-save', async (profileData) => {
      try {
        const Profile = getProfileModel(); // Get model when needed
        
        const username = socket.bambiProfile?.username || 
                        decodeURIComponent(socket.handshake.headers.cookie?.split(';')
                          .find(c => c.trim().startsWith('bambiname='))
                          ?.split('=')[1] || '');
        
        if (!username || username === 'anonBambi') {
          socket.emit('profile-error', 'You must be logged in to update your profile');
          return;
        }
        
        logger.info(`Profile update for user: ${username}`);
        
        // Sanitize input data
        const sanitizedData = {
          about: (profileData.about || '').substring(0, 2000),
          description: (profileData.description || '').substring(0, 500),
        };
        
        // Process image URLs if they exist in the request
        if (profileData.profilePictureUrl || profileData.avatar) {
          const imageUrl = profileData.profilePictureUrl || profileData.avatar;
          
          if (isValidImageUrl(imageUrl)) {
            sanitizedData.avatar = imageUrl;
          }
        }
        
        if (profileData.headerImageUrl || profileData.headerImage) {
          const headerUrl = profileData.headerImageUrl || profileData.headerImage;
          
          if (isValidImageUrl(headerUrl)) {
            sanitizedData.headerImage = headerUrl;
          }
        }
        
        // Find and update the user's profile
        const profile = await Profile.findOneAndUpdate(
          { username },
          { 
            $set: {
              ...sanitizedData,
              lastActive: new Date()
            }
          },
          { new: true, upsert: true }
        );
        
        // Send success message back to the client that made the update
        socket.emit('profile-saved', {
          success: true,
          profile: profile,
          message: 'Profile updated successfully'
        });
        
        // Broadcast to all other clients viewing this profile
        socket.broadcast.to(`profile-${username}`).emit('profile-updated', {
          username,
          profile: profile
        });
        
        logger.info(`Profile updated for ${username}`);
      } catch (error) {
        handleSocketError(socket, error, 'profile-error');
      }
    });

    // Toggle trigger
    socket.on('toggle-trigger', async ({ username, triggerName, active }) => {
      if (!username || !triggerName) {
        return socket.emit('error', { message: 'Missing required data' });
      }
      
      try {
        const Profile = getProfileModel(); // Get model when needed
        
        const profile = await Profile.findOne({ username });
        if (!profile) {
          return socket.emit('error', { message: 'Profile not found' });
        }
        
        // Check if method exists (handle gracefully if it doesn't)
        let result = false;
        if (typeof profile.setTriggerActive === 'function') {
          result = profile.setTriggerActive(triggerName, active);
        } else {
          // Fallback implementation if method doesn't exist
          const trigger = profile.triggers.find(t => t.name === triggerName);
          if (trigger) {
            trigger.active = active;
            result = true;
            // Update active trigger session
            if (!profile.activeTriggerSession) {
              profile.activeTriggerSession = {
                startTime: new Date(),
                activeTriggers: active ? [triggerName] : [],
                lastUpdated: new Date()
              };
            } else {
              if (active) {
                profile.activeTriggerSession.activeTriggers = 
                  [...new Set([...(profile.activeTriggerSession.activeTriggers || []), triggerName])];
              } else {
                profile.activeTriggerSession.activeTriggers = 
                  (profile.activeTriggerSession.activeTriggers || []).filter(t => t !== triggerName);
              }
              profile.activeTriggerSession.lastUpdated = new Date();
            }
          }
        }
        
        if (result) {
          await profile.save();
          
          // Emit to all clients viewing this profile
          io.to(`profile-${username}`).emit('trigger-toggled', {
            triggerName,
            active,
            activeTriggerSession: profile.activeTriggerSession
          });
          
          logger.info(`Trigger ${active ? 'activated' : 'deactivated'} for ${username}`);
        } else {
          socket.emit('error', { message: 'Trigger not found' });
        }
      } catch (err) {
        handleSocketError(socket, err);
      }
    });

    // Toggle all triggers
    socket.on('toggle-all-triggers', async ({ username, active }) => {
      if (!username) {
        return socket.emit('error', { message: 'Missing username' });
      }
      
      try {
        const Profile = getProfileModel(); // Get model when needed
        
        const profile = await Profile.findOne({ username });
        if (!profile) {
          return socket.emit('error', { message: 'Profile not found' });
        }
        
        // Check if method exists (handle gracefully if it doesn't)
        if (typeof profile.toggleAllTriggers === 'function') {
          profile.toggleAllTriggers(active);
        } else {
          // Fallback implementation if method doesn't exist
          profile.triggers.forEach(trigger => {
            trigger.active = active;
          });
          
          // Update active trigger session
          if (!profile.activeTriggerSession) {
            profile.activeTriggerSession = {
              startTime: new Date(),
              activeTriggers: active ? profile.triggers.map(t => t.name) : [],
              lastUpdated: new Date()
            };
          } else {
            profile.activeTriggerSession.activeTriggers = active ? 
              profile.triggers.map(t => t.name) : [];
            profile.activeTriggerSession.lastUpdated = new Date();
          }
        }
        
        await profile.save();
        
        // Emit to all clients viewing this profile
        io.to(`profile-${username}`).emit('all-triggers-toggled', {
          active,
          activeTriggerSession: profile.activeTriggerSession,
          triggers: profile.triggers
        });
        
        logger.info(`All triggers ${active ? 'activated' : 'deactivated'} for ${username}`);
      } catch (err) {
        handleSocketError(socket, err);
      }
    });

    // Add new trigger
    socket.on('add-trigger', async ({ username, name, description, active }) => {
      if (!username || !name) {
        return socket.emit('error', { message: 'Missing required data' });
      }
      
      try {
        const Profile = getProfileModel(); // Get model when needed
        
        const profile = await Profile.findOne({ username });
        if (!profile) {
          return socket.emit('error', { message: 'Profile not found' });
        }
        
        // Check if trigger already exists
        const existingTrigger = profile.triggers.find(t => t.name === name);
        if (existingTrigger) {
          return socket.emit('error', { message: 'Trigger already exists' });
        }
        
        // Add the trigger
        profile.triggers.push({
          name,
          description: description || '',
          active: active !== false,
          isStandard: false,
          createdAt: new Date()
        });
        
        // Update active trigger session if the trigger is active
        if (active !== false) {
          if (!profile.activeTriggerSession) {
            profile.activeTriggerSession = {
              startTime: new Date(),
              activeTriggers: [name],
              lastUpdated: new Date()
            };
          } else {
            if (!profile.activeTriggerSession.activeTriggers) {
              profile.activeTriggerSession.activeTriggers = [];
            }
            profile.activeTriggerSession.activeTriggers.push(name);
            profile.activeTriggerSession.lastUpdated = new Date();
          }
        }
        
        await profile.save();
        
        // Emit to all clients viewing this profile
        io.to(`profile-${username}`).emit('trigger-added', {
          trigger: profile.triggers[profile.triggers.length - 1],
          activeTriggerSession: profile.activeTriggerSession
        });
        
        logger.info(`Trigger "${name}" added for ${username}`);
      } catch (err) {
        handleSocketError(socket, err);
      }
    });

    // Delete trigger
    socket.on('delete-trigger', async ({ username, triggerName }) => {
      if (!username || !triggerName) {
        return socket.emit('error', { message: 'Missing required data' });
      }
      
      try {
        const Profile = getProfileModel(); // Get model when needed
        
        const profile = await Profile.findOne({ username });
        if (!profile) {
          return socket.emit('error', { message: 'Profile not found' });
        }
        
        // Check if trigger exists
        const triggerIndex = profile.triggers.findIndex(t => t.name === triggerName);
        if (triggerIndex === -1) {
          return socket.emit('error', { message: 'Trigger not found' });
        }
        
        // Remove from active trigger session if active
        if (profile.activeTriggerSession && profile.activeTriggerSession.activeTriggers) {
          profile.activeTriggerSession.activeTriggers = 
            profile.activeTriggerSession.activeTriggers.filter(t => t !== triggerName);
          profile.activeTriggerSession.lastUpdated = new Date();
        }
        
        // Remove the trigger
        profile.triggers.splice(triggerIndex, 1);
        
        await profile.save();
        
        // Emit to all clients viewing this profile
        io.to(`profile-${username}`).emit('trigger-deleted', {
          triggerName,
          activeTriggerSession: profile.activeTriggerSession,
          triggers: profile.triggers
        });
        
        logger.info(`Trigger "${triggerName}" deleted for ${username}`);
      } catch (err) {
        handleSocketError(socket, err);
      }
    });
    
    // Process trigger event (when an external system activates triggers)
    socket.on('trigger-event', async ({ username, triggers, source }) => {
      if (!username || !triggers) {
        return socket.emit('error', { message: 'Missing required data' });
      }
      
      try {
        const Profile = getProfileModel(); // Get model when needed
        
        const profile = await Profile.findOne({ username });
        if (!profile) {
          return socket.emit('error', { message: 'Profile not found' });
        }
        
        // Add to trigger history
        if (!profile.triggerHistory) {
          profile.triggerHistory = [];
        }
        
        profile.triggerHistory.push({
          timestamp: new Date(),
          triggers: Array.isArray(triggers) ? triggers : [triggers],
          source: source || 'socket'
        });
        
        // Limit history size
        if (profile.triggerHistory.length > 100) {
          profile.triggerHistory = profile.triggerHistory.slice(-100);
        }
        
        await profile.save();
        
        // Emit trigger event to all clients viewing this profile
        io.to(`profile-${username}`).emit('trigger-event-received', {
          triggers: Array.isArray(triggers) ? triggers : [triggers],
          timestamp: new Date(),
          source: source || 'socket'
        });
        
        logger.info(`Trigger event processed for ${username}`);
      } catch (err) {
        handleSocketError(socket, err);
      }
    });

    // Delete profile
    socket.on('delete-profile', async ({ username }) => {
      if (!username) {
        return socket.emit('error', { message: 'Missing username' });
      }
      
      try {
        const Profile = getProfileModel(); // Get model when needed
        
        // Find and delete the profile
        const deletedProfile = await Profile.findOneAndDelete({ username });
        
        if (deletedProfile) {
          // Emit to all clients viewing this profile
          io.to(`profile-${username}`).emit('profile-deleted', { username });
          
          // Emit to the user who deleted
          socket.emit('profile-delete-success', {
            success: true,
            message: 'Profile deleted successfully',
            redirectUrl: '/'
          });
          
          logger.info(`Profile deleted for ${username}`);
        } else {
          socket.emit('error', { message: 'Profile not found' });
        }
      } catch (err) {
        handleSocketError(socket, err);
      }
    });

    // Get trigger history
    socket.on('get-trigger-history', async ({ username }) => {
      if (!username) {
        return socket.emit('error', { message: 'Missing username' });
      }
      
      try {
        const Profile = getProfileModel(); // Get model when needed
        
        const profile = await Profile.findOne({ username });
        if (!profile) {
          return socket.emit('error', { message: 'Profile not found' });
        }
        
        socket.emit('trigger-history', {
          history: profile.triggerHistory || []
        });
      } catch (err) {
        handleSocketError(socket, err);
      }
    });

    // Consolidated profile view event
    socket.on('profile-view', async (username) => {
      if (!username) return;
      
      try {
        const Profile = getProfileModel(); // Get model when needed
        
        // Try to get Profile model first
        const profile = await Profile.findOne({ username });
        
        if (profile) {
          // Update view metrics
          profile.lastViewed = new Date();
          profile.viewCount = (profile.viewCount || 0) + 1;
          await profile.save();
          
          socket.emit('profile-data', profile);
          logger.info(`Profile ${username} viewed`);
        } else {
          socket.emit('profile-not-found');
        }
      } catch (err) {
        handleSocketError(socket, err);
      }
    });

    // Disconnect event
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  };
}