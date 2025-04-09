import { setApiRoutes } from './api.js';
import express from 'express';
import Profile from '../models/Bambi.js';

// Create routers
const mainRouter = express.Router();
const profileRouter = express.Router();

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
profileRouter.get('/profiles', async (req, res) => {
  try {
    const profiles = await Profile.find().sort({ updatedAt: -1 });
    res.render('profiles', { 
      title: 'BambiSleep Profiles',
      profiles
    });
  } catch (error) {
    res.status(500).render('error', { 
      message: 'Error fetching profiles',
      error 
    });
  }
});

// Export combined setup function
export const setRoutes = (app) => {
  // Set up API routes
  setApiRoutes(app);
  
  // Set up view routes
  app.use('/', mainRouter);
  app.use('/', profileRouter);
  
  // Additional routes can be configured here
};

// Also export the routers separately for flexibility
export const routers = {
  mainRouter,
  profileRouter
};

// For backward compatibility with the original structure
const router = mainRouter;
export default router;