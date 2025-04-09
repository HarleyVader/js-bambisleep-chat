import express from 'express';

const router = express.Router();

// Basic routes for bambis profiles
router.get('/', (req, res) => {
  res.render('bambis/index', { 
    title: 'Bambi Profiles',
    profiles: [] // Will load actual profiles later
  });
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
router.get('/:username', (req, res) => {
  const { username } = req.params;
  
  // For now, render a placeholder page
  res.render('bambis/profile', { 
    title: `${username}'s Profile`,
    username,
    profile: {}
  });
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

export default router;