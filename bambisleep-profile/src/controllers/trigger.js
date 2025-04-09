const Profile = require('../models/Profile');
const logger = require('../utils/logger');

// Standard trigger list - keep in sync with triggers.js
const standardTriggers = [
  "BIMBO DOLL",
  "GOOD GIRL",
  "BAMBI SLEEP",
  "BAMBI FREEZE",
  "ZAP COCK DRAIN OBEY",
  "BAMBI ALWAYS WINS",
  "BAMBI RESET",
  "I-Q DROP",
  "I-Q LOCK",
  "POSTURE LOCK",
  "UNIFORM LOCK",
  "SAFE & SECURE",
  "PRIMPED",
  "PAMPERED",
  "SNAP & FORGET",
  "GIGGLE TIME",
  "BLONDE MOMENT",
  "BAMBI DOES AS SHE IS TOLD",
  "DROP FOR COCK",
  "COCK ZOMBIE NOW",
  "TITS LOCK",
  "WAIST LOCK",
  "BUTT LOCK",
  "LIMBS LOCK",
  "FACE LOCK",
  "LIPS LOCK",
  "THROAT LOCK",
  "HIPS LOCK",
  "CUNT LOCK",
  "BAMBI CUM & COLAPSE"
];

exports.getAllTriggers = async (req, res) => {
  try {
    // Use the standard trigger list instead of Profile.getStandardTriggers()
    res.json({ standardTriggers });
  } catch (err) {
    logger.error(`Error getting standard triggers: ${err.message}`);
    res.status(500).json({ error: 'Failed to get standard triggers' });
  }
};

exports.getProfileTriggers = async (req, res) => {
  try {
    const { username } = req.params;
    const profile = await Profile.findOne({ username });
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Make sure activeTriggersSession exists
    const activeTriggerSession = profile.activeTriggerSession || {
      startTime: new Date(),
      activeTriggers: []
    };
    
    res.json({ 
      triggers: profile.triggers,
      activeTriggerSession
    });
  } catch (err) {
    logger.error(`Error getting profile triggers: ${err.message}`);
    res.status(500).json({ error: 'Failed to get profile triggers' });
  }
};

exports.addTrigger = async (req, res) => {
  try {
    const { username } = req.params;
    const { name, description, active } = req.body;
    
    if (description && description.length > 1500) {
      return res.status(400).json({ error: 'Description must be 1500 characters or less' });
    }
    
    const profile = await Profile.findOne({ username });
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Check if it's a standard trigger
    const isStandard = standardTriggers.includes(name);
    
    // Check if trigger already exists
    const existingTrigger = profile.triggers.find(t => t.name === name);
    if (existingTrigger) {
      return res.status(400).json({ error: 'Trigger already exists' });
    }
    
    // Add the trigger
    profile.triggers.push({
      name,
      description,
      active: active !== false,
      isStandard
    });
    
    // Update active trigger session if the trigger is active
    if (active !== false) {
      if (!profile.activeTriggerSession) {
        profile.activeTriggerSession = {
          startTime: new Date(),
          activeTriggers: [name],
          lastUpdated: new Date()
        };
      } else {
        // Make sure activeTriggers exists and is an array
        if (!profile.activeTriggerSession.activeTriggers) {
          profile.activeTriggerSession.activeTriggers = [];
        }
        profile.activeTriggerSession.activeTriggers.push(name);
        profile.activeTriggerSession.lastUpdated = new Date();
      }
    }
    
    await profile.save();
    
    res.status(201).json({ 
      message: 'Trigger added successfully',
      trigger: profile.triggers[profile.triggers.length - 1],
      activeTriggerSession: profile.activeTriggerSession
    });
  } catch (err) {
    logger.error(`Error adding trigger: ${err.message}`);
    res.status(500).json({ error: 'Failed to add trigger' });
  }
};

