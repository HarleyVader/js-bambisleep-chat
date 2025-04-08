import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import Bambi from '../schemas/BambiSchema.js';
import Logger from '../utils/logger.js';
import path from 'path';
import { promises as fsPromises } from 'fs';

const router = express.Router();
const logger = new Logger('BambiRoutes');

// Configure multer to use memory storage instead of disk storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  fileFilter: fileFilter
});

// Helper to get the bambiname from cookies
function getBambiNameFromCookies(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';')
    .map(cookie => cookie.trim().split('='))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  
  return cookies['bambiname'] 
    ? decodeURIComponent(cookies['bambiname']).replace(/%20/g, ' ') 
    : null;
}

// Main bambis page route
router.get('/', async (req, res) => {
  try {
    // Get all bambis, sorted by lastActive
    const bambis = await Bambi.find()
      .sort({ lastActive: -1 })
      .limit(20);
    
    res.render('bambis', { 
      bambis
    });
  } catch (error) {
    logger.error('Error fetching bambis:', error.message);
    res.status(500).send('Error loading bambis page');
  }
});

// Create profile page route
router.get('/create', (req, res) => {
  const bambiname = getBambiNameFromCookies(req);
  
  if (!bambiname) {
    return res.redirect('/bambis');
  }
  
  // Check if profile already exists
  Bambi.findOne({ username: bambiname })
    .then(existingProfile => {
      if (existingProfile) {
        return res.redirect(`/bambis/${bambiname}`);
      }
      
      // Use the bambi-create.ejs template for new profiles
      res.render('bambis/bambi-create', { 
        bambiname
      });
    })
    .catch(error => {
      logger.error('Error checking for existing profile:', error.message);
      res.status(500).send('Error checking profile');
    });
});

// Edit profile page route
router.get('/edit', async (req, res) => {
  try {
    const bambiname = getBambiNameFromCookies(req);
    
    if (!bambiname) {
      return res.redirect('/bambis');
    }
    
    // Find the bambi profile
    let bambi = await Bambi.findOne({ username: bambiname });
    
    if (!bambi) {
      return res.redirect('/bambis/create');
    }
    
    // Updated path to reflect the new folder structure
    res.render('bambis/bambi-edit', { 
      bambi,
      newProfile: false
    });
  } catch (error) {
    logger.error('Error loading edit profile page:', error.message);
    res.status(500).send('Error loading edit profile page');
  }
});

// Individual profile page route
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const currentBambiname = getBambiNameFromCookies(req);
    
    // Find the bambi profile
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi) {
      return res.status(404).send('Bambi profile not found');
    }
    
    // Check if the current user has liked this profile
    const userHasLiked = bambi.hearts.users.some(user => user.username === currentBambiname);
    
    // Update last view time
    bambi.lastActive = Date.now();
    await bambi.save();
    
    // Updated path to reflect the new folder structure
    res.render('bambis/bambi-profile', { 
      bambi,
      isOwnProfile: currentBambiname === username,
      userHasLiked
    });
  } catch (error) {
    logger.error('Error fetching bambi profile:', error.message);
    res.status(500).send('Error loading bambi profile');
  }
});

