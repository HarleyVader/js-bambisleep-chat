const express = require('express');
const router = express.Router();
const Profile = require('../models/Profile');

// Home page - Show all profiles in a card style layout
router.get('/', async (req, res) => {
  try {
    const profiles = await Profile.find().sort({ updatedAt: -1 });
    
    res.render('index', { 
      title: 'BambiSleep Community Profiles',
      profiles,
      validConstantsCount: 5,
      footer: {
        logo: {
          url: "https://brandynette.xxx/",
          image: "/gif/brandynette.gif",
          alt: "Brandynette.xxx"
        },
        tagline: "Connect with other Bambis and explore the forest together"
      }
    });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).render('error', { 
      message: 'Error fetching profiles',
      error: req.app.get('env') === 'development' ? error : {}
    });
  }
});

module.exports = router;