exports.toggleTrigger = async (req, res) => {
  try {
    const { username, triggerName } = req.params;
    const { active } = req.body;
    
    const profile = await Profile.findOne({ username });
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Find the trigger
    const triggerIndex = profile.triggers.findIndex(t => t.name === triggerName);
    if (triggerIndex === -1) {
      return res.status(404).json({ error: 'Trigger not found' });
    }
    
    // Update trigger active state
    profile.triggers[triggerIndex].active = active;
    
    // Update active trigger session
    if (!profile.activeTriggerSession) {
      profile.activeTriggerSession = {
        startTime: new Date(),
        activeTriggers: active ? [triggerName] : [],
        lastUpdated: new Date()
      };
    } else {
      // Make sure activeTriggers exists and is an array
      if (!profile.activeTriggerSession.activeTriggers) {
        profile.activeTriggerSession.activeTriggers = [];
      }
      
      if (active) {
        // Add trigger if not already in the list
        if (!profile.activeTriggerSession.activeTriggers.includes(triggerName)) {
          profile.activeTriggerSession.activeTriggers.push(triggerName);
        }
      } else {
        // Remove trigger from active list
        profile.activeTriggerSession.activeTriggers = 
          profile.activeTriggerSession.activeTriggers.filter(t => t !== triggerName);
      }
      
      profile.activeTriggerSession.lastUpdated = new Date();
    }
    
    await profile.save();
    
    res.json({ 
      message: `Trigger ${active ? 'activated' : 'deactivated'} successfully`,
      activeTriggerSession: profile.activeTriggerSession
    });
  } catch (err) {
    logger.error(`Error toggling trigger: ${err.message}`);
    res.status(500).json({ error: 'Failed to toggle trigger' });
  }
};

exports.toggleAllTriggers = async (req, res) => {
  try {
    const { username } = req.params;
    const { active } = req.body;
    
    const profile = await Profile.findOne({ username });
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Update all triggers
    profile.triggers.forEach(trigger => {
      trigger.active = !!active;
    });
    
    // Create activeTriggerSession if it doesn't exist
    if (!profile.activeTriggerSession) {
      profile.activeTriggerSession = {
        startTime: new Date(),
        activeTriggers: [],
        lastUpdated: new Date()
      };
    }
    
    // Update active triggers
    if (active) {
      profile.activeTriggerSession.activeTriggers = profile.triggers.map(t => t.name);
    } else {
      profile.activeTriggerSession.activeTriggers = [];
    }
    
    profile.activeTriggerSession.lastUpdated = new Date();
    
    await profile.save();
    
    res.json({ 
      message: `All triggers ${active ? 'activated' : 'deactivated'} successfully`,
      activeTriggerSession: profile.activeTriggerSession,
      triggers: profile.triggers
    });
  } catch (err) {
    logger.error(`Error toggling all triggers: ${err.message}`);
    res.status(500).json({ error: 'Failed to toggle all triggers' });
  }
};

exports.getTriggerHistory = async (req, res) => {
  try {
    const { username } = req.params;
    
    const profile = await Profile.findOne({ username });
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    res.json({ triggerHistory: profile.triggerHistory || [] });
  } catch (err) {
    logger.error(`Error getting trigger history: ${err.message}`);
    res.status(500).json({ error: 'Failed to get trigger history' });
  }
};

// Add new endpoint to handle direct trigger events
exports.processTriggerEvent = async (req, res) => {
  try {
    const { username } = req.params;
    const { triggers } = req.body;
    
    if (!Array.isArray(triggers) || triggers.length === 0) {
      return res.status(400).json({ error: 'No valid triggers provided' });
    }
    
    const profile = await Profile.findOne({ username });
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Update or create trigger history entry
    if (!profile.triggerHistory) {
      profile.triggerHistory = [];
    }
    
    profile.triggerHistory.push({
      timestamp: new Date(),
      triggers: triggers,
      source: req.body.source || 'web'
    });
    
    // Limit history size
    if (profile.triggerHistory.length > 100) {
      profile.triggerHistory = profile.triggerHistory.slice(-100);
    }
    
    await profile.save();
    
    res.status(200).json({ 
      message: 'Trigger event processed successfully',
      triggersProcessed: triggers.length
    });
  } catch (err) {
    logger.error(`Error processing trigger event: ${err.message}`);
    res.status(500).json({ error: 'Failed to process trigger event' });
  }
};