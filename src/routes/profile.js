import express from 'express';
import mongoose from 'mongoose';
import Logger from '../utils/logger.js';
import { getModel } from '../config/db.js';
import footerConfig from '../config/footer.config.js';
import { requireLogin } from '../middleware/auth.js';
import { User, getUser, updateUser } from '../models/User.js';

const logger = new Logger('ProfileRoutes');
const router = express.Router();

// Define the base path for this router
export const basePath = '/profile';

// Helper function to get username from cookies
const getUsernameFromCookies = (req) => {
  try {
    return req.cookies && req.cookies.bambiname 
      ? decodeURIComponent(req.cookies.bambiname) 
      : null;
  } catch (error) {
    return null;
  }
};

// Check if user owns profile based on cookie
const isProfileOwner = (req, profileUsername) => {
  const cookieUsername = getUsernameFromCookies(req);
  return cookieUsername === profileUsername;
};

// Profile page - require login
router.get('/', requireLogin, async (req, res) => {
  try {
    // Get the logged in user
    const username = req.session.username;
    
    if (!username) {
      return res.redirect('/login');
    }
    
    // Fetch user profile data from database using getUser helper
    const user = await getUser(username);
    
    if (!user) {
      return res.status(404).render('error', {
        message: 'User not found',
        error: { status: 404 }
      });
    }
    
    // Create profile object with user data
    const profile = {
      username: user.username,
      displayName: user.displayName || user.username,
      level: user.level || 1,
      xp: user.xp || 0,
      joinDate: user.createdAt || new Date(),
      sessions: user.sessions || [],
      preferences: user.preferences || {}
    };
    
    // Render the profile page with the profile data
    return res.render('profile', { 
      profile,
      user: req.session.username
    });
  } catch (error) {
    logger.error('Error fetching profile:', error);
    return res.status(500).render('error', {
      message: 'Something went wrong. Please try again later.',
      error: { status: 500 }
    });
  }
});

// View profile
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const cookieUsername = getUsernameFromCookies(req);
    
    // First try to find the user with the getUserByUsername method
    let user = await User.getUserByUsername(username);
    
    // If user doesn't exist, but the username matches the cookie
    // (meaning user is trying to view their own profile that doesn't exist yet),
    // create the user automatically
    if (!user && username === cookieUsername) {
      user = await User.findOrCreateByUsername(username);
      logger.info(`Created new user profile for ${username} based on cookie`);
    }
    
    if (user) {
      const isOwnProfile = isProfileOwner(req, username);
      
      // Convert user to profile format
      const profile = {
        username: user.username,
        displayName: user.displayName || user.username,
        level: user.level || 1,
        xp: user.xp || 0,
        about: 'Tell us about yourself...',
        description: 'Share your bambi journey...',
        avatar: user.avatar || '/gif/default-avatar.gif',
        headerImage: '/gif/default-header.gif',
        headerColor: '#35424a',
        systemControls: {
          activeTriggers: ["BAMBI SLEEP"],
          collarEnabled: false,
          collarText: ''
        },
        // Other profile fields that might be in the user object
        ...user.toObject ? user.toObject() : {}
      };
      
      // Render the profile view
      res.render('profile', {
        title: `${profile.displayName || profile.username}'s Profile`,
        profile,
        isOwnProfile,
        mode: 'view',
        footer: footerConfig
      });
    } else {
      // Profile not found and not the user's own profile
      res.status(404).render('error', {
        message: 'Profile not found',
        error: { status: 404 },
        title: 'Profile Not Found'
      });
    }
  } catch (error) {
    logger.error(`Error loading profile ${req.params.username}:`, error);
    res.status(500).render('error', {
      message: 'Failed to load profile',
      error: req.app.get('env') === 'development' ? error : {},
      title: 'Error'
    });
  }
});

// Edit profile page
router.get('/:username/edit', async (req, res) => {
  try {
    const { username } = req.params;
    const cookieUsername = getUsernameFromCookies(req);
    
    // Check if user is authorized to edit this profile
    if (username !== cookieUsername) {
      return res.status(403).render('error', {
        message: 'You are not authorized to edit this profile',
        error: { status: 403 },
        title: 'Access Denied'
      });
    }
    
    const user = await getUser(username);
    
    if (user) {
      // Convert user to profile format for template
      const profile = {
        username: user.username,
        displayName: user.displayName || user.username,
        avatar: user.avatar || '/gif/default-avatar.gif',
        headerImage: '/gif/default-header.gif',
        headerColor: '#35424a',
        level: user.level || 1,
        xp: user.xp || 0,
        // Other fields
        ...user.toObject ? user.toObject() : {}
      };
      
      res.render('profile', {
        title: 'Edit Profile',
        profile,
        isOwnProfile: true,
        mode: 'edit',
        footer: footerConfig
      });
    } else {
      res.status(404).render('error', {
        message: 'Profile not found',
        error: { status: 404 },
        title: 'Profile Not Found'
      });
    }
  } catch (error) {
    logger.error(`Error loading edit page for ${req.params.username}:`, error);
    res.status(500).render('error', {
      message: 'Failed to load edit page',
      error: req.app.get('env') === 'development' ? error : {},
      title: 'Error'
    });
  }
});

