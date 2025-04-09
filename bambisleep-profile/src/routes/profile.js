const express = require('express');
const router = express.Router();
const Profile = require('../models/Profile');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

// Helper function to get username from cookies
const getUsernameFromCookies = (req) => {
  if (req.cookies && req.cookies.bambiname) {
    return decodeURIComponent(req.cookies.bambiname);
  }
  return null;
};

// Home page - Show all profiles in a card style layout
router.get('/', async (req, res) => {
  try {
    const profiles = await Profile.find().sort({ updatedAt: -1 });
    
    res.render('index', { 
      title: 'BambiSleep Community Profiles',
      profiles,
      validConstantsCount: 5,
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

// Create profile page
router.get('/new', (req, res) => {
  res.render('creation', { 
    title: 'Create New Profile',
    validConstantsCount: 5,
    footer: {
      logo: {
        url: "https://brandynette.xxx/",
        image: "/gif/brandynette.gif",
        alt: "Brandynette.xxx"
      },
      tagline: "Create your bambi profile and join the community"
    }
  });
});

// Create profile submission
router.post('/new', async (req, res) => {
  try {
    const { username, displayName, avatar, about, description, seasons } = req.body;
    
    // Check if username already exists
    const existingProfile = await Profile.findOne({ username });
    if (existingProfile) {
      return res.render('creation', { 
        title: 'Create New Profile',
        error: 'Username already exists',
        validConstantsCount: 5,
        footer: {
          logo: {
            url: "https://brandynette.xxx/",
            image: "/gif/brandynette.gif",
            alt: "Brandynette.xxx"
          },
          tagline: "Create your bambi profile and join the community"
        }
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
      seasons: selectedSeasons.length > 0 ? selectedSeasons : ['spring']
    });
    
    await newProfile.save();
    
    // Set cookie and redirect
    res.cookie('bambiname', username, { path: '/' });
    res.redirect(`/profile/${username}`);
  } catch (error) {
    console.error('Error creating profile:', error);
    res.status(500).render('creation', { 
      title: 'Create New Profile',
      error: 'Failed to create profile. Please try again.',
      validConstantsCount: 5,
      footer: {
        logo: {
          url: "https://brandynette.xxx/",
          image: "/gif/brandynette.gif",
          alt: "Brandynette.xxx"
        },
        tagline: "Create your bambi profile and join the community"
      }
    });
  }
});

// View profile
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const profile = await Profile.findOne({ username });
    
    if (!profile) {
      return res.status(404).render('error', { 
        message: 'Profile not found',
        error: { status: 404 }
      });
    }
    
    // Check if user is the profile owner
    const currentBambiname = getUsernameFromCookies(req);
    const isOwnProfile = currentBambiname === username;
    
    res.render('profile', { 
      title: `${profile.displayName || profile.username}'s Profile`,
      profile,
      username,
      isOwnProfile,
      validConstantsCount: 5,
      footer: {
        logo: {
          url: "https://brandynette.xxx/",
          image: "/gif/brandynette.gif",
          alt: "Brandynette.xxx"
        },
        tagline: "Exploring the bambi community"
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).render('error', { 
      message: 'Error fetching profile',
      error: req.app.get('env') === 'development' ? error : {}
    });
  }
});

// Edit profile page
router.get('/edit/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const currentBambiname = getUsernameFromCookies(req);
    
    // Check if user is authorized
    if (!currentBambiname || currentBambiname !== username) {
      return res.status(403).render('error', { 
        message: 'You are not authorized to edit this profile',
        error: { status: 403 }
      });
    }
    
    const profile = await Profile.findOne({ username });
    
    if (!profile) {
      return res.status(404).render('error', { 
        message: 'Profile not found',
        error: { status: 404 }
      });
    }
    
    res.render('edit', { 
      title: 'Edit Profile',
      profile,
      username,
      validConstantsCount: 5,
      footer: {
        logo: {
          url: "https://brandynette.xxx/",
          image: "/gif/brandynette.gif",
          alt: "Brandynette.xxx"
        },
        tagline: "Edit your bambi profile"
      }
    });
  } catch (error) {
    console.error('Error loading edit page:', error);
    res.status(500).render('error', { 
      message: 'Error loading edit page',
      error: req.app.get('env') === 'development' ? error : {}
    });
  }
});

// Update profile
router.post('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const currentBambiname = getUsernameFromCookies(req);
    
    // Check if user is authorized
    if (!currentBambiname || currentBambiname !== username) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to update this profile'
      });
    }
    
    const { displayName, avatar, headerImage, headerColor, about, description, seasons } = req.body;
    
    // Process seasons
    const selectedSeasons = Array.isArray(seasons) ? seasons : [];
    
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
        updatedAt: Date.now()
      },
      { new: true }
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
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating profile'
    });
  }
});

