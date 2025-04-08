import express from 'express';
import multer from 'multer';
import { Bambi } from '../schemas/BambiSchema.js';
import Logger from '../utils/logger.js';

const router = express.Router();
const logger = new Logger('BambiRoutes');

// Configure multer to use memory storage
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  // Updated to allow jpeg, jpg, png, and gif
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
    const bambis = await Bambi.find()
      .sort({ lastActive: -1 })
      .limit(20);
    
    // Add profilePictureUrl for each bambi
    const bambisWithPics = bambis.map(bambi => {
      const bambiObj = bambi.toObject();
      bambiObj.profilePictureUrl = bambi.profilePicture 
        ? `/bambis/${bambi.username}/avatar` 
        : '/images/default-avatar.gif';
      return bambiObj;
    });
    
    res.render('bambis', { 
      bambis: bambisWithPics,
      error: null
    });
  } catch (error) {
    logger.error('Error fetching bambis:', error.message);
    res.status(500).send('Error loading bambis page');
  }
});

// Avatar route - serve profile pictures
router.get('/:username/avatar', async (req, res) => {
  try {
    const bambi = await Bambi.findOne({ username: req.params.username });
    if (!bambi || !bambi.profilePicture) {
      return res.redirect('/images/default-avatar.gif');
    }
    
    res.set('Content-Type', bambi.profilePicture.contentType);
    res.send(bambi.profilePicture.buffer);
  } catch (error) {
    logger.error('Error serving avatar:', error.message);
    res.redirect('/images/default-avatar.gif');
  }
});

// Create profile page route
router.get('/create', (req, res) => {
  const bambiname = getBambiNameFromCookies(req);
  
  if (!bambiname) {
    return res.redirect('/bambis');
  }
  
  // Check if profile already exists
  Bambi.findOne({ username: bambiname })
    .then(existingProfile => {
      if (existingProfile) {
        return res.redirect(`/bambis/${bambiname}`);
      }
      
      // Use the bambi.ejs template for new profiles
      res.render('bambis/profile', { 
        bambiname
      });
    })
    .catch(error => {
      logger.error('Error checking for existing profile:', error.message);
      res.status(500).send('Error checking profile');
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
      return res.status(404).render('error', { 
        error: 'Bambi not found',
        message: 'The profile you are looking for does not exist.'
      });
    }
    
    // Check if the current user has liked this profile
    const userHasLiked = bambi.hearts.users.some(user => user.username === currentBambiname);
    
    // Is this the profile owner viewing?
    const isOwnProfile = currentBambiname === username;
    
    // Update last view time
    bambi.lastActive = Date.now();
    await bambi.save();
    
    // Render the profile page
    res.render('bambis/bambi-profile', {
      bambi,
      userHasLiked,
      isOwnProfile
    });
  } catch (error) {
    logger.error('Error fetching bambi profile:', error.message);
    res.status(500).render('error', {
      error: 'Server Error',
      message: 'Error loading profile page'
    });
  }
});

// API route to update profile
router.post('/api/update-profile', upload.single('avatar'), async (req, res) => {
  try {
    logger.info('Update profile request received');
    
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
        username: bambiname,
        displayName: req.body.displayName || bambiname,
        description: req.body.description || '',
        level: 1,
        experience: 0,
        followers: [],
        following: [],
        hearts: { count: 0, users: [] },
        lastActive: Date.now()
      });
    }
    
    // Update basic info
    bambi.displayName = req.body.displayName || bambiname;
    bambi.description = req.body.description || '';
    
    // Handle profile picture upload with appropriate content type
    if (req.file) {
      bambi.profilePicture = {
        buffer: req.file.buffer,
        contentType: req.file.mimetype
      };
    }
    
    // Handle profile theme
    if (req.body.primaryColor || req.body.secondaryColor || req.body.textColor) {
      bambi.profileTheme = {
        primaryColor: req.body.primaryColor || bambi.profileTheme?.primaryColor || '#fa81ff',
        secondaryColor: req.body.secondaryColor || bambi.profileTheme?.secondaryColor || '#ff4fa2',
        textColor: req.body.textColor || bambi.profileTheme?.textColor || '#ffffff'
      };
    }
    
    // Handle triggers
    if (req.body.triggers) {
      bambi.triggers = Array.isArray(req.body.triggers) 
        ? req.body.triggers 
        : JSON.parse(req.body.triggers);
    }
    
    await bambi.save();
    
    res.json({
      success: true,
      message: isNewProfile ? 'Profile created!' : 'Profile updated!',
      profile: {
        username: bambi.username,
        displayName: bambi.displayName,
        description: bambi.description,
        level: bambi.level,
        profileTheme: bambi.profileTheme
      }
    });
  } catch (error) {
    logger.error('Error updating profile:', error.message);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
});