// API route to update profile
router.post('/api/update-profile', upload.single('avatar'), async (req, res) => {
    try {
      logger.info('Update profile request received');
      
      const bambiname = getBambiNameFromCookies(req);
      logger.info(`Processing for bambiname: ${bambiname}`);
      
      if (!bambiname) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
      }
      
      // Check if this is a new profile or updating existing
      let bambi = await Bambi.findOne({ username: bambiname });
      const isNewProfile = !bambi;
      
      if (isNewProfile) {
        logger.info('Creating new profile');
        // Create new profile with all required fields
        bambi = new Bambi({
          username: bambiname,
          displayName: req.body.displayName || bambiname,
          description: req.body.description || '',
          level: 1,
          experience: 0,
          followers: [],
          hearts: { count: 0, users: [] },
          lastActive: Date.now(),
          profilePictureUrl: '/bambis/api/profile/' + bambiname + '/picture'
        });
      } else {
        logger.info('Updating existing profile');
      }
      
      // Update basic info
      bambi.displayName = req.body.displayName || bambiname;
      bambi.description = req.body.description || '';
      
      // Update theme
      bambi.profileTheme = {
        primaryColor: req.body.primaryColor || '#fa81ff',
        secondaryColor: req.body.secondaryColor || '#ff4fa2',
        textColor: req.body.textColor || '#ffffff'
      };
      
      // Process triggers with better error handling
      if (req.body.triggers) {
        try {
          const triggers = JSON.parse(req.body.triggers);
          if (Array.isArray(triggers)) {
            // Filter out any invalid values (null, undefined, etc.)
            bambi.triggers = triggers
              .filter(trigger => trigger && typeof trigger === 'string')
              .slice(0, 10); // Limit to 10 triggers
          }
        } catch (e) {
          logger.error('Error parsing triggers:', e.message);
          // Don't throw error, continue with existing triggers or empty array
          bambi.triggers = bambi.triggers || [];
        }
      } else {
        // Ensure triggers is always an array
        bambi.triggers = bambi.triggers || [];
      }
      
      // Process uploaded avatar with better error handling
      if (req.file) {
        try {
          // Convert buffer to base64 directly
          const base64Data = req.file.buffer.toString('base64');
          
          // Store in the database
          bambi.profileImageData = base64Data;
          bambi.profileImageType = req.file.mimetype;
          bambi.profileImageName = req.file.originalname;
          
          logger.info('Profile image processed successfully');
        } catch (e) {
          logger.error('Error processing avatar:', e.message);
          // Continue without updating the profile image
        }
      }
      
      // Update last active time
      bambi.lastActive = Date.now();
      
      // Save the profile with explicit error handling
      try {
        logger.info('Saving profile changes to database');
        await bambi.save();
        logger.info('Profile saved successfully');
      } catch (saveError) {
        logger.error('Error saving profile:', saveError.message);
        if (saveError.name === 'ValidationError') {
          return res.status(400).json({ 
            success: false, 
            message: 'Validation error: ' + Object.values(saveError.errors).map(e => e.message).join(', ')
          });
        }
        throw saveError; // Re-throw for the outer catch block
      }
      
      // If new profile, add activity and experience safely
      if (isNewProfile) {
        try {
          // Add activity using the method defined in BambiSchema
          await bambi.addActivity('other', 'Created their profile');
          // Add experience using the method defined in BambiSchema
          await bambi.addExperience(50);
        } catch (activityError) {
          logger.error('Error adding activity/experience:', activityError.message);
          // Don't fail the whole request if just this part fails
        }
      }
      
      // Send response
      res.json({ 
        success: true, 
        message: isNewProfile ? 'Profile created successfully!' : 'Profile updated successfully!',
        redirect: isNewProfile ? `/bambis/${bambi.username}` : null
      });
    } catch (error) {
      // Improved error logging
      logger.error('Error updating profile:', error.message);
      logger.error('Stack trace:', error.stack);
      res.status(500).json({ 
        success: false, 
        message: 'Server error: ' + error.message,
        errorType: error.name
      });
    }
});

