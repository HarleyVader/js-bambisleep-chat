import express from 'express';
import { getProfile } from '../models/Profile.js';
import auth from '../middleware/auth.js';
import Logger from '../utils/logger.js';
import * as triggerController from '../controllers/trigger.js';
// Add the missing import for footerConfig
import footerConfig from '../config/footer.config.js';

const logger = new Logger('ProfileRoutes');
const router = express.Router();

// Define the base path for this router
export const basePath = '/profile';

// Helper function to get username from cookies
const getUsernameFromCookies = (req) => {
  if (req.cookies && req.cookies.bambiname) {
    return decodeURIComponent(req.cookies.bambiname);
  }
  return null;
};

// Profile listing page
router.get('/', async (req, res) => {
  try {
    const Profile = getProfile();
    
    // Get all profiles, sorted by last activity
    const profiles = await Profile.find()
      .sort({ lastActive: -1 })
      .limit(50);
    
    const bambiname = req.cookies?.bambiname ? decodeURIComponent(req.cookies.bambiname) : 'Anonymous';
    
    res.render('profile', { 
      title: 'Bambi Community',
      mode: 'list',
      profiles,
      bambiname,
      validConstantsCount: 5,
      footer: footerConfig
    });
  } catch (error) {
    logger.error(`Error fetching profiles: ${error.message}`);
    res.status(500).render('error', { 
      message: 'Error fetching profiles',
      error: req.app.get('env') === 'development' ? error : {},
      validConstantsCount: 5,
      title: 'Error'
    });
  }
});

// Create profile page
router.get('/new', (req, res) => {
  res.render('profile', { 
    title: 'Create New Profile',
    mode: 'create',
    profile: null,
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
    const Profile = getProfile();
    const { username, displayName, avatar, about, description, seasons } = req.body;
    
    // Check if username already exists
    const existingProfile = await Profile.findOne({ username });
    if (existingProfile) {
      return res.render('profile', { 
        title: 'Create New Profile',
        mode: 'create',
        error: 'Username already exists',
        formData: req.body,
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
    logger.error(`Error creating profile: ${error.message}`);
    res.status(500).render('profile', { 
      title: 'Create New Profile',
      mode: 'create',
      error: 'Failed to create profile. Please try again.',
      formData: req.body,
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
    const Profile = getProfile(); // Get the model when needed
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
      mode: 'view',
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
    logger.error(`Error fetching profile: ${error.message}`);
    res.status(500).render('error', { 
      message: 'Error fetching profile',
      error: req.app.get('env') === 'development' ? error : {}
    });
  }
});

// Edit profile - Now handled by profile page with mode=edit
router.get('/edit/:username', async (req, res) => {
  try {
    const Profile = getProfile(); // Get the model when needed
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
    
    res.render('profile', { 
      title: 'Edit Profile',
      mode: 'edit',
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
    logger.error(`Error loading edit page: ${error.message}`);
    res.status(500).render('error', { 
      message: 'Error loading edit page',
      error: req.app.get('env') === 'development' ? error : {}
    });
  }
});

// Update profile
router.post('/:username', async (req, res) => {
  try {
    const Profile = getProfile(); // Get the model when needed
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
    logger.error(`Error updating profile: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating profile'
    });
  }
});

// Delete confirmation page - Now uses profile.ejs with mode=delete
router.get('/:username/delete', async (req, res) => {
  try {
    const Profile = getProfile(); // Get the model when needed
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
    const currentBambiname = getUsernameFromCookies(req);
    const isOwnProfile = currentBambiname === username;
    
    if (!isOwnProfile) {
      return res.status(403).render('error', {
        message: 'You do not have permission to delete this profile',
        error: { status: 403 },
        validConstantsCount: 5,
        title: 'Error - Access Denied'
      });
    }
    
    // Show confirmation page
    return res.render('profile', {
      mode: 'delete',
      profile,
      title: 'Delete Profile',
      validConstantsCount: 5,
      footer: {
        logo: {
          url: "https://brandynette.xxx/",
          image: "/gif/brandynette.gif",
          alt: "Brandynette.xxx"
        },
        tagline: "Confirm profile deletion"
      }
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

// Delete profile (POST)
router.post('/:username/delete', async (req, res) => {
  try {
    const Profile = getProfile(); // Get the model when needed
    const { username } = req.params;
    
    // Check if user has permission (using cookies for now)
    const currentBambiname = getUsernameFromCookies(req);
    const isOwnProfile = currentBambiname === username;
    
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
    
    // Clear the cookie
    res.clearCookie('bambiname', { path: '/' });
    
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

// Delete profile (DELETE) - API route for programmatic deletion
router.delete('/:username/delete', auth, async (req, res) => {
  try {
    const Profile = getProfile(); // Get the model when needed
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
    
    return res.json({ 
      success: true, 
      message: 'Profile deleted successfully',
      redirectUrl: '/'
    });
    
  } catch (err) {
    logger.error(`Error deleting profile: ${err.message}`);
    
    return res.status(500).json({ 
      success: false, 
      message: 'An error occurred while deleting the profile' 
    });
  }
});

// System Controls API route for HTTP updates
router.post('/:username/system-controls', async (req, res) => {
  try {
    const Profile = getProfile();
    const { username } = req.params;
    const currentBambiname = getUsernameFromCookies(req);
    
    // Check if user is authorized
    if (!currentBambiname || currentBambiname !== username) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to update these controls'
      });
    }
    
    // Find the profile
    const profile = await Profile.findOne({ username });
    
    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        message: 'Profile not found'
      });
    }
    
    // Update the system controls
    profile.updateSystemControls(req.body);
    await profile.save();
    
    // Return success
    res.json({ 
      success: true, 
      message: 'System controls updated successfully',
      systemControls: profile.systemControls
    });
  } catch (error) {
    logger.error(`Error updating system controls: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating system controls'
    });
  }
});

// Trigger API routes
router.get('/triggers/standard', triggerController.getAllTriggers);
router.get('/:username/triggers', auth, triggerController.getProfileTriggers);
router.post('/:username/triggers', auth, triggerController.addTrigger);
router.put('/:username/triggers/:triggerName', auth, triggerController.toggleTrigger);
router.put('/:username/triggers', auth, triggerController.toggleAllTriggers);
router.get('/:username/triggers/history', auth, triggerController.getTriggerHistory);
router.post('/:username/triggers/event', auth, triggerController.processTriggerEvent);

export default router;