/**
 * Delete a profile
 * GET /profile/:username/delete - Shows confirmation page
 * POST /profile/:username/delete - Performs the deletion
 */
router.get('/:username/delete', async (req, res) => {
  try {
    const { username } = req.params;
    const profile = await Profile.findOne({ username });
    
    if (!profile) {
      return res.status(404).render('error', {
        message: 'Profile not found',
        error: { status: 404 },
        validConstantsCount: 5,
        title: 'Error - Profile Not Found'
      });
    }
    
    // Check if user has permission (using cookies for now)
    const isOwnProfile = req.cookies.username === username;
    
    if (!isOwnProfile) {
      return res.status(403).render('error', {
        message: 'You do not have permission to delete this profile',
        error: { status: 403 },
        validConstantsCount: 5,
        title: 'Error - Access Denied'
      });
    }
    
    // Show confirmation page
    return res.render('delete-confirmation', {
      profile,
      title: 'Delete Profile',
      validConstantsCount: 5
    });
    
  } catch (err) {
    logger.error(`Error preparing profile deletion: ${err.message}`);
    return res.status(500).render('error', {
      message: 'An error occurred',
      error: { status: 500 },
      validConstantsCount: 5,
      title: 'Error'
    });
  }
});

router.post('/:username/delete', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Check if user has permission (using cookies for now)
    const isOwnProfile = req.cookies.username === username;
    
    if (!isOwnProfile) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this profile'
      });
    }
    
    // Find and delete the profile
    const deletedProfile = await Profile.findOneAndDelete({ username });
    
    if (!deletedProfile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    
    logger.success(`Profile deleted for ${username} via HTTP route`);
    
    // If it's an AJAX request, send JSON response
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({
        success: true,
        message: 'Profile deleted successfully',
        redirectUrl: '/'
      });
    }
    
    // For regular form submissions, redirect
    return res.redirect('/');
    
  } catch (err) {
    logger.error(`Error deleting profile: ${err.message}`);
    
    // Handle AJAX requests
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({
        success: false,
        message: 'An error occurred while deleting the profile'
      });
    }
    
    // Handle regular form requests
    return res.status(500).render('error', {
      message: 'An error occurred while deleting the profile',
      error: { status: 500 },
      validConstantsCount: 5,
      title: 'Error'
    });
  }
});

/**
 * Delete a profile
 * DELETE /profile/:username/delete
 */
router.delete('/:username/delete', auth, async (req, res) => {
  try {
    const { username } = req.params;
    
    // Check if the authenticated user has permission to delete this profile
    if (req.user.username !== username && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to delete this profile' 
      });
    }
    
    // Find and delete the profile
    const deletedProfile = await Profile.findOneAndDelete({ username });
    
    if (!deletedProfile) {
      return res.status(404).json({ 
        success: false, 
        message: 'Profile not found' 
      });
    }
    
    logger.success(`Profile deleted for ${username} via HTTP route`);
    
    // If it's an AJAX request, send JSON response
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({ 
        success: true, 
        message: 'Profile deleted successfully',
        redirectUrl: '/'
      });
    }
    
    // For regular form submissions, redirect
    return res.redirect('/');
    
  } catch (err) {
    logger.error(`Error deleting profile: ${err.message}`);
    
    // Handle AJAX requests
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({ 
        success: false, 
        message: 'An error occurred while deleting the profile' 
      });
    }
    
    // Handle regular form requests
    req.flash('error', 'Failed to delete profile');
    return res.redirect(`/profile/${req.params.username}`);
  }
});

module.exports = router;