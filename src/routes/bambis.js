import express from 'express';
import Profile from '../models/Bambi.js';

const router = express.Router();

// Basic routes for bambis profiles
router.get('/', async (req, res) => {
  try {
    const profiles = await Profile.find().lean();
    res.render('bambis/index', { 
      title: 'Bambi Profiles',
      profiles
    });
  } catch (error) {
    console.error('Error loading profiles:', error);
    res.render('bambis/index', { 
      title: 'Bambi Profiles',
      error: true,
      errorMessage: 'Failed to load profiles',
      profiles: []
    });
  }
});

// Make sure specific routes come BEFORE parameter routes
router.get('/create', (req, res) => {
  res.render('bambis/creation');
});

// Handle profile creation form submission
router.post('/create', async (req, res) => {
  try {
    const { displayName, about } = req.body;
    
    // For now, log the submission data
    console.log('Profile creation requested:', { displayName, about });
    
    // Will implement actual database creation later
    // For now, redirect back to the bambis index page with a success message
    res.redirect('/bambis?success=Profile+created+successfully');
    
    // Later you'll want to implement:
    // 1. Validation of the form data
    // 2. Saving to your database
    // 3. Handling file uploads for the avatar
    // 4. Redirect to the new profile page
  } catch (error) {
    console.error('Error creating profile:', error);
    res.render('bambis/creation', { 
      error: true, 
      errorMessage: 'Error creating profile',
      // Include form data to preserve user input
      formData: req.body
    });
  }
});

// Get profile by username
router.get('/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const profile = await Profile.findOne({ username }).lean();
    if (!profile) {
      return res.status(404).render('error', {
        message: 'Profile not found',
        error: { status: 404 }
      });
    }

    // Get cookie for current user to check if viewing own profile
    const bambiname = req.cookies.bambiname ? decodeURIComponent(req.cookies.bambiname) : null;
    const isOwnProfile = bambiname === username;

    res.render('bambis/profile', { 
      title: `${profile.displayName || profile.username}'s Profile`,
      profile,
      isOwnProfile
    });
  } catch (error) {
    console.error('Error loading profile:', error);
    res.status(500).render('error', {
      message: 'Error loading profile',
      error: { status: 500 }
    });
  }
});

// This will be expanded with actual profile management 
router.post('/update-profile', async (req, res) => {
  try {
    const { username, profileData } = req.body;
    
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }
    
    // Will implement actual database updates later
    console.log(`Profile update requested for ${username}`);
    
    res.json({ success: true, message: 'Profile update initiated' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
});

router.get('/bambis', (req, res) => {
  // Check if there's a success query parameter
  if (req.query.success && req.query.success.includes('Profile created')) {
    // Redirect to the user's profile page
    // Assuming you have the user in the session after registration
    return res.redirect('/profile');
  }
  
  // If no success parameter or not related to profile creation,
  // render the normal bambis page
  res.render('bambis');
});

export default router;