// API route for hearts
router.post('/api/heart/:username', async (req, res) => {
  try {
    const targetUsername = req.params.username;
    const currentBambiname = getBambiNameFromCookies(req);
    
    if (!currentBambiname) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    const bambi = await Bambi.findOne({ username: targetUsername });
    if (!bambi) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    
    // Check if already hearted
    const alreadyHearted = bambi.hearts.users.some(user => user.username === currentBambiname);
    
    if (alreadyHearted) {
      // Remove heart
      bambi.hearts.users = bambi.hearts.users.filter(user => user.username !== currentBambiname);
      bambi.hearts.count = Math.max(0, bambi.hearts.count - 1);
    } else {
      // Add heart
      bambi.hearts.users.push({
        username: currentBambiname,
        timestamp: Date.now()
      });
      bambi.hearts.count += 1;
    }
    
    await bambi.save();
    
    res.json({
      success: true,
      hearted: !alreadyHearted,
      heartCount: bambi.hearts.count
    });
  } catch (error) {
    logger.error('Error hearting profile:', error.message);
    res.status(500).json({ success: false, message: 'Error processing request' });
  }
});

// API route to get profile image
router.get('/api/profile/:username/picture', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Find the bambi profile
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi || !bambi.profileImageData || !bambi.profileImageType) {
      // Simple fallback instead of trying to use file system
      return res.redirect('/images/default-profile.png');
    }
    
    // Convert base64 to binary
    const img = Buffer.from(bambi.profileImageData, 'base64');
    
    // Set appropriate content type and cache headers
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.setHeader('Content-Type', bambi.profileImageType);
    
    // Send the image
    res.send(img);
  } catch (error) {
    logger.error('Error fetching profile picture:', error.message);
    res.redirect('/images/default-profile.png');
  }
});

// Add a route for following/unfollowing another Bambi
router.post('/api/follow/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const currentBambiname = getBambiNameFromCookies(req);
    
    if (!currentBambiname) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    // Don't allow following yourself
    if (currentBambiname === username) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
    }
    
    // Find both Bambi profiles
    const [currentBambi, targetBambi] = await Promise.all([
      Bambi.findOne({ username: currentBambiname }),
      Bambi.findOne({ username })
    ]);
    
    if (!currentBambi || !targetBambi) {
      return res.status(404).json({ success: false, message: 'Bambi profile not found' });
    }
    
    // Check if already following
    const isFollowing = currentBambi.following.some(follow => follow === username);
    
    if (isFollowing) {
      // Unfollow
      // Remove from current user's following list
      currentBambi.following = currentBambi.following.filter(follow => follow !== username);
      
      // Remove from target user's followers list
      targetBambi.followers = targetBambi.followers.filter(follower => follower !== currentBambiname);
      
      await Promise.all([currentBambi.save(), targetBambi.save()]);
      
      return res.json({ 
        success: true, 
        following: false,
        message: `You are no longer following ${targetBambi.displayName || username}`
      });
    } else {
      // Follow
      // Add to current user's following list if not already present
      if (!currentBambi.following.includes(username)) {
        currentBambi.following.push(username);
      }
      
      // Add to target user's followers list if not already present
      if (!targetBambi.followers.includes(currentBambiname)) {
        targetBambi.followers.push(currentBambiname);
      }
      
      // Add activity for the target Bambi
      await targetBambi.addActivity('other', `Got a new follower: ${currentBambi.displayName || currentBambiname}`);
      
      // Award experience to both users
      await Promise.all([
        targetBambi.addExperience(2),  // Small XP for being followed
        currentBambi.addExperience(1)  // Even smaller XP for following someone
      ]);
      
      await Promise.all([currentBambi.save(), targetBambi.save()]);
      
      return res.json({ 
        success: true, 
        following: true,
        message: `You are now following ${targetBambi.displayName || username}`
      });
    }
  } catch (error) {
    logger.error('Error processing follow/unfollow:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add a route to get followers/following lists
router.get('/api/connections/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const type = req.query.type || 'followers'; // Default to followers
    
    // Find the Bambi profile
    const bambi = await Bambi.findOne({ username });
    
    if (!bambi) {
      return res.status(404).json({ success: false, message: 'Bambi profile not found' });
    }
    
    if (type === 'followers') {
      // Get followers details
      const followers = await Bambi.find({ username: { $in: bambi.followers } })
        .select('username displayName profileTheme lastActive');
      
      return res.json({
        success: true,
        connections: followers
      });
    } else if (type === 'following') {
      // Get following details
      const following = await Bambi.find({ username: { $in: bambi.following } })
        .select('username displayName profileTheme lastActive');
      
      return res.json({
        success: true,
        connections: following
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid connection type' });
    }
  } catch (error) {
    logger.error('Error fetching connections:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add this route to check if a profile exists
router.get('/api/check-profile/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const profile = await Bambi.findOne({ username });
    
    res.json({
      exists: !!profile
    });
  } catch (error) {
    logger.error('Error checking profile existence:', error.message);
    res.status(500).json({ 
      error: 'Server error',
      exists: false
    });
  }
});

export default router;