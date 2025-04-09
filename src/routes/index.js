import express from 'express';
import Profile from '../models/Bambi.js';

// Create routers
const mainRouter = express.Router();
const profileRouter = express.Router();
const router = express.Router();

// Main home route with cookie authentication
mainRouter.get('/', (req, res) => {
  const data = req.cookies;
  const validConstantsCount = 9;
  
  res.render('index', { 
    title: 'BambiSleep Chat',
    username: data?.bambiname ? data.bambiname : 'Guest',
    validConstantsCount: validConstantsCount
  });
});

// Profile listing route
profileRouter.get('/bambis', async (req, res) => {
  try {
    const profiles = await Profile.find().sort({ updatedAt: -1 });
    res.render('bambis', { 
      title: 'Bambi Profiles',
      profiles
    });
  } catch (error) {
    res.status(500).render('error', { 
      message: 'Error fetching profiles',
      error 
    });
  }
});

// Redirect all bambis routes to the proper profiles routes
router.get('/', (req, res) => {
  res.redirect('/bambis');
});

router.get('/create', (req, res) => {
  res.redirect('/bambi/new');
});

router.get('/:username', (req, res) => {
  res.redirect(`/bambi/${req.params.username}`);
});

// Export combined setup function
export const setRoutes = (app) => {
  // Set up API routes
  setApiRoutes(app);
  
  // Set up view routes
  app.use('/', mainRouter);
  app.use('/bambi', profileRouter);
  
  // Additional routes can be configured here
};

// Also export the routers separately for flexibility
export const routers = {
  mainRouter,
  profileRouter
};

// For backward compatibility with the original structure
export default mainRouter;