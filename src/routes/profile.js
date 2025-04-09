import express from 'express';
import mongoose from 'mongoose';
import { Logger } from '../utils/logger.js';
import { validationResult, body, param } from 'express-validator';
import dbConnection from '../database/dbConnection.js';
import { withDatabaseTimeout } from '../database/databaseErrorHandler.js';
import { withTransaction } from '../database/transaction.js';

import Profile from '../models/Bambi.js';
import auth from '../middleware/auth.js';

const logger = new Logger('Profiles');
const router = express.Router();

// Helper function to get username from cookies
const getUsernameFromCookies = (req) => {
  if (req.cookies && req.cookies.bambiname) {
    return decodeURIComponent(req.cookies.bambiname);
  }
  return null;
};

// Input validation middleware
const validateProfileInput = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores and hyphens'),
  body('displayName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Display name cannot exceed 50 characters'),
  body('about')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('About section cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL'),
  body('triggers')
    .optional()
    .isArray()
    .withMessage('Triggers must be an array'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Validation error', 
          errors: errors.array() 
        });
      }
      return res.status(400).render('error', {
        message: 'Validation error',
        error: { status: 400, details: errors.array() },
        title: 'Validation Error',
        validConstantsCount: 5
      });
    }
    next();
  }
];

// Create a middleware to check if user owns the profile
const ownershipCheck = (req, res, next) => {
  const { username } = req.params;
  const currentBambiname = getUsernameFromCookies(req);
  
  if (!currentBambiname || currentBambiname !== username) {
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to modify this profile' 
      });
    }
    return res.status(403).render('error', { 
      message: 'You are not authorized to modify this profile',
      error: { status: 403 },
      title: 'Authorization Error',
      validConstantsCount: 5
    });
  }
  
  next();
};

// Add a middleware to ensure database connection before operations
const ensureDbConnection = async (req, res, next) => {
  try {
    if (!dbConnection.isConnected()) {
      await dbConnection.connect();
    }
    next();
  } catch (error) {
    logger.error(`Database connection failed: ${error.message}`);
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(500).json({
        success: false,
        message: 'Database connection failed'
      });
    }
    return res.status(500).render('error', {
      message: 'Database connection failed',
      error: { status: 500 },
      title: 'Database Error',
      validConstantsCount: 5
    });
  }
};

// Add a middleware for database operations with error handling
const withDBErrorHandling = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    logger.error(`Database operation failed: ${error.message}`, { 
      route: req.originalUrl,
      method: req.method,
      stack: error.stack
    });
    
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(500).json({
        success: false,
        message: 'A database error occurred'
      });
    }
    
    return res.status(500).render('error', {
      message: 'A database error occurred',
      error: req.app.get('env') === 'development' ? error : {},
      validConstantsCount: 5,
      title: 'Database Error'
    });
  }
};

// Apply database error handling to all routes
router.use((req, res, next) => {
  const originalRender = res.render;
  const originalJson = res.json;
  
  // Wrap render to add consistent template data
  res.render = function(view, options, callback) {
    // Add common properties to all render calls
    const enhancedOptions = {
      ...options,
      validConstantsCount: options.validConstantsCount || 5,
      footer: options.footer || {
        logo: {
          url: "https://brandynette.xxx/",
          image: "/gif/default-avatar.gif",
          alt: "Brandynette.xxx"
        },
        tagline: "Connect with other Bambis and explore the forest together"
      }
    };
    return originalRender.call(this, view, enhancedOptions, callback);
  };
  
  // Wrap JSON to add consistent API response format
  res.json = function(body) {
    // If success status isn't explicitly set, determine it from the HTTP status code
    if (body.success === undefined) {
      body.success = res.statusCode >= 200 && res.statusCode < 300;
    }
    return originalJson.call(this, body);
  };
  
  next();
});

// Apply ensureDbConnection middleware to all routes
router.use(ensureDbConnection);

// Home page - Show all profiles with pagination
router.get('/', withDBErrorHandling(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  // Use Promise.all to run queries in parallel
  const [profiles, totalProfiles] = await Promise.all([
    Profile.find()
      .select('username displayName avatar about updatedAt') // Only select fields we need
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(), // Convert to plain JS object for better performance
      
    Profile.countDocuments() // Get total count for pagination
  ]);
  
  const totalPages = Math.ceil(totalProfiles / limit);
  
  res.render('index', { 
    title: 'BambiSleep Community Profiles',
    profiles,
    pagination: {
      current: page,
      total: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    validConstantsCount: 5
  });
}));

