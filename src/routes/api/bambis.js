import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { Logger } from '../../utils/logger.js';
import { Bambi } from '../../models/Bambi.js';  // Fixed path with double ../
import auth from '../../middleware/auth.js';
import { withTransaction } from '../../database/transaction.js';

const router = express.Router();
const logger = new Logger('API:Bambis');

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

// List bambis with pagination and search
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

    const [bambis, total] = await Promise.all([
      Bambi.find(query)
        .select('username displayName avatar about updatedAt views hearts')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      Bambi.countDocuments(query)
    ]);

    res.json({
      success: true,
      bambis,
      total,
      page,
      pages: Math.ceil(total / limit),
      hasMore: total > (skip + limit)
    });
  } catch (error) {
    logger.error(`Error fetching bambis: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error fetching bambis'
    });
  }
});

// Get single bambi
router.get('/bambi/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const bambi = await Bambi.findOne({ username })
      .select('-triggerHistory')
      .lean();

    if (!bambi) {
      return res.status(404).json({
        success: false,
        message: 'Bambi not found'
      });
    }

    // Check if this is the bambi owner
    const bambiname = getUsernameFromCookies(req);
    const isOwnBambi = bambiname === username;

    // Track bambi views if not own bambi
    if (!isOwnBambi) {
      Bambi.updateOne(
        { _id: bambi._id },
        { $inc: { views: 1 } }
      ).catch(err => logger.error(`Failed to update view count: ${err.message}`));
    }

    res.json({
      success: true,
      bambi,
      isOwnBambi
    });
  } catch (error) {
    logger.error(`Error fetching bambi: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error fetching bambi'
    });
  }
});

// Update bambi
router.put('/bambi/:username', auth, upload.single('avatar'), async (req, res) => {
  try {
    const { username } = req.params;
    const currentBambiname = getUsernameFromCookies(req);

    // Check ownership
    if (currentBambiname !== username) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this bambi'
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
    const updatedBambi = await withTransaction(async (session) => {
      return Bambi.findOneAndUpdate(
        { username },
        { $set: updateData },
        { new: true, session }
      );
    });

    if (!updatedBambi) {
      return res.status(404).json({
        success: false,
        message: 'Bambi not found'
      });
    }

    res.json({
      success: true,
      message: 'Bambi updated successfully',
      bambi: updatedBambi
    });
  } catch (error) {
    logger.error(`Error updating bambi: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error updating bambi'
    });
  }
});

// Delete bambi
router.delete('/bambi/:username', auth, async (req, res) => {
  try {
    const { username } = req.params;
    const currentBambiname = getUsernameFromCookies(req);

    // Check ownership
    if (currentBambiname !== username && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this bambi'
      });
    }

    // Use transaction for data consistency
    const deletedBambi = await withTransaction(async (session) => {
      return Bambi.findOneAndDelete({ username }, { session });
    });

    if (!deletedBambi) {
      return res.status(404).json({
        success: false,
        message: 'Bambi not found'
      });
    }

    // Clear cookies if deleting own bambi
    if (currentBambiname === username) {
      res.clearCookie('bambiname');

      if (req.session) {
        req.session.destroy();
      }
    }

    res.json({
      success: true,
      message: 'Bambi deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting bambi: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error deleting bambi'
    });
  }
});

// Handle hearts/likes
router.post('/bambi/:username/heart', auth, async (req, res) => {
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
      const bambi = await Bambi.findOne({ username }).session(session);

      if (!bambi) {
        throw new Error('Bambi not found');
      }

      // Check if already hearted
      const heartIndex = bambi.hearts?.findIndex(h => h.username === currentBambiname);

      if (heartIndex >= 0) {
        // Remove heart
        bambi.hearts.splice(heartIndex, 1);
      } else {
        // Add heart
        if (!bambi.hearts) bambi.hearts = [];
        bambi.hearts.push({
          username: currentBambiname,
          timestamp: new Date()
        });
      }

      await bambi.save({ session });

      return {
        hearted: heartIndex < 0,
        heartCount: bambi.hearts?.length || 0
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

// Keep this as-is since the client expects this exact endpoint:
router.post('/set-bambiname', (req, res) => {
  const { bambiname } = req.body;
  
  if (!bambiname || bambiname.trim().length < 3) {
    return res.status(400).json({
      success: false,
      message: 'BambiName must be at least 3 characters long'
    });
  }
  
  // Set cookie with security options
  res.cookie('bambiname', bambiname, { 
    path: '/',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'strict'
  });
  
  // Set session too for better auth
  if (req.session) {
    req.session.user = {
      bambiname: bambiname
    };
  }
  
  // Create bambi if doesn't exist
  Bambi.findOne({ username: bambiname })
    .then(existingBambi => {
      if (!existingBambi) {
        // Create new bambi with standard triggers
        const newBambi = new Bambi({
          username: bambiname,
          triggers: [
            {
              name: "BAMBI SLEEP",
              description: "The foundational trigger for all bambi dolls",
              active: true,
              isStandard: true
            }
          ]
        });
        return newBambi.save();
      }
      return existingBambi;
    })
    .catch(err => {
      logger.error(`Error checking/creating bambi: ${err.message}`);
      // Don't return error to client, just log it
    });
  
  return res.json({
    success: true,
    message: 'BambiName set successfully',
    bambiname: bambiname
  });
});


export default router;