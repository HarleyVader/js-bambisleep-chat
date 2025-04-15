import { Profile } from '../models/Profile.js';
import logger from '../utils/logger.js'; // Updated path to use the logger in main src folder

export default function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    logger.info('New client connected');
    
    // Join profile room
    socket.on('join-profile', async (username) => {
      socket.join(`profile-${username}`);
      logger.info(`Client joined room: profile-${username}`);
      
      try {
        // Fetch profile data and send it to the client
        const profile = await Profile.findOne({ username });
        if (profile) {
          socket.emit('profile-data', profile);
        } else {
          socket.emit('profile-not-found');
        }
      } catch (err) {
        logger.error(`Error fetching profile: ${err.message}`);
        socket.emit('error', { message: 'Failed to load profile' });
      }
    });

    // Create a new profile
    socket.on('create-profile', async (profileData) => {
      try {
        const profile = new Profile(profileData);
        await profile.save();
        
        // Emit to everyone that a new profile was created
        io.emit('new-profile-created', {
          username: profile.username
        });
        
        // Emit to the creator
        socket.emit('profile-created', profile);
      } catch (err) {
        logger.error(`Error creating profile: ${err.message}`);
        socket.emit('error', { message: 'Failed to create profile' });
      }
    });

    // Update profile
    socket.on('update-profile', async (data, callback) => {
      try {
        // Process the update
        const result = await Profile.findOneAndUpdate(
          { username: data.username },
          { $set: data },
          { new: true }
        );
        
        if (!result) {
          // Check if callback is a function before calling it
          if (typeof callback === 'function') {
            return callback({ success: false, message: 'Profile not found' });
          }
          return;
        }
        
        // Broadcast the update to all connected clients viewing this profile
        socket.to(`profile-${data.username}`).emit('profile-updated', result);
        
        // Emit the update data to the client
        const updateData = data;
        socket.emit('update-profile', updateData, function(response) {
          // Handle response
        });

        // Send success response via callback if provided
        if (typeof callback === 'function') {
          callback({ 
            success: true, 
            message: 'Profile updated successfully',
            data: result
          });
        }
      } catch (error) {
        logger.error(`Profile update error: ${error.message}`);
        if (typeof callback === 'function') {
          callback({ 
            success: false, 
            message: error.message || 'Failed to update profile' 
          });
        }
      }
    });

    // Toggle trigger
    socket.on('toggle-trigger', async ({ username, triggerName, active }) => {
      try {
        const profile = await Profile.findOne({ username });
        if (!profile) {
          return socket.emit('error', { message: 'Profile not found' });
        }
        
        const result = profile.setTriggerActive(triggerName, active);
        
        if (result) {
          await profile.save();
          
          // Emit to all clients viewing this profile
          io.to(`profile-${username}`).emit('trigger-toggled', {
            triggerName,
            active,
            activeTriggerSession: profile.activeTriggerSession
          });
          
          logger.success(`Trigger ${active ? 'activated' : 'deactivated'} for ${username}`);
        } else {
          socket.emit('error', { message: 'Trigger not found' });
        }
      } catch (err) {
        logger.error(`Error toggling trigger: ${err.message}`);
        socket.emit('error', { message: 'Failed to toggle trigger' });
      }
    });

    // Toggle all triggers
    socket.on('toggle-all-triggers', async ({ username, active }) => {
      try {
        const profile = await Profile.findOne({ username });
        if (!profile) {
          return socket.emit('error', { message: 'Profile not found' });
        }
        
        profile.toggleAllTriggers(active);
        await profile.save();
        
        // Emit to all clients viewing this profile
        io.to(`profile-${username}`).emit('all-triggers-toggled', {
          active,
          activeTriggerSession: profile.activeTriggerSession,
          triggers: profile.triggers
        });
        
        logger.success(`All triggers ${active ? 'activated' : 'deactivated'} for ${username}`);
      } catch (err) {
        logger.error(`Error toggling all triggers: ${err.message}`);
        socket.emit('error', { message: 'Failed to toggle all triggers' });
      }
    });

    // Add new trigger
    socket.on('add-trigger', async ({ username, name, description, active }) => {
      try {
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
          isStandard: false
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
        
        logger.success(`Trigger "${name}" added for ${username}`);
      } catch (err) {
        logger.error(`Error adding trigger: ${err.message}`);
        socket.emit('error', { message: 'Failed to add trigger' });
      }
    });

    // Delete trigger
    socket.on('delete-trigger', async ({ username, triggerName }) => {
      try {
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
        
        logger.success(`Trigger "${triggerName}" deleted for ${username}`);
      } catch (err) {
        logger.error(`Error deleting trigger: ${err.message}`);
        socket.emit('error', { message: 'Failed to delete trigger' });
      }
    });
    
    // Process trigger event (when an external system activates triggers)
    socket.on('trigger-event', async ({ username, triggers, source }) => {
      try {
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
        
        logger.success(`Trigger event processed for ${username}`);
      } catch (err) {
        logger.error(`Error processing trigger event: ${err.message}`);
        socket.emit('error', { message: 'Failed to process trigger event' });
      }
    });

    // Delete profile
    socket.on('delete-profile', async ({ username }) => {
      try {
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
          
          logger.success(`Profile deleted for ${username}`);
        } else {
          socket.emit('error', { message: 'Profile not found' });
        }
      } catch (err) {
        logger.error(`Error deleting profile: ${err.message}`);
        socket.emit('error', { message: 'Failed to delete profile' });
      }
    });

    // Get trigger history
    socket.on('get-trigger-history', async ({ username }) => {
      try {
        const profile = await Profile.findOne({ username });
        if (!profile) {
          return socket.emit('error', { message: 'Profile not found' });
        }
        
        socket.emit('trigger-history', {
          history: profile.triggerHistory || []
        });
      } catch (err) {
        logger.error(`Error getting trigger history: ${err.message}`);
        socket.emit('error', { message: 'Failed to get trigger history' });
      }
    });

    // Disconnect event
    socket.on('disconnect', () => {
      logger.info('Client disconnected');
    });
  });
}