import express from 'express';
import { Bambi } from '../models/Bambi.js';
import logger from '../utils/logger.js';

// Create routers
const mainRouter = express.Router();
const bambiRouter = express.Router();
const authRouter = express.Router();

// Main home route
mainRouter.get('/', (req, res) => {
  const data = req.cookies;
  const validConstantsCount = 9;
  
  res.render('index', { 
    title: 'BambiSleep Chat',
    username: data?.bambiname ? data.bambiname : 'Guest',
    validConstantsCount: validConstantsCount
  });
});

// Bambis listing route
mainRouter.get('/bambis', async (req, res) => {
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
        .select('username displayName avatar about updatedAt views hearts description') 
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
        
      Bambi.countDocuments(query) 
    ]);
    
    const totalPages = Math.ceil(totalBambis / limit);
    
    // Get CSRF token from request if available
    const csrfToken = req.csrfToken ? req.csrfToken() : '';
    
    res.render('bambis/bambis', {
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
      csrfToken
    });
  } catch (error) {
    logger.error(`Error loading bambis: ${error.message}`);
    res.render('bambis/bambis', { 
      title: 'BambiSleep Community',
      error: true,
      errorMessage: 'Failed to load bambis',
      bambis: [],
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  }
});

// Get bambi name from cookies helper
function getBambiNameFromCookies(req) {
  return req.cookies?.bambiname || '';
}

// Individual bambi view
bambiRouter.get('/:username', async (req, res) => {
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
    
    // Get current user from cookie
    const currentBambiname = getBambiNameFromCookies(req);
    const isOwnbambi = username === currentBambiname;
    
    // Get CSRF token from request if available
    const csrfToken = req.csrfToken ? req.csrfToken() : '';
    
    res.render('bambis/bambi', { 
      title: `${bambi.displayName || bambi.username}'s Profile`,
      bambi: sanitizedBambi,
      isOwnbambi,
      csrfToken,
      user: { email: '' } // Provide default user object
    });
  } catch (error) {
    console.error('Error fetching bambi:', error);
    res.status(500).render('error', { 
      message: 'Error fetching bambi profile',
      error 
    });
  }
});

// Help route
mainRouter.get('/help', (req, res) => {
  const bambiname = req.cookies.bambiname || '';
  res.render('help', { 
    title: 'BambiSleep.Chat Help',
    bambiname,
    validConstantsCount: 5
  });
});

// Scrapers route
mainRouter.get('/scrapers', (req, res) => {
  try {
    // Add a null check before accessing req.user.bambiname
    if (req.user && req.user.bambiname === 'admin') {
      // Admin code here...
      // Return your admin page with necessary data
      res.render('scrapers', {
        bambiname: req.user.bambiname,
        stats: {
          successful: 0,
          failed: 0,
          blocked: 0,
          totalUpvotes: 0,
          totalDownvotes: 0,
          topUpvoted: [],
          topDownvoted: []
        },
        textSubmissions: [],
        imageSubmissions: [],
        videoSubmissions: []
      });
    } else {
      // Not admin or not logged in
      return res.status(401).render('error', {
        message: 'You must be logged in as admin to view this page',
        error: {
          status: 401,
          stack: process.env.NODE_ENV === 'development' ? new Error().stack : ''
        }
      });
    }
  } catch (err) {
    console.error('Error in scrapers route:', err);
    return res.status(500).render('error', {
      message: 'An internal server error occurred',
      error: {
        status: 500,
        stack: process.env.NODE_ENV === 'development' ? err.stack : ''
      }
    });
  }
});

// Psychodelic Trigger Mania route
mainRouter.get('/psychodelic-trigger-mania', (req, res) => {
  const bambiname = req.cookies.bambiname || '';
  res.render('psychodelic-trigger-mania', { 
    title: 'Psychodelic Trigger Mania',
    bambiname,
    validConstantsCount: 5,
    bambi: { username: bambiname }
  });
});

// Add this route to handle authentication status checks
authRouter.get('/api/auth/status', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.json({ 
      authenticated: true,
      user: {
        id: req.user.id,
        username: req.user.username
        // Add other user properties as needed, but be careful with sensitive data
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Add this function to set up the routes in the app
export function setRoutes(app) {
  app.use('/', mainRouter);
  app.use('/bambis', bambiRouter);
  app.use('/auth', authRouter);
}

// Export the routers for modular use
export { mainRouter, bambiRouter, authRouter };

// Default export for compatibility
export default {
  mainRouter,
  bambiRouter,
  authRouter,
  setRoutes
};