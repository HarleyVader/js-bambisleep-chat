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
    
    // Create new bambi profile
    const bambi = await Bambi.create({
      username,
      displayName: displayName || username,
      description
    });
    
    res.status(201).json({
      success: true,
      data: bambi
    });
  } catch (error) {
    logger.error('Error creating bambi profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create bambi profile',
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
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'profiles');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const fileName = `${bambi.username}-${Date.now()}${path.extname(profilePicture.name)}`;
    const filePath = path.join(uploadDir, fileName);
    
    // Move file to upload directory
    await profilePicture.mv(filePath);
    
    // Update profile with new image path
    bambi.profilePicture = `/uploads/profiles/${fileName}`;
    await bambi.save();
    
    res.status(200).json({
      success: true,
      data: {
        profilePicture: bambi.profilePicture
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

export default router;