// Update profile via form submission
router.post('/:username/update', async (req, res) => {
  try {
    const { username } = req.params;
    const cookieUsername = getUsernameFromCookies(req);
    
    // Check if user is authorized to update this profile
    if (username !== cookieUsername) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this profile'
      });
    }
    
    const user = await getUser(username);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    
    // Fields that can be updated
    const allowedFields = [
      'displayName', 'avatar', 'headerImage', 'headerColor',
      'about', 'description', 'seasons'
    ];
    
    // Build update object with only allowed fields
    const updateObj = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateObj[field] = req.body[field];
      }
    });
    
    // Update the user profile
    const updatedUser = await updateUser(username, updateObj);
    
    // If this is an AJAX request
    if (req.xhr || req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        success: true,
        message: 'Profile updated successfully',
        profile: updatedUser
      });
    }
    
    // For regular form submissions, redirect to profile page
    res.redirect(`/profile/${username}`);
  } catch (error) {
    logger.error(`Error updating profile ${req.params.username}:`, error);
    
    // For AJAX requests
    if (req.xhr || req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }
    
    // For regular form submissions
    res.status(500).render('error', {
      message: 'Failed to update profile',
      error: req.app.get('env') === 'development' ? error : {},
      title: 'Error'
    });
  }
});

// System controls update endpoint
router.post('/:username/system-controls', async (req, res) => {
  try {
    const { username } = req.params;
    const cookieUsername = getUsernameFromCookies(req);
    
    // Check if user is authorized to update this profile
    if (username !== cookieUsername) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update system controls'
      });
    }
    
    const user = await getUser(username);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    
    // Update system controls
    const controlFields = [
      'activeTriggers', 'collarEnabled', 'collarText', 
      'multiplierSettings', 'colorSettings'
    ];
    
    // Build systemControls object
    const systemControls = user.systemControls || {};
    
    controlFields.forEach(field => {
      if (req.body[field] !== undefined) {
        systemControls[field] = req.body[field];
      }
    });
    
    // Update user with new system controls
    await updateUser(username, { systemControls });
    
    return res.json({
      success: true,
      message: 'System controls updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating system controls for ${req.params.username}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update system controls'
    });
  }
});

// Add a delete profile route
router.post('/:username/delete', async (req, res) => {
  try {
    const { username } = req.params;
    const cookieUsername = getUsernameFromCookies(req);
    
    // Check if user is authorized to delete this profile
    if (username !== cookieUsername) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this profile'
      });
    }
    
    // Use the User model directly for deletion
    const result = await User.deleteOne({ username });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    
    // Clear the cookie
    res.clearCookie('bambiname', { path: '/' });
    
    // If this is an AJAX request
    if (req.xhr || req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        success: true,
        message: 'Profile deleted successfully'
      });
    }
    
    // For regular form submissions, redirect to home page
    res.redirect('/');
  } catch (error) {
    logger.error(`Error deleting profile ${req.params.username}:`, error);
    
    // For AJAX requests
    if (req.xhr || req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete profile'
      });
    }
    
    // For regular form submissions
    res.status(500).render('error', {
      message: 'Failed to delete profile',
      error: req.app.get('env') === 'development' ? error : {},
      title: 'Error'
    });
  }
});

// Create profile page
router.get('/new', (req, res) => {
  // First check if user already has a profile based on cookie
  const cookieUsername = getUsernameFromCookies(req);
  
  if (cookieUsername) {
    // Redirect to existing profile if cookie exists
    return res.redirect(`/profile/${cookieUsername}`);
  }
  
  res.render('profile', {
    title: 'Create New Profile',
    mode: 'create',
    footer: footerConfig
  });
});

// Create profile submission
router.post('/new', async (req, res) => {
  try {
    const { username, displayName, avatar, about, description, seasons } = req.body;
    
    // Check if username already exists using User model
    const existingUser = await getUser(username);
    
    if (existingUser) {
      return res.render('profile', { 
        title: 'Create New Profile',
        mode: 'create',
        error: 'Username already exists. Please choose a different username.',
        formData: req.body,
        footer: footerConfig
      });
    }
    
    // Process seasons
    const selectedSeasons = Array.isArray(seasons) ? seasons : [seasons].filter(Boolean);
    
    // Create new user with profile data
    const newUser = new User({
      username,
      displayName: displayName || username,
      avatar: avatar || '/gif/default-avatar.gif',
      about: about || 'Tell us about yourself...',
      description: description || 'Share your bambi journey...',
      seasons: selectedSeasons.length > 0 ? selectedSeasons : ['spring'],
      level: 1,
      xp: 0,
      sessions: [],
      systemControls: {
        activeTriggers: ["BAMBI SLEEP"],
        collarEnabled: false,
        collarText: ''
      }
    });
    
    await newUser.save();
    
    // Set cookie and redirect
    res.cookie('bambiname', username, { path: '/' });
    res.redirect(`/profile/${username}`);
  } catch (error) {
    if (error.code === 11000) {
      // Handle duplicate key error
      return res.render('profile', { 
        title: 'Create New Profile',
        mode: 'create',
        error: 'Username already exists. Please choose a different username.',
        formData: req.body,
        footer: footerConfig
      });
    }
    
    logger.error('Error creating profile:', error);
    res.status(500).render('profile', { 
      title: 'Create New Profile',
      mode: 'create',
      error: 'Failed to create profile. Please try again.',
      formData: req.body,
      footer: footerConfig
    });
  }
});

export default router;