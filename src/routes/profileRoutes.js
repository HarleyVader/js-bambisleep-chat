const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Add this function where appropriate
const getProfileFromRequest = async (req) => {
  try {
    // Get bambiname from cookie or fallback to 'anon' prefix
    const bambiname = req.cookies.bambiname || `anon${Math.floor(Math.random() * 10000)}`;
    
    // Use the static method we just created
    const Profile = mongoose.model('Profile');
    return await Profile.findOrCreateByUsername(bambiname);
  } catch (error) {
    console.error('Error getting profile from request:', error);
    throw error;
  }
};

// Then modify your route handlers to use this function
router.get('/profile/:username', async (req, res) => {
  try {
    const Profile = mongoose.model('Profile');
    const profile = await Profile.findOrCreateByUsername(req.params.username);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Also update any route that needs the current user's profile
router.get('/my-profile', async (req, res) => {
  try {
    const profile = await getProfileFromRequest(req);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;