// API route for hearts
router.post('/api/heart/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const currentBambiname = getBambiNameFromCookies(req);
    
    if (!currentBambiname) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    // Find the bambi profile
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi) {
      return res.status(404).json({ success: false, message: 'Bambi profile not found' });
    }
    
    // Check if user already liked
    const userHeartIndex = bambi.hearts.users.findIndex(user => user.username === currentBambiname);
    let liked = false;
    
    if (userHeartIndex >= 0) {
      // Remove the heart
      bambi.hearts.users.splice(userHeartIndex, 1);
      bambi.hearts.count = Math.max(0, bambi.hearts.count - 1);
    } else {
      // Add a heart
      bambi.hearts.users.push({
        username: currentBambiname,
        timestamp: new Date()
      });
      bambi.hearts.count++;
      liked = true;
      
      // Add activity for the bambi
      await bambi.addActivity('heart', `Received a heart from ${currentBambiname}`);
      
      // Award experience
      await bambi.addExperience(5);
    }
    
    // Save the changes
    await bambi.save();
    
    res.json({ 
      success: true, 
      count: bambi.hearts.count,
      liked
    });
  } catch (error) {
    logger.error('Error processing heart:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API route to get profile image
router.get('/api/profile/:username/picture', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Find the bambi profile
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi || !bambi.profileImageData || !bambi.profileImageType) {
      // Simple fallback instead of trying to use file system
      return res.redirect('/images/default-profile.png');
    }
    
    // Convert base64 to binary
    const img = Buffer.from(bambi.profileImageData, 'base64');
    
    // Set appropriate content type and cache headers
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.setHeader('Content-Type', bambi.profileImageType);
    
    // Send the image
    res.send(img);
  } catch (error) {
    logger.error('Error fetching profile picture:', error.message);
    res.redirect('/images/default-profile.png');
  }
});

// Add a route for following/unfollowing another Bambi
router.post('/api/follow/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const currentBambiname = getBambiNameFromCookies(req);
    
    if (!currentBambiname) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    // Don't allow following yourself
    if (currentBambiname === username) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
    }
    
    // Find both Bambi profiles
    const [currentBambi, targetBambi] = await Promise.all([
      Bambi.findOne({ username: currentBambiname }),
      Bambi.findOne({ username })
    ]);
    
    if (!currentBambi || !targetBambi) {
      return res.status(404).json({ success: false, message: 'Bambi profile not found' });
    }
    
    // Check if already following
    const isFollowing = currentBambi.following.some(follow => follow === username);
    
    if (isFollowing) {
      // Unfollow
      // Remove from current user's following list
      currentBambi.following = currentBambi.following.filter(follow => follow !== username);
      
      // Remove from target user's followers list
      targetBambi.followers = targetBambi.followers.filter(follower => follower !== currentBambiname);
      
      await Promise.all([currentBambi.save(), targetBambi.save()]);
      
      return res.json({ 
        success: true, 
        following: false,
        message: `You are no longer following ${targetBambi.displayName || username}`
      });
    } else {
      // Follow
      // Add to current user's following list if not already present
      if (!currentBambi.following.includes(username)) {
        currentBambi.following.push(username);
      }
      
      // Add to target user's followers list if not already present
      if (!targetBambi.followers.includes(currentBambiname)) {
        targetBambi.followers.push(currentBambiname);
      }
      
      // Add activity for the target Bambi
      await targetBambi.addActivity('other', `Got a new follower: ${currentBambi.displayName || currentBambiname}`);
      
      // Award experience to both users
      await Promise.all([
        targetBambi.addExperience(2),  // Small XP for being followed
        currentBambi.addExperience(1)  // Even smaller XP for following someone
      ]);
      
      await Promise.all([currentBambi.save(), targetBambi.save()]);
      
      return res.json({ 
        success: true, 
        following: true,
        message: `You are now following ${targetBambi.displayName || username}`
      });
    }
  } catch (error) {
    logger.error('Error processing follow/unfollow:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add a route to get followers/following lists
router.get('/api/connections/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const type = req.query.type || 'followers'; // Default to followers
    
    // Find the Bambi profile
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi) {
      return res.status(404).json({ success: false, message: 'Bambi profile not found' });
    }
    
    if (type === 'followers') {
      // Get followers details
      const followers = await Bambi.find({ username: { $in: bambi.followers } })
        .select('username displayName profileTheme lastActive');
      
      return res.json({
        success: true,
        connections: followers
      });
    } else if (type === 'following') {
      // Get following details
      const following = await Bambi.find({ username: { $in: bambi.following } })
        .select('username displayName profileTheme lastActive');
      
      return res.json({
        success: true,
        connections: following
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid connection type' });
    }
  } catch (error) {
    logger.error('Error fetching connections:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;