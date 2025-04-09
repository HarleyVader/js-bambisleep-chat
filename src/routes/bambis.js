import express from 'express';
import eventBus from '../utils/eventBus.js';
import EVENTS from '../config/events.js';

const router = express.Router();

// Basic routes for bambis profiles
router.get('/', (req, res) => {
  res.render('bambis/index', { 
    title: 'Bambi Profiles',
    profiles: [] // Will load actual profiles later
  });
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
    
    // Emit event for state synchronization
    eventBus.emit(EVENTS.PROFILE_UPDATED, { 
      username, 
      profile: profileData 
    });
    
    res.json({ success: true, message: 'Profile update initiated' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
});

export default router;