import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { Logger } from '../utils/logger.js';
import { validationResult, body, param } from 'express-validator';
import dbConnection from '../database/dbConnection.js';
import { withDatabaseTimeout } from '../database/databaseErrorHandler.js';
import { withTransaction } from '../database/transaction.js';
import { Bambi } from '../models/Bambi.js';  // Named import
import auth from '../middleware/auth.js';

const logger = new Logger('BambiRoutes');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  // Updated to allow jpeg, jpg, png, and gif
  if (file.mimetype === 'image/jpeg' || 
      file.mimetype === 'image/jpg' || 
      file.mimetype === 'image/png' || 
      file.mimetype === 'image/gif') {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, JPG, PNG, GIF) are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter
});

// Helper to get the bambiname from cookies - consolidated from both files
function getBambiNameFromCookies(req) {
  if (req.cookies && req.cookies.bambiname) {
    return decodeURIComponent(req.cookies.bambiname);
  }
  return null;
}

// Input validation middleware from bambis.js
const validateBambiInput = [
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

// Create a middleware to check if user owns the bambi
const ownershipCheck = (req, res, next) => {
  const { username } = req.params;
  const currentBambiname = getBambiNameFromCookies(req);
  
  if (!currentBambiname || currentBambiname !== username) {
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to modify this bambi' 
      });
    }
    return res.status(403).render('error', { 
      message: 'You are not authorized to modify this bambi',
      error: { status: 403 },
      title: 'Authorization Error',
      validConstantsCount: 5
    });
  }
  
  next();
};

// Ensure database connection before operations
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

// Database operations with error handling
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

// Helper function to render bambi cards into HTML strings
function renderBambiCardToString(req, res, bambi) {
  try {
    // Add userHasLiked property for consistent template usage
    const currentBambiname = getBambiNameFromCookies(req);
    bambi.userHasLiked = bambi.hearts?.users?.some(user => 
      user.username === currentBambiname) || false;
    
    // Use the res.render method with a callback to get the HTML string
    return new Promise((resolve, reject) => {
      res.render('../views/partials/bambi-card', { bambi }, (err, html) => {
        if (err) reject(err);
        else resolve(html);
      });
    });
  } catch (error) {
    logger.error('Error rendering bambi card:', error);
    return Promise.resolve(''); // Return empty string on error
  }
}

// Apply database error handling and consistent response formatting to all routes
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

// Middleware to check if BambiName is set
const checkBambiNameSet = (req, res, next) => {
  const bambiName = getBambiNameFromCookies(req);
  
  if (!bambiName) {
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({ 
        success: false, 
        message: 'You must set a BambiName in order to access this feature.' 
      });
    }
    return res.status(403).render('error', {
      message: 'You are not authorized to modify this bambi',
      error: { 
        status: 403, 
        details: 'You must set a BambiName in order to access this feature. Return to the home page and set your BambiName by clicking the "Set BambiName" button.' 
      },
      title: 'Authorization Error',
      validConstantsCount: 5
    });
  }
  
  next();
};

