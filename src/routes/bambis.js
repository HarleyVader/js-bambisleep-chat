import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import Bambi from '../schemas/BambiSchema.js';
import Logger from '../utils/logger.js';

const router = express.Router();
const logger = new Logger('BambiRoutes');

// Configure multer to use memory storage instead of disk storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  fileFilter: fileFilter
});

// Helper to get the bambiname from cookies
function getBambiNameFromCookies(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';')
    .map(cookie => cookie.trim().split('='))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  
  return cookies['bambiname'] 
    ? decodeURIComponent(cookies['bambiname']).replace(/%20/g, ' ') 
    : null;
}

// Main bambis page route
router.get('/', async (req, res) => {
  try {
    // Get all bambis, sorted by lastActive
    const bambis = await Bambi.find()
      .sort({ lastActive: -1 })
      .limit(20);
    
    res.render('bambis', { 
      bambis
    });
  } catch (error) {
    logger.error('Error fetching bambis:', error.message);
    res.status(500).send('Error loading bambis page');
  }
});

// Create profile page route
router.get('/create', (req, res) => {
  const bambiname = getBambiNameFromCookies(req);
  
  if (!bambiname) {
    return res.redirect('/bambis');
  }
  
  // Create empty bambi model for the form
  const bambi = {
    username: bambiname,
    displayName: '',
    description: '',
    profilePictureUrl: '/images/in-her-bubble.gif',
    profileTheme: {
      primaryColor: '#fa81ff',
      secondaryColor: '#ff4fa2',
      textColor: '#ffffff'
    },
    triggers: []
  };
  
  // Updated path to reflect the new folder structure
  res.render('bambis/bambi-edit', { 
    bambi,
    newProfile: true
  });
});

// Edit profile page route
router.get('/edit', async (req, res) => {
  try {
    const bambiname = getBambiNameFromCookies(req);
    
    if (!bambiname) {
      return res.redirect('/bambis');
    }
    
    // Find the bambi profile
    let bambi = await Bambi.findOne({ username: bambiname });
    
    if (!bambi) {
      return res.redirect('/bambis/create');
    }
    
    // Updated path to reflect the new folder structure
    res.render('bambis/bambi-edit', { 
      bambi,
      newProfile: false
    });
  } catch (error) {
    logger.error('Error loading edit profile page:', error.message);
    res.status(500).send('Error loading edit profile page');
  }
});

// Individual profile page route
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const currentBambiname = getBambiNameFromCookies(req);
    
    // Find the bambi profile
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi) {
      return res.status(404).send('Bambi profile not found');
    }
    
    // Check if the current user has liked this profile
    const userHasLiked = bambi.hearts.users.some(user => user.username === currentBambiname);
    
    // Update last view time
    bambi.lastActive = Date.now();
    await bambi.save();
    
    // Updated path to reflect the new folder structure
    res.render('bambis/bambi-profile', { 
      bambi,
      isOwnProfile: currentBambiname === username,
      userHasLiked
    });
  } catch (error) {
    logger.error('Error fetching bambi profile:', error.message);
    res.status(500).send('Error loading bambi profile');
  }
});

// API route to update profile
router.post('/api/update-profile', upload.single('avatar'), async (req, res) => {
    try {
      const bambiname = getBambiNameFromCookies(req);
      
      if (!bambiname) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
      }
      
      // Check if this is a new profile or updating existing
      let bambi = await Bambi.findOne({ username: bambiname });
      const isNewProfile = !bambi;
      
      if (isNewProfile) {
        // Create new profile
        bambi = new Bambi({
          username: bambiname
        });
      }
      
      // Update basic info
      bambi.displayName = req.body.displayName || bambiname;
      bambi.description = req.body.description || '';
      
      // Update theme
      bambi.profileTheme = {
        primaryColor: req.body.primaryColor || '#fa81ff',
        secondaryColor: req.body.secondaryColor || '#ff4fa2',
        textColor: req.body.textColor || '#ffffff'
      };
      
      // Process triggers
      if (req.body.triggers) {
        try {
          const triggers = JSON.parse(req.body.triggers);
          if (Array.isArray(triggers)) {
            bambi.triggers = triggers.slice(0, 10); // Limit to 10 triggers
          }
        } catch (e) {
          logger.error('Error parsing triggers:', e.message);
        }
      }
      
      // Process uploaded avatar - directly from memory
      if (req.file) {
        try {
          // Convert buffer to base64 directly
          const base64Data = req.file.buffer.toString('base64');
          
          // Store in the database
          bambi.profileImageData = base64Data;
          bambi.profileImageType = req.file.mimetype;
          bambi.profileImageName = req.file.originalname;
        } catch (e) {
          logger.error('Error processing avatar:', e.message);
        }
      }
      
      // Update last active time
      bambi.lastActive = Date.now();
      
      // Save the profile
      await bambi.save();
      
      // If new profile, add a first activity
      if (isNewProfile) {
        await bambi.addActivity('other', 'Created their profile');
        
        // Award some initial experience
        await bambi.addExperience(50);
      }
      
      // Send response
      res.json({ 
        success: true, 
        message: isNewProfile ? 'Profile created successfully!' : 'Profile updated successfully!',
        redirect: isNewProfile ? `/bambis/${bambi.username}` : null
      });
    } catch (error) {
      logger.error('Error updating profile:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  });

// API route for hearts
router.post('/api/heart/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const currentBambiname = getBambiNameFromCookies(req);
    
    if (!currentBambiname) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    // Find the bambi profile
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi) {
      return res.status(404).json({ success: false, message: 'Bambi profile not found' });
    }
    
    // Check if user already liked
    const userHeartIndex = bambi.hearts.users.findIndex(user => user.username === currentBambiname);
    let liked = false;
    
    if (userHeartIndex >= 0) {
      // Remove the heart
      bambi.hearts.users.splice(userHeartIndex, 1);
      bambi.hearts.count = Math.max(0, bambi.hearts.count - 1);
    } else {
      // Add a heart
      bambi.hearts.users.push({
        username: currentBambiname,
        timestamp: new Date()
      });
      bambi.hearts.count++;
      liked = true;
      
      // Add activity for the bambi
      await bambi.addActivity('heart', `Received a heart from ${currentBambiname}`);
      
      // Award experience
      await bambi.addExperience(5);
    }
    
    // Save the changes
    await bambi.save();
    
    res.json({ 
      success: true, 
      count: bambi.hearts.count,
      liked
    });
  } catch (error) {
    logger.error('Error processing heart:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API route to get profile image
router.get('/api/profile/:username/picture', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Find the bambi profile
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi || !bambi.profileImageData || !bambi.profileImageType) {
      return res.redirect('/images/in-her-bubble.gif');
    }
    
    // Convert base64 to binary
    const img = Buffer.from(bambi.profileImageData, 'base64');
    
    // Set content type header
    res.setHeader('Content-Type', bambi.profileImageType);
    
    // Send the image
    res.send(img);
  } catch (error) {
    logger.error('Error fetching profile picture:', error.message);
    res.redirect('/images/in-her-bubble.gif');
  }
});

export default router;