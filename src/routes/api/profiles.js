import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { Logger } from '../../utils/logger.js';
import Profile from '../../models/Bambi.js';
import auth from '../../middleware/auth.js';
import { withTransaction } from '../../database/transaction.js';

const router = express.Router();
const logger = new Logger('API:Profiles');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || 
      file.mimetype === 'image/jpg' || 
      file.mimetype === 'image/png' || 
      file.mimetype === 'image/gif') {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, JPG, PNG, GIF) are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter
});

// Helper function to get username from cookies
const getUsernameFromCookies = (req) => {
  if (req.cookies && req.cookies.bambiname) {
    return decodeURIComponent(req.cookies.bambiname);
  }
  return null;
};

// List profiles with pagination and search
router.get('/list', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || 'updatedAt';
    const search = req.query.search || '';
    
    let sortOptions = {};
    switch (sort) {
      case 'hearts':
        sortOptions = { 'hearts': -1 };
        break;
      case 'views':
        sortOptions = { 'views': -1 };
        break;
      case 'username':
        sortOptions = { 'username': 1 };
        break;
      case 'updatedAt':
      default:
        sortOptions = { 'updatedAt': -1 };
    }
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } },
          { about: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    const [profiles, total] = await Promise.all([
      Profile.find(query)
        .select('username displayName avatar about updatedAt views hearts')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      Profile.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      profiles,
      total,
      page,
      pages: Math.ceil(total / limit),
      hasMore: total > (skip + limit)
    });
  } catch (error) {
    logger.error(`Error fetching profiles: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error fetching profiles'
    });
  }
});

// Get single profile
router.get('/profile/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const profile = await Profile.findOne({ username })
      .select('-triggerHistory')
      .lean();
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    
    // Check if this is the profile owner
    const bambiname = getUsernameFromCookies(req);
    const isOwnProfile = bambiname === username;
    
    // Track profile views if not own profile
    if (!isOwnProfile) {
      Profile.updateOne(
        { _id: profile._id },
        { $inc: { views: 1 } }
      ).catch(err => logger.error(`Failed to update view count: ${err.message}`));
    }
    
    res.json({
      success: true,
      profile,
      isOwnProfile
    });
  } catch (error) {
    logger.error(`Error fetching profile: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
  }
});

// Update profile
router.put('/profile/:username', auth, upload.single('avatar'), async (req, res) => {
  try {
    const { username } = req.params;
    const currentBambiname = getUsernameFromCookies(req);
    
    // Check ownership
    if (currentBambiname !== username) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this profile'
      });
    }
    
    const updateData = {
      displayName: req.body.displayName,
      about: req.body.about,
      description: req.body.description,
      updatedAt: new Date()
    };
    
    // Handle avatar upload
    if (req.file) {
      updateData.avatar = `/uploads/avatars/${username}.${req.file.originalname.split('.').pop()}`;
      
      // Save file logic would go here
    }
    
    // Use transaction for data consistency
    const updatedProfile = await withTransaction(async (session) => {
      return Profile.findOneAndUpdate(
        { username },
        { $set: updateData },
        { new: true, session }
      );
    });
    
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

// Delete profile
router.delete('/profile/:username', auth, async (req, res) => {
  try {
    const { username } = req.params;
    const currentBambiname = getUsernameFromCookies(req);
    
    // Check ownership
    if (currentBambiname !== username && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this profile'
      });
    }
    
    // Use transaction for data consistency
    const deletedProfile = await withTransaction(async (session) => {
      return Profile.findOneAndDelete({ username }, { session });
    });
    
    if (!deletedProfile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    
    // Clear cookies if deleting own profile
    if (currentBambiname === username) {
      res.clearCookie('bambiname');
      
      if (req.session) {
        req.session.destroy();
      }
    }
    
    res.json({
      success: true,
      message: 'Profile deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting profile: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error deleting profile'
    });
  }
});

// Handle hearts/likes
router.post('/profile/:username/heart', auth, async (req, res) => {
  try {
    const { username } = req.params;
    const currentBambiname = getUsernameFromCookies(req);
    
    if (!currentBambiname) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Use transaction for data consistency
    const result = await withTransaction(async (session) => {
      const profile = await Profile.findOne({ username }).session(session);
      
      if (!profile) {
        throw new Error('Profile not found');
      }
      
      // Check if already hearted
      const heartIndex = profile.hearts?.findIndex(h => h.username === currentBambiname);
      
      if (heartIndex >= 0) {
        // Remove heart
        profile.hearts.splice(heartIndex, 1);
      } else {
        // Add heart
        if (!profile.hearts) profile.hearts = [];
        profile.hearts.push({
          username: currentBambiname,
          timestamp: new Date()
        });
      }
      
      await profile.save({ session });
      
      return {
        hearted: heartIndex < 0,
        heartCount: profile.hearts?.length || 0
      };
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error(`Error updating heart: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Add to app.js:
// import profileApiRouter from './routes/api/profiles.js';
// app.use('/api/profiles', profileApiRouter);

export default router;