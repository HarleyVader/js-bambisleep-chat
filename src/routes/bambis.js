// Add to existing routes file

// Add or remove favorite file
router.post('/api/profile/:username/favorites', async (req, res) => {
  try {
    const { fileId, action } = req.body;
    
    if (!fileId || !['add', 'remove'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request. Requires fileId and action (add/remove)' 
      });
    }
    
    const bambi = await Bambi.findOne({ username: req.params.username });
    if (!bambi) {
      return res.status(404).json({ success: false, message: 'Bambi not found' });
    }
    
    if (action === 'add') {
      // Add to favorites if not already there
      if (!bambi.favoriteFiles.includes(fileId)) {
        bambi.favoriteFiles.push(fileId);
      }
    } else {
      // Remove from favorites
      bambi.favoriteFiles = bambi.favoriteFiles.filter(id => id !== fileId);
    }
    
    await bambi.save();
    
    res.status(200).json({
      success: true,
      data: {
        favoriteFiles: bambi.favoriteFiles
      }
    });
  } catch (error) {
    logger.error('Error managing favorites:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update favorites',
      error: error.message
    });
  }
});

// Get favorite files for a profile
router.get('/api/profile/:username/favorites', async (req, res) => {
  try {
    const bambi = await Bambi.findOne({ username: req.params.username })
      .select('favoriteFiles');
    
    if (!bambi) {
      return res.status(404).json({ success: false, message: 'Bambi not found' });
    }
    
    // Fetch the actual file details based on IDs
    // This assumes you have a File model
    const File = mongoose.model('File');
    const favoriteFiles = await File.find({
      _id: { $in: bambi.favoriteFiles }
    });
    
    res.status(200).json({
      success: true,
      data: favoriteFiles
    });
  } catch (error) {
    logger.error('Error fetching favorites:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch favorites',
      error: error.message
    });
  }
});

// Add follow/unfollow functionality

// Follow a bambi
router.post('/api/profile/:username/follow', async (req, res) => {
  try {
    const { followerUsername } = req.body;
    
    if (!followerUsername) {
      return res.status(400).json({ success: false, message: 'Follower username is required' });
    }
    
    // Get the bambi to follow
    const bambiToFollow = await Bambi.findOne({ username: req.params.username });
    if (!bambiToFollow) {
      return res.status(404).json({ success: false, message: 'Bambi not found' });
    }
    
    // Get the follower
    const follower = await Bambi.findOne({ username: followerUsername });
    if (!follower) {
      return res.status(404).json({ success: false, message: 'Follower bambi not found' });
    }
    
    // Check if already following
    const alreadyFollowing = bambiToFollow.followers.some(f => f.type === followerUsername);
    if (alreadyFollowing) {
      return res.status(400).json({ success: false, message: 'Already following this bambi' });
    }
    
    // Add to followers
    bambiToFollow.followers.push({
      type: followerUsername,
      since: new Date()
    });
    
    // Add to following
    follower.following.push({
      type: req.params.username,
      since: new Date()
    });
    
    await bambiToFollow.save();
    await follower.save();
    
    res.status(200).json({
      success: true,
      message: 'Successfully followed'
    });
  } catch (error) {
    logger.error('Error following bambi:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to follow bambi',
      error: error.message
    });
  }
});