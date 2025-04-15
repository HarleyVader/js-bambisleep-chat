import express from 'express';
import Profile from '../models/Profile.js';

const router = express.Router();

// Helper function to get username from cookies
const getUsernameFromCookies = (req) => {
  if (req.cookies && req.cookies.bambiname) {
    return decodeURIComponent(req.cookies.bambiname);
  }
  return null;
};

// Home page - Shows profile list and welcome page
router.get('/', async (req, res) => {
  try {
    // Check if user is logged in (has bambiname cookie)
    const bambiname = getUsernameFromCookies(req);
    const validConstantsCount = 5; // This seems to be a consistent value across routes
    
    // Get all profiles for display
    const profiles = await Profile.find().sort({ updatedAt: -1 });
    
    // Render the home page with appropriate data
    res.render('index', { 
      title: 'BambiSleep Community Profiles',
      profiles,
      username: bambiname || 'Guest',
      validConstantsCount,
      footer: {
        logo: {
          url: "https://brandynette.xxx/",
          image: "/gif/brandynette.gif",
          alt: "Brandynette.xxx"
        },
        tagline: "Connect with other Bambis and explore the forest together"
      }
    });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).render('error', { 
      message: 'Error fetching profiles',
      error: req.app.get('env') === 'development' ? error : {}
    });
  }
});

export default router;