const Profile = require('../models/Profile');
const logger = require('../utils/logger');

module.exports = (io) => {
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

    // Disconnect event
    socket.on('disconnect', () => {
      logger.info('Client disconnected');
    });
  });
};