// Main bambis page route - Lists all bambis
router.get('/', withDBErrorHandling(async (req, res) => {
  try {
    // Check for success message in query parameters
    const successMessage = req.query.success || null;
    const search = req.query.search || '';
    const sort = req.query.sort || 'updatedAt';
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Create query based on search
    let query = {};
    if (search) {
      query = {
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } },
          { about: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    // Create sort options based on sort parameter
    let sortOptions = {};
    switch (sort) {
      case 'hearts':
        sortOptions = { 'hearts.count': -1 };
        break;
      case 'views':
        sortOptions = { 'views': -1 };
        break;
      case 'username':
        sortOptions = { 'username': 1 };
        break;
      case 'updatedAt':
      default:
        sortOptions = { 'updatedAt': -1 };
    }
    
    // Use Promise.all to run queries in parallel
    const [bambis, totalBambis] = await Promise.all([
      Bambi.find(query)
        .select('username displayName avatar about updatedAt views hearts') 
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
        
      Bambi.countDocuments(query) 
    ]);
    
    const totalPages = Math.ceil(totalBambis / limit);
    
    // Changed from 'bambis/bambi' to 'bambis'
    res.render('bambis', {
      title: 'BambiSleep Community',
      bambis,
      search,
      sort,
      pagination: {
        current: page,
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      success: successMessage,
      validConstantsCount: 5
    });
  } catch (error) {
    logger.error(`Error loading bambis: ${error.message}`);
    // Changed from 'bambis/bambi' to 'bambis'
    res.render('bambis', { 
      title: 'BambiSleep Community',
      error: true,
      errorMessage: 'Failed to load bambis',
      bambis: []
    });
  }
}));

router.get('/create', (req, res) => {
  res.render('bambis/creation', { 
    bambiname: req.cookies?.bambiname || req.session?.bambiname || '' 
  });
});

// Create bambi submission endpoint - consistent with API pattern
router.post('/', checkBambiNameSet, validateBambiInput, withDBErrorHandling(async (req, res) => {
  const { username, displayName, avatar, about, description, seasons } = req.body;
  
  try {
    // Use transaction for consistent data
    await withTransaction(async (session) => {
      // Check if username already exists
      const existingBambi = await Bambi.findOne({ username }).session(session);
      if (existingBambi) {
        return res.render('bambis/creation', { 
          title: 'Create New Bambi Profile',
          error: 'Username already exists',
          validConstantsCount: 5,
          formData: req.body
        });
      }
      
      // Process seasons
      const selectedSeasons = Array.isArray(seasons) ? seasons : [seasons].filter(Boolean);
      
      // Create new bambi
      const newBambi = new Bambi({
        username,
        displayName: displayName || username,
        avatar: avatar || '/gif/default-avatar.gif',
        about: about || 'Tell us about yourself...',
        description: description || 'Share your bambi journey...',
        seasons: selectedSeasons.length > 0 ? selectedSeasons : ['spring'],
        followers: [],
        following: [],
        hearts: { count: 0, users: [] },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await newBambi.save({ session });
      
      // Set cookie with security options
      res.cookie('bambiname', username, { 
        path: '/',
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: 'strict'
      });
      
      // Set session too for better auth
      if (req.session) {
        req.session.user = {
          bambiname: username,
          bambiId: newBambi._id
        };
      }
      
      // Redirect to the user bambi with a success message
      return res.redirect(`/bambis/${username}?success=Bambi+created+successfully`);
    });
  } catch (error) {
    logger.error(`Error creating bambi: ${error.message}`);
    res.render('bambis/creation', { 
      error: true, 
      errorMessage: 'Error creating bambi',
      formData: req.body,
      validConstantsCount: 5
    });
  }
}));

// Individual bambi profile view
router.get('/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const bambi = await Bambi.findOne({ username: username });
    
    if (!bambi) {
      return res.status(404).render('error', { 
        message: 'Bambi not found',
        error: { status: 404, stack: '' } 
      });
    }
    
    // Ensure bambi has all required fields before rendering
    const sanitizedBambi = {
      ...bambi.toObject(),
      about: bambi.about || '',
      // Add other fields that might be undefined with defaults
    };
    
    // This is correct - keep using 'bambis/bambi' for individual profiles
    res.render('bambis/bambi', { 
      title: `Bambi Profile - ${bambi.username}`,
      bambi: sanitizedBambi,
      isOwnbambi: username === getBambiNameFromCookies(req)
    });
  } catch (error) {
    console.error('Error fetching bambi:', error);
    res.status(500).render('error', { 
      message: 'Error fetching bambi profile',
      error 
    });
  }
});

// Edit bambi profile form
router.get('/:username/edit', 
  param('username').trim().escape(),
  ownershipCheck, 
  withDBErrorHandling(async (req, res) => {
    const { username } = req.params;
    const bambi = await Bambi.findOne({ username }).lean();
    
    if (!bambi) {
      return res.status(404).render('error', { 
        message: 'Bambi not found',
        error: { status: 404 },
        title: 'Not Found'
      });
    }
    
    res.render('bambis/edit', { 
      title: 'Edit Bambi Profile',
      bambi,
      username
    });
  })
);

// Update bambi profile - standardized path naming
router.post('/:username/update', 
  param('username').trim().escape(),
  ownershipCheck, 
  validateBambiInput, 
  withDBErrorHandling(async (req, res) => {
    const { username } = req.params;
    const { displayName, avatar, headerImage, headerColor, about, description, seasons } = req.body;
    
    // Process seasons
    const selectedSeasons = Array.isArray(seasons) ? seasons : [];
    
    // Use transaction for data consistency
    await withTransaction(async (session) => {
      // Update bambi
      const updatedBambi = await Bambi.findOneAndUpdate(
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
      
      if (!updatedBambi) {
        return res.status(404).json({ 
          success: false, 
          message: 'Bambi not found'
        });
      }
      
      // If it's an AJAX request, send JSON response
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.json({ 
          success: true, 
          message: 'Bambi updated successfully',
          bambi: updatedBambi
        });
      }
      
      // For regular form submissions, redirect to profile page
      return res.redirect(`/bambis/${username}?success=Profile+updated+successfully`);
    });
  })
);

// Delete bambi profile
router.post('/:username/delete', 
  param('username').trim().escape(),
  ownershipCheck, 
  withDBErrorHandling(async (req, res) => {
    const { username } = req.params;
    
    // Use transaction for data consistency
    await withTransaction(async (session) => {
      // Find and delete the bambi
      const deletedBambi = await Bambi.findOneAndDelete({ username }, { session });
      
      if (!deletedBambi) {
        return res.status(404).json({
          success: false,
          message: 'Bambi not found'
        });
      }
      
      logger.info(`Bambi deleted for ${username} via HTTP route`);
      
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
          message: 'Bambi deleted successfully',
          redirectUrl: '/'
        });
      }
      
      // For regular form submissions, redirect
      return res.redirect('/');
    });
  })
);

