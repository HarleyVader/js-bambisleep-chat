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

// Helper function to render profile cards into HTML strings
function renderProfileCardToString(req, res, bambi) {
  try {
    // Add userHasLiked property for consistent template usage
    const currentBambiname = getBambiNameFromCookies(req);
    bambi.userHasLiked = bambi.hearts.users.some(user => 
      user.username === currentBambiname);
    
    // Use the res.render method with a callback to get the HTML string
    return new Promise((resolve, reject) => {
      res.render('../views/partials/profile-card', { bambi }, (err, html) => {
        if (err) reject(err);
        else resolve(html);
      });
    });
  } catch (error) {
    logger.error('Error rendering profile card:', error);
    return Promise.resolve(''); // Return empty string on error
  }
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
        : '/bambis/default-avatar.gif';
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
      return res.redirect('/bambis/default-avatar.gif');
    }
    
    res.set('Content-Type', bambi.profilePicture.contentType);
    res.send(bambi.profilePicture.buffer);
  } catch (error) {
    logger.error('Error serving avatar:', error.message);
    res.redirect('/bambis/default-avatar.gif');
  }
});

// Route for profile page - use the existing profile.ejs instead
router.get('/profile', async (req, res) => {
  try {
    const bambiname = getBambiNameFromCookies(req);
    
    if (!bambiname) {
      return res.redirect('/login?redirect=/bambis/profile');
    }
    
    // Find the bambi profile
    const bambi = await Bambi.findOne({ username: bambiname });
    
    if (!bambi) {
      return res.redirect('/register');
    }
    
    // Convert Bambi object to match the profile.ejs template expectations
    const profile = {
      avatar: bambi.profilePicture ? `${bambi.username}/avatar` : '/bambis/default-avatar.gif',
      displayName: bambi.displayName,
      woodland: bambi.woodland || 'Sleepy Meadow',
      bio: bambi.description,
      favoriteSeasons: bambi.favoriteSeasons || ['spring'],
    };
    
    const user = {
      username: bambi.username
    };
    
    // Get friends if any
    const friendProfiles = [];
    const onlineUsers = [];
    
    // Render using the existing profile.ejs
    res.render('bambis/profile', { 
      user,
      profile,
      friendProfiles,
      onlineUsers
    });
  } catch (error) {
    logger.error('Error loading profile page:', error.message);
    res.status(500).render('error', {
      error: 'Server Error',
      message: 'Error loading profile page'
    });
  }
});

// Edit profile page route
router.get('/edit', async (req, res) => {
  try {
    const bambiname = getBambiNameFromCookies(req);
    
    if (!bambiname) {
      return res.redirect('/login?redirect=/bambis/edit');
    }
    
    // Find the bambi profile
    const bambi = await Bambi.findOne({ username: bambiname });
    
    if (!bambi) {
      return res.redirect('/register');
    }
    
    // Add profilePictureUrl for display
    bambi.profilePictureUrl = bambi.profilePicture 
      ? `/bambis/${bambi.username}/avatar` 
      : '/bambis/default-avatar.gif';
    
    // Render the edit profile page
    res.render('bambis/bambi-edit', {
      bambi,
      error: null
    });
  } catch (error) {
    logger.error('Error loading profile edit page:', error.message);
    res.status(500).render('error', {
      error: 'Server Error',
      message: 'Error loading profile edit page'
    });
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
    
    // Add profile view to activity log if not own profile
    if (!isOwnProfile && currentBambiname) {
      await bambi.addActivity('other', `Profile viewed by ${currentBambiname}`);
    }
    
    await bambi.save();
    
    // Add profilePictureUrl for proper display
    bambi.profilePictureUrl = bambi.profilePicture 
      ? `/bambis/${bambi.username}/avatar` 
      : '/bambis/default-avatar.gif';
    
    // Detect if online (active in last 10 minutes)
    bambi.isOnline = (Date.now() - new Date(bambi.lastActive).getTime()) < (10 * 60 * 1000);
    
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
    bambi.description = req.body.bio || req.body.description || '';
    
    // Handle woodland field from profile.ejs
    if (req.body.woodland) {
      bambi.woodland = req.body.woodland;
    }
    
    // Handle favorite seasons from profile.ejs
    if (req.body.favoriteSeasons) {
      bambi.favoriteSeasons = Array.isArray(req.body.favoriteSeasons) 
        ? req.body.favoriteSeasons 
        : JSON.parse(req.body.favoriteSeasons);
    }
    
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
        woodland: bambi.woodland,
        favoriteSeasons: bambi.favoriteSeasons,
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

// Modify the API list route to use this function
router.get('/api/list', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || 'active';
    const search = req.query.search || '';
    
    let sortOptions = {};
    switch (sort) {
      case 'hearts':
        sortOptions = { 'hearts.count': -1 };
        break;
      case 'followers':
        sortOptions = { 'followers.length': -1 };
        break;
      case 'level':
        sortOptions = { level: -1 };
        break;
      case 'active':
      default:
        sortOptions = { lastActive: -1 };
    }
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    const [bambis, total] = await Promise.all([
      Bambi.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
      Bambi.countDocuments(query)
    ]);
    
    // If the request wants HTML (for server-side rendering)
    if (req.query.format === 'html') {
      // Render each bambi using the partial
      const renderedCards = await Promise.all(
        bambis.map(bambi => renderProfileCardToString(req, res, bambi))
      );
      
      res.json({
        success: true,
        bambis: renderedCards,
        total,
        page,
        hasMore: total > (skip + limit)
      });
    } else {
      // Standard JSON response for client-side rendering
      res.json({
        success: true,
        bambis: bambis,
        total,
        page,
        hasMore: total > (skip + limit)
      });
    }
  } catch (error) {
    logger.error('Error fetching bambis list:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bambis'
    });
  }
});

// Add a route for registration
router.get('/register', (req, res) => {
  const template = req.query.template;
  const redirect = req.query.redirect || '/';
  
  // Get the bambiname from cookies if available
  const bambiname = req.cookies.bambiname || '';
  
  if (template === 'bambi') {
      // Use the bambi template
      res.render('register', {
          bambiTemplate: true,
          bambiname: bambiname,
          redirect: redirect
      });
  } else {
      // Use the default registration template
      res.render('register', {
          bambiTemplate: false,
          redirect: redirect
      });
  }
});

export default router;