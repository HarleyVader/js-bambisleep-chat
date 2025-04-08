import express from 'express';
import Bambi from '../models/Bambi.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Logger from '../utils/logger.js';

const router = express.Router();
const logger = new Logger('BambisRouter');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all bambis (with pagination)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    
    const bambis = await Bambi.find()
      .sort({ lastActive: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Bambi.countDocuments();
    
    res.render('bambis', {
      bambis,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    logger.error('Error fetching bambis:', error);
    res.status(500).render('bambis', { error: 'Failed to fetch bambis' });
  }
});

// Get single bambi profile
router.get('/:username', async (req, res) => {
  try {
    const bambi = await Bambi.findOne({ username: req.params.username });
    
    if (!bambi) {
      return res.status(404).render('bambis', { error: 'Bambi not found' });
    }
    
    res.render('bambiProfile', { bambi });
  } catch (error) {
    logger.error('Error fetching bambi profile:', error);
    res.status(500).render('bambis', { error: 'Failed to fetch bambi profile' });
  }
});

// API endpoints for profile management
router.post('/api/profile', async (req, res) => {
  try {
    const { username, displayName, description } = req.body;
    
    // Check if bambi already exists
    const existingBambi = await Bambi.findOne({ username });
    if (existingBambi) {
      return res.status(400).json({ success: false, message: 'Username already taken' });
    }
    
    // Check description length before creating
    if (description && description.length > 500) {
      return res.status(400).json({ 
        success: false, 
        message: 'Description cannot exceed 500 characters' 
      });
    }
    
    // Create new bambi profile
    const bambi = await Bambi.create({
      username,
      displayName: displayName || username,
      description: description || ''
    });
    
    res.status(201).json({
      success: true,
      data: bambi
    });
  } catch (error) {
    logger.error('Error creating bambi profile:', error);
    
    // Improved error handling
    let errorMessage = 'Failed to create bambi profile';
    
    if (error.name === 'ValidationError') {
      // Extract validation error messages
      errorMessage = Object.values(error.errors)
        .map(err => err.message)
        .join(', ');
    }
    
    res.status(400).json({
      success: false,
      message: errorMessage,
      error: error.message
    });
  }
});

// Update bambi profile
router.put('/api/profile/:username', async (req, res) => {
  try {
    const { displayName, description, triggers } = req.body;
    
    const bambi = await Bambi.findOneAndUpdate(
      { username: req.params.username },
      { 
        displayName, 
        description, 
        triggers,
        lastActive: Date.now()
      },
      { new: true, runValidators: true }
    );
    
    if (!bambi) {
      return res.status(404).json({ success: false, message: 'Bambi not found' });
    }
    
    res.status(200).json({
      success: true,
      data: bambi
    });
  } catch (error) {
    logger.error('Error updating bambi profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bambi profile',
      error: error.message
    });
  }
});

// Upload profile picture
router.post('/api/profile/:username/picture', async (req, res) => {
  try {
    if (!req.files || !req.files.profilePicture) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const bambi = await Bambi.findOne({ username: req.params.username });
    if (!bambi) {
      return res.status(404).json({ success: false, message: 'Bambi not found' });
    }
    
    const profilePicture = req.files.profilePicture;
    
    // Convert image to Base64 for database storage
    const imageData = profilePicture.data.toString('base64');
    const imageType = profilePicture.mimetype;
    
    // Update bambi with image data directly in the database
    bambi.profileImageData = imageData;
    bambi.profileImageType = imageType;
    bambi.profileImageName = profilePicture.name;
    
    // Optional: Save original filename or create a unique ID
    bambi.profileImageId = `${bambi.username}-${Date.now()}`;
    
    await bambi.save();
    
    res.status(200).json({
      success: true,
      data: {
        profilePicture: `data:${imageType};base64,${imageData.substring(0, 20)}...` // Preview only
      }
    });
  } catch (error) {
    logger.error('Error uploading profile picture:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile picture',
      error: error.message
    });
  }
});

// Heart a bambi profile
router.post('/api/profile/:username/heart', async (req, res) => {
  try {
    const { hearterUsername } = req.body;
    
    if (!hearterUsername) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }
    
    const bambi = await Bambi.findOne({ username: req.params.username });
    if (!bambi) {
      return res.status(404).json({ success: false, message: 'Bambi not found' });
    }
    
    // Check if this user already hearted the profile
    const alreadyHearted = bambi.hearts.users.some(user => user.username === hearterUsername);
    
    if (alreadyHearted) {
      // Remove heart
      bambi.hearts.users = bambi.hearts.users.filter(user => user.username !== hearterUsername);
      bambi.hearts.count = Math.max(0, bambi.hearts.count - 1);
      await bambi.save();
      
      return res.json({
        success: true,
        hearted: false,
        heartCount: bambi.hearts.count,
        message: 'Heart removed'
      });
    } else {
      // Add heart
      bambi.hearts.users.push({
        username: hearterUsername,
        timestamp: new Date()
      });
      bambi.hearts.count++;
      
      // Add an activity for receiving a heart
      if (bambi.addActivity) {
        await bambi.addActivity('heart', `Received a heart from ${hearterUsername}`);
      }
      
      await bambi.save();
      
      return res.json({
        success: true,
        hearted: true,
        heartCount: bambi.hearts.count,
        message: 'Heart added'
      });
    }
  } catch (error) {
    logger.error('Error handling heart reaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process heart reaction',
      error: error.message
    });
  }
});

// Get heart status for a bambi profile
router.get('/api/profile/:username/heart-status', async (req, res) => {
  try {
    const { currentUser } = req.query;
    
    if (!currentUser) {
      return res.status(400).json({ success: false, message: 'Current user is required' });
    }
    
    const bambi = await Bambi.findOne({ username: req.params.username });
    if (!bambi) {
      return res.status(404).json({ success: false, message: 'Bambi not found' });
    }
    
    const hearted = bambi.hearts.users.some(user => user.username === currentUser);
    
    res.json({
      success: true,
      hearted,
      heartCount: bambi.hearts.count
    });
  } catch (error) {
    logger.error('Error fetching heart status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch heart status',
      error: error.message
    });
  }
});

// Check if username is available
router.get('/api/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ 
        available: false, 
        message: 'Username must be at least 3 characters' 
      });
    }
    
    // Check username format
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ 
        available: false, 
        message: 'Username must contain only letters, numbers, and underscores' 
      });
    }
    
    // Check if username already exists
    const existingBambi = await Bambi.findOne({ username });
    
    res.json({
      available: !existingBambi,
      message: existingBambi ? 'Username is taken' : 'Username is available'
    });
  } catch (error) {
    logger.error('Error checking username availability:', error);
    res.status(500).json({
      available: false,
      message: 'Error checking username'
    });
  }
});

// Example endpoint for activity feed
router.get('/api/profile/:username/feed', async (req, res) => {
  try {
    const bambi = await Bambi.findOne({ username: req.params.username });
    // Fetch activities from followed users
    // ...
  } catch (error) {
    // Error handling
  }
});

export default router;