// Avatar route - serve bambi pictures
router.get('/:username/avatar', async (req, res) => {
  try {
    const bambi = await Bambi.findOne({ username: req.params.username });
    if (!bambi || !bambi.bambiPicture) {
      return res.redirect('/gif/default-avatar.gif');
    }
    
    res.set('Content-Type', bambi.bambiPicture.contentType);
    res.send(bambi.bambiPicture.buffer);
  } catch (error) {
    logger.error('Error serving avatar:', error.message);
    res.redirect('/gif/default-avatar.gif');
  }
});

// API route for hearts
router.post('/api/heart/:username', async (req, res) => {
  try {
    const targetUsername = req.params.username;
    const currentBambiname = getBambiNameFromCookies(req);
    
    if (!currentBambiname) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    const bambi = await Bambi.findOne({ username: targetUsername });
    if (!bambi) {
      return res.status(404).json({ success: false, message: 'Bambi not found' });
    }
    
    // Initialize hearts if it doesn't exist
    if (!bambi.hearts) {
      bambi.hearts = { count: 0, users: [] };
    }
    
    // Check if already hearted
    const alreadyHearted = bambi.hearts.users.some(user => user.username === currentBambiname);
    
    if (alreadyHearted) {
      // Remove heart
      bambi.hearts.users = bambi.hearts.users.filter(user => user.username !== currentBambiname);
      bambi.hearts.count = Math.max(0, bambi.hearts.count - 1);
    } else {
      // Add heart
      bambi.hearts.users.push({
        username: currentBambiname,
        timestamp: Date.now()
      });
      bambi.hearts.count += 1;
    }
    
    await bambi.save();
    
    res.json({
      success: true,
      hearted: !alreadyHearted,
      heartCount: bambi.hearts.count
    });
  } catch (error) {
    logger.error('Error hearting bambi:', error.message);
    res.status(500).json({ success: false, message: 'Error processing request' });
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
    
    // Find both Bambi bambis
    const [currentBambi, targetBambi] = await Promise.all([
      Bambi.findOne({ username: currentBambiname }),
      Bambi.findOne({ username })
    ]);
    
    if (!currentBambi || !targetBambi) {
      return res.status(404).json({ success: false, message: 'Bambi bambi not found' });
    }
    
    // Initialize arrays if they don't exist
    if (!currentBambi.following) currentBambi.following = [];
    if (!targetBambi.followers) targetBambi.followers = [];
    
    // Check if already following
    const isFollowing = currentBambi.following.includes(username);
    
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
      
      // Add activity for the target Bambi if the method exists
      if (typeof targetBambi.addActivity === 'function') {
        await targetBambi.addActivity('other', `Got a new follower: ${currentBambi.displayName || currentBambiname}`);
      }
      
      // Award experience to both users if the method exists
      if (typeof targetBambi.addExperience === 'function' && 
          typeof currentBambi.addExperience === 'function') {
        await Promise.all([
          targetBambi.addExperience(2),  // Small XP for being followed
          currentBambi.addExperience(1)  // Even smaller XP for following someone
        ]);
      }
      
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
    
    // Find the Bambi bambi
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi) {
      return res.status(404).json({ success: false, message: 'Bambi bambi not found' });
    }
    
    if (type === 'followers') {
      // Get followers details
      const followers = await Bambi.find({ username: { $in: bambi.followers || [] } })
        .select('username displayName bambiTheme lastActive');
      
      return res.json({
        success: true,
        connections: followers
      });
    } else if (type === 'following') {
      // Get following details
      const following = await Bambi.find({ username: { $in: bambi.following || [] } })
        .select('username displayName bambiTheme lastActive');
      
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

// Add this route to check if a bambi exists
router.get('/api/check-bambi/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const bambi = await Bambi.findOne({ username });
    
    res.json({
      exists: !!bambi
    });
  } catch (error) {
    logger.error('Error checking bambi existence:', error.message);
    res.status(500).json({ 
      error: 'Server error',
      exists: false
    });
  }
});

// Modify the API list route to use this function
router.get('/api/list', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || 'active';
    const search = req.query.search || '';
    
    let sortOptions = {};
    switch (sort) {
      case 'hearts':
        sortOptions = { 'hearts.count': -1 };
        break;
      case 'followers':
        sortOptions = { 'followers.length': -1 };
        break;
      case 'level':
        sortOptions = { level: -1 };
        break;
      case 'active':
      default:
        sortOptions = { lastActive: -1 };
    }
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    const [bambis, total] = await Promise.all([
      Bambi.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
      Bambi.countDocuments(query)
    ]);
    
    // If the request wants HTML (for server-side rendering)
    if (req.query.format === 'html') {
      // Render each bambi using the partial
      const renderedCards = await Promise.all(
        bambis.map(bambi => renderBambiCardToString(req, res, bambi))
      );
      
      res.json({
        success: true,
        bambis: renderedCards,
        total,
        page,
        hasMore: total > (skip + limit)
      });
    } else {
      // Standard JSON response for client-side rendering
      res.json({
        success: true,
        bambis: bambis,
        total,
        page,
        hasMore: total > (skip + limit)
      });
    }
  } catch (error) {
    logger.error('Error fetching bambis list:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bambis'
    });
  }
});