// Create profile page
router.get('/new', (req, res) => {
  // Check if user already has a profile
  const currentBambiname = getUsernameFromCookies(req);
  if (currentBambiname) {
    return res.redirect(`/profile/${currentBambiname}`);
  }
  
  res.render('creation', { 
    title: 'Create New Profile',
    validConstantsCount: 5
  });
});

// Create profile submission with validation
router.post('/new', validateProfileInput, withDBErrorHandling(async (req, res) => {
  const { username, displayName, avatar, about, description, seasons } = req.body;
  
  // Use transaction for consistent data
  await withTransaction(async (session) => {
    // Check if username already exists
    const existingProfile = await Profile.findOne({ username }).session(session);
    if (existingProfile) {
      return res.render('creation', { 
        title: 'Create New Profile',
        error: 'Username already exists',
        validConstantsCount: 5
      });
    }
    
    // Process seasons
    const selectedSeasons = Array.isArray(seasons) ? seasons : [seasons].filter(Boolean);
    
    // Create new profile
    const newProfile = new Profile({
      username,
      displayName: displayName || username,
      avatar: avatar || '/gif/default-avatar.gif',
      about: about || 'Tell us about yourself...',
      description: description || 'Share your bambi journey...',
      seasons: selectedSeasons.length > 0 ? selectedSeasons : ['spring'],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await newProfile.save({ session });
    
    // Set cookie with security options
    res.cookie('bambiname', username, { 
      path: '/',
      httpOnly: true, // Prevents JavaScript from accessing the cookie
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
      sameSite: 'strict' // Prevents CSRF attacks
    });
    
    // Set session too for better auth
    if (req.session) {
      req.session.user = {
        username: username,
        profileId: newProfile._id
      };
    }
    
    res.redirect(`/profile/${username}`);
  });
}));

// Handle profile updates with improved error handling
router.post('/update', auth, validateProfileInput, withDBErrorHandling(async (req, res) => {
  // Get username from session or cookie
  const username = req.user?.username || getUsernameFromCookies(req);
  
  if (!username) {
    return res.status(401).json({ 
      success: false, 
      message: 'You must be logged in to update your profile' 
    });
  }
  
  // Use database timeout and transaction for better error handling
  const updatedProfile = await withDatabaseTimeout(
    async () => {
      // Perform update within a transaction for data consistency
      return withTransaction(async (session) => {
        const bambi = await mongoose.model('Bambi').findOneAndUpdate(
          { username },
          { 
            $set: {
              about: req.body.about,
              description: req.body.description,
              profilePictureUrl: req.body.profilePictureUrl,
              headerImageUrl: req.body.headerImageUrl,
              lastActive: new Date(),
              updatedAt: new Date()
            }
          },
          { new: true, session }
        );
        
        if (!bambi) {
          throw new Error('Profile not found');
        }
        
        return bambi;
      });
    },
    10000, // 10 second timeout
    'Update profile'
  );
  
  res.json({ 
    success: true, 
    message: 'Profile updated successfully',
    bambi: updatedProfile
  });
}));

// View profile with efficient query
router.get('/:username', param('username').trim().escape(), withDBErrorHandling(async (req, res) => {
  const { username } = req.params;
  
  const profile = await Profile.findOne({ username })
    .select('-__v') // Exclude version field
    .lean(); // Use lean for better performance
  
  if (!profile) {
    return res.status(404).render('error', { 
      message: 'Profile not found',
      error: { status: 404 },
      title: 'Not Found'
    });
  }
  
  // Check if user is the profile owner
  const currentBambiname = getUsernameFromCookies(req);
  const isOwnProfile = currentBambiname === username;
  
  // Track profile views
  if (!isOwnProfile) {
    // Don't await this to prevent slowing down the page load
    Profile.updateOne(
      { _id: profile._id },
      { $inc: { views: 1 } }
    ).catch(err => logger.error(`Failed to update view count: ${err.message}`));
  }
  
  res.render('profile', { 
    title: `${profile.displayName || profile.username}'s Profile`,
    profile,
    username,
    isOwnProfile
  });
}));

// Edit profile page - apply ownership check middleware
router.get('/:username/edit', 
  param('username').trim().escape(),
  ownershipCheck, 
  withDBErrorHandling(async (req, res) => {
    const { username } = req.params;
    const profile = await Profile.findOne({ username }).lean();
    
    if (!profile) {
      return res.status(404).render('error', { 
        message: 'Profile not found',
        error: { status: 404 },
        title: 'Not Found'
      });
    }
    
    res.render('edit', { 
      title: 'Edit Profile',
      profile,
      username
    });
  })
);

// Update profile - with both middleware
router.post('/:username', 
  param('username').trim().escape(),
  ownershipCheck, 
  validateProfileInput, 
  withDBErrorHandling(async (req, res) => {
    const { username } = req.params;
    const { displayName, avatar, headerImage, headerColor, about, description, seasons } = req.body;
    
    // Process seasons
    const selectedSeasons = Array.isArray(seasons) ? seasons : [];
    
    // Use transaction for data consistency
    await withTransaction(async (session) => {
      // Update profile
      const updatedProfile = await Profile.findOneAndUpdate(
        { username },
        {
          displayName: displayName || username,
          avatar,
          headerImage,
          headerColor,
          about,
          description,
          seasons: selectedSeasons,
          updatedAt: new Date()
        },
        { new: true, session }
      );
      
      if (!updatedProfile) {
        return res.status(404).json({ 
          success: false, 
          message: 'Profile not found'
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Profile updated successfully',
        profile: updatedProfile
      });
    });
  })
);

// GET - show confirmation
router.get('/:username/delete', 
  param('username').trim().escape(),
  ownershipCheck, 
  withDBErrorHandling(async (req, res) => {
    const { username } = req.params;
    const profile = await Profile.findOne({ username }).lean();
    
    if (!profile) {
      return res.status(404).render('error', {
        message: 'Profile not found',
        error: { status: 404 },
        title: 'Error - Profile Not Found'
      });
    }
    
    // Show confirmation page
    return res.render('delete-confirmation', {
      profile,
      title: 'Delete Profile'
    });
  })
);

// POST - handle form submission for deletion
router.post('/:username/delete', 
  param('username').trim().escape(),
  ownershipCheck, 
  withDBErrorHandling(async (req, res) => {
    const { username } = req.params;
    
    // Use transaction for data consistency
    await withTransaction(async (session) => {
      // Find and delete the profile
      const deletedProfile = await Profile.findOneAndDelete({ username }, { session });
      
      if (!deletedProfile) {
        return res.status(404).json({
          success: false,
          message: 'Profile not found'
        });
      }
      
      logger.success(`Profile deleted for ${username} via HTTP route`);
      
      // Clear the user cookie
      res.clearCookie('bambiname');
      
      // Also clear session
      if (req.session) {
        req.session.destroy();
      }
      
      // If it's an AJAX request, send JSON response
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.json({
          success: true,
          message: 'Profile deleted successfully',
          redirectUrl: '/'
        });
      }
      
      // For regular form submissions, redirect
      return res.redirect('/');
    });
  })
);

// DELETE - API endpoint for deletion (requires auth middleware)
router.delete('/:username/delete', 
  param('username').trim().escape(),
  auth, 
  withDBErrorHandling(async (req, res) => {
    const { username } = req.params;
    
    // Check if the authenticated user has permission to delete this profile
    if (req.user.username !== username && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to delete this profile' 
      });
    }
    
    // Use transaction for data consistency
    await withTransaction(async (session) => {
      // Find and delete the profile
      const deletedProfile = await Profile.findOneAndDelete({ username }, { session });
      
      if (!deletedProfile) {
        return res.status(404).json({ 
          success: false, 
          message: 'Profile not found' 
        });
      }
      
      logger.success(`Profile deleted for ${username} via API route`);
      
      // Clear the user cookie if it was their own profile
      if (req.user.username === username) {
        res.clearCookie('bambiname');
        
        // Also clear session
        if (req.session) {
          req.session.destroy();
        }
      }
      
      return res.json({ 
        success: true, 
        message: 'Profile deleted successfully',
        redirectUrl: '/'
      });
    });
  })
);

export default router;