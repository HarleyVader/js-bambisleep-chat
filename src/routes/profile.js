import express from 'express';
import mongoose from 'mongoose';
import Logger from '../utils/logger.js';
import footerConfig from '../config/footer.config.js';
import { requireLogin } from '../public/js/utils/auth.js';
import { User, getUser, updateUser } from '../models/models.js';
import { getBambiNameFromCookies, isProfileOwner } from '../utils/cookie-utils-server.js';

const logger = new Logger('ProfileRoutes');
const router = express.Router();

// Define the base path for this router
export const basePath = '/profile';

// Calculate XP needed for next level
function calculateNextLevelXP(level) {
  return Math.pow(level, 2) * 100;
}

// Calculate level from XP
function calculateLevelFromXP(xp) {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

// Check if feature is unlocked at user's level
function isFeatureUnlocked(featureName, level) {
  const featureLevels = {
    'trigger-categories': 2,
    'collar': 3,
    'spiral': 4,
    'session-sharing': 5
  };
  
  return level >= (featureLevels[featureName] || 0);
}

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
    
    // Calculate XP progress information
    const level = user.level || 1;
    const xp = user.xp || 0;
    const xpForNextLevel = calculateNextLevelXP(level);
    const xpForCurrentLevel = level > 1 ? calculateNextLevelXP(level - 1) : 0;
    const currentLevelXP = xp - xpForCurrentLevel;
    const percentToNextLevel = Math.min(100, Math.floor((currentLevelXP / (xpForNextLevel - xpForCurrentLevel)) * 100));
    
    // Create profile object with user data
    const profile = {
      username: user.username,
      displayName: user.displayName || user.username,
      level: level,
      xp: xp,
      currentXp: currentLevelXP,
      xpForNextLevel: xpForNextLevel,
      percentToNextLevel: percentToNextLevel,
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
    const cookieUsername = getBambiNameFromCookies(req);
    
    // First try to find the user with the findOne method
    let user = await User.findOne({ username });
    
    // If user doesn't exist, but the username matches the cookie
    // (meaning user is trying to view their own profile that doesn't exist yet),
    // create the user automatically
    if (!user && username === cookieUsername) {
      user = await User.findOrCreateByUsername(username);
      logger.info(`Created new user profile for ${username} based on cookie`);
    }
    
    if (user) {
      const isOwnProfile = isProfileOwner(req, username);
      
      // Calculate XP progress information
      const level = user.level || 1;
      const xp = user.xp || 0;
      const xpForNextLevel = calculateNextLevelXP(level);
      const xpForCurrentLevel = level > 1 ? calculateNextLevelXP(level - 1) : 0;
      const currentLevelXP = xp - xpForCurrentLevel;
      const percentToNextLevel = Math.min(100, Math.floor((currentLevelXP / (xpForNextLevel - xpForCurrentLevel)) * 100));
      
      // Convert user to profile format
      const profile = {
        username: user.username,
        displayName: user.displayName || user.username,
        level: level,
        xp: xp,
        currentXp: currentLevelXP,
        xpForNextLevel: xpForNextLevel,
        percentToNextLevel: percentToNextLevel,
        about: user.about || 'Tell us about yourself...',
        description: user.description || 'Share your bambi journey...',
        avatar: user.avatar || '/gif/default-avatar.gif',
        headerImage: user.headerImage || '/gif/default-header.gif',
        headerColor: user.headerColor || '#35424a',
        systemControls: user.systemControls || {
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
        unlockedFeatures: {
          triggerCategories: isFeatureUnlocked('trigger-categories', level),
          collar: isFeatureUnlocked('collar', level),
          spiral: isFeatureUnlocked('spiral', level),
          sessionSharing: isFeatureUnlocked('session-sharing', level)
        },
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
    const cookieUsername = getBambiNameFromCookies(req);
    
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
      // Calculate XP progress information
      const level = user.level || 1;
      const xp = user.xp || 0;
      const xpForNextLevel = calculateNextLevelXP(level);
      const xpForCurrentLevel = level > 1 ? calculateNextLevelXP(level - 1) : 0;
      const currentLevelXP = xp - xpForCurrentLevel;
      const percentToNextLevel = Math.min(100, Math.floor((currentLevelXP / (xpForNextLevel - xpForCurrentLevel)) * 100));
      
      // Convert user to profile format for template
      const profile = {
        username: user.username,
        displayName: user.displayName || user.username,
        avatar: user.avatar || '/gif/default-avatar.gif',
        headerImage: user.headerImage || '/gif/default-header.gif',
        headerColor: user.headerColor || '#35424a',
        level: level,
        xp: xp,
        currentXp: currentLevelXP,
        xpForNextLevel: xpForNextLevel,
        percentToNextLevel: percentToNextLevel,
        // Other fields
        ...user.toObject ? user.toObject() : {}
      };
      
      res.render('profile', {
        title: 'Edit Profile',
        profile,
        isOwnProfile: true,
        mode: 'edit',
        unlockedFeatures: {
          triggerCategories: isFeatureUnlocked('trigger-categories', level),
          collar: isFeatureUnlocked('collar', level),
          spiral: isFeatureUnlocked('spiral', level),
          sessionSharing: isFeatureUnlocked('session-sharing', level)
        },
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
    const cookieUsername = getBambiNameFromCookies(req);
    
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
    
    // Award XP for profile updates (if not already awarded in this session)
    const profileUpdateXpKey = `profile_update_${username}_${Date.now().toString().slice(0, -4)}`;
    if (!req.session[profileUpdateXpKey]) {
      updateObj.xp = (user.xp || 0) + 5; // Add 5 XP for profile updates
      
      // Recalculate level based on new XP
      const newLevel = calculateLevelFromXP(updateObj.xp);
      if (newLevel !== (user.level || 1)) {
        updateObj.level = newLevel;
        logger.info(`${username} leveled up to ${newLevel}!`);
      }
      
      // Mark XP as awarded for this session (prevents spam updates for XP)
      req.session[profileUpdateXpKey] = true;
    }
    
    // Update the user profile
    const updatedUser = await updateUser(username, updateObj);
    
    // If this is an AJAX request
    if (req.xhr || req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        success: true,
        message: 'Profile updated successfully',
        profile: updatedUser,
        xp: updatedUser.xp,
        level: updatedUser.level
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
    const cookieUsername = getBambiNameFromCookies(req);
    
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
    
    // Check level requirements for certain features
    const userLevel = user.level || 1;
    
    // Collar requires level 3
    if (req.body.collarEnabled && !isFeatureUnlocked('collar', userLevel)) {
      return res.status(403).json({
        success: false,
        message: 'You need to reach level 3 to use the collar feature'
      });
    }
    
    // Spirals require level 4
    if (req.body.spiralsEnabled && !isFeatureUnlocked('spiral', userLevel)) {
      return res.status(403).json({
        success: false,
        message: 'You need to reach level 4 to use the spirals feature'
      });
    }
    
    // Update system controls
    const controlFields = [
      'activeTriggers', 'collarEnabled', 'collarText', 
      'multiplierSettings', 'colorSettings', 'spiralsEnabled'
    ];
    
    // Build systemControls object
    const systemControls = user.systemControls || {};
    
    controlFields.forEach(field => {
      if (req.body[field] !== undefined) {
        systemControls[field] = req.body[field];
      }
    });
    
    // Award small XP for updating system controls
    const controlsUpdateXpKey = `controls_update_${username}_${Date.now().toString().slice(0, -4)}`;
    let xpUpdated = false;
    
    if (!req.session[controlsUpdateXpKey]) {
      const newXp = (user.xp || 0) + 2; // Add 2 XP for system control updates
      await updateUser(username, { xp: newXp });
      
      // Recalculate level based on new XP
      const newLevel = calculateLevelFromXP(newXp);
      if (newLevel !== (user.level || 1)) {
        await updateUser(username, { level: newLevel });
        logger.info(`${username} leveled up to ${newLevel}!`);
      }
      
      // Mark XP as awarded for this session
      req.session[controlsUpdateXpKey] = true;
      xpUpdated = true;
    }
    
    // Update user with new system controls
    await updateUser(username, { systemControls });
    
    return res.json({
      success: true,
      message: 'System controls updated successfully',
      xpAwarded: xpUpdated ? 2 : 0
    });
  } catch (error) {
    logger.error(`Error updating system controls for ${req.params.username}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update system controls'
    });
  }
});

// Add award XP endpoint
router.post('/:username/award-xp', async (req, res) => {
  try {
    const { username } = req.params;
    const { amount, action } = req.body;
    
    if (!amount || isNaN(parseInt(amount)) || parseInt(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid XP amount' });
    }
    
    const xpAmount = parseInt(amount);
    
    // Get user profile
    const user = await getUser(username);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    
    // Calculate new XP and level
    const currentXp = user.xp || 0;
    const currentLevel = user.level || 1;
    const newXp = currentXp + xpAmount;
    const newLevel = calculateLevelFromXP(newXp);
    
    // Update user profile with new XP and level
    const updatedUser = await updateUser(username, { 
      xp: newXp,
      level: newLevel
    });
    
    // Check if user leveled up
    const leveledUp = newLevel > currentLevel;
    
    // Return success response with updated data
    return res.json({
      success: true,
      message: `Awarded ${xpAmount} XP for ${action || 'activity'}`,
      xp: newXp,
      level: newLevel,
      leveledUp,
      action
    });
    
  } catch (error) {
    logger.error(`Error awarding XP to ${req.params.username}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to award XP'
    });
  }
});

export default router;