// Middleware to ensure user is authenticated
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Ensure compatibility with the old bambi routes
router.get('/bambi', ensureAuthenticated, (req, res) => {
  const username = req.user?.username || getBambiNameFromCookies(req);
  
  if (username) {
    return res.redirect(`/bambis/${username}`);
  }
  
  res.redirect('/bambis/new');
});

// Add a route for registration
router.get('/register', (req, res) => {
  const template = req.query.template;
  const redirect = req.query.redirect || '/';
  
  // Get the bambiname from cookies if available
  const bambiname = req.cookies.bambiname || '';
  
  if (template === 'bambi') {
      // Use the bambi template
      res.render('register', {
          bambiTemplate: true,
          bambiname: bambiname,
          redirect: redirect
      });
  } else {
      // Use the default registration template
      res.render('register', {
          bambiTemplate: false,
          redirect: redirect
      });
  }
});

// Add this route to handle setting BambiName (if not already present)
router.post('/api/bambis/set-bambiname', (req, res) => {
  const { bambiname } = req.body;
  
  if (!bambiname || bambiname.trim().length < 3) {
    return res.status(400).json({
      success: false,
      message: 'BambiName must be at least 3 characters long'
    });
  }
  
  // Set cookie with security options
  res.cookie('bambiname', bambiname, { 
    path: '/',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'strict'
  });
  
  // Set session too for better auth
  if (req.session) {
    req.session.user = {
      bambiname: bambiname
    };
  }
  
  return res.json({
    success: true,
    message: 'BambiName set successfully',
    bambiname: bambiname
  });
});

export default router;