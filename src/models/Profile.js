import mongoose from 'mongoose';
import { withDbConnection } from '../config/db.js';
import Logger from '../utils/logger.js';
import crypto from 'crypto';

const logger = new Logger('Profile');

// Standard BambiSleep triggers from triggers.js
const STANDARD_TRIGGERS = [
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

// Define schema
const profileSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    trim: true
  },
  // Add cookie field for authentication
  cookie: {
    type: String,
    unique: true,
    sparse: true
  },
  // Add cookieName to track cookie associations
  cookieName: {
    type: String,
    trim: true,
    index: true
  },
  avatar: {
    type: String,
    default: '/gif/default-avatar.gif'
  },
  headerImage: {
    type: String,
    default: '/gif/default-header.gif'
  },
  headerColor: {
    type: String,
    default: '#35424a'
  },
  about: {
    type: String,
    default: 'Tell us about yourself...',
    maxlength: 150
  },
  description: {
    type: String,
    default: 'Share your bambi journey...',
    maxlength: 1500
  },
  triggers: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: String,
    active: {
      type: Boolean,
      default: true
    },
    isStandard: {
      type: Boolean,
      default: false
    },
    lastActivated: {
      type: Date,
      default: null
    },
    activationCount: {
      type: Number,
      default: 0
    }
  }],
  activeTriggers: {
    type: [String],
    default: []
  },
  activeTriggerSession: {
    startTime: Date,
    lastUpdated: Date,
    activeTriggers: [String]
  },
  triggerHistory: [{
    timestamp: Date,
    triggers: [String],
    source: String
  }],
  collar: {
    text: {
      type: String,
      default: ''
    },
    enabled: {
      type: Boolean,
      default: false
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  systemControls: {
    spiralsEnabled: {
      type: Boolean,
      default: false
    },
    hypnosisEnabled: {
      type: Boolean,
      default: false
    },
    collarText: {
      type: String,
      default: ''
    },
    collarEnabled: {
      type: Boolean,
      default: false
    },
    collarLastUpdated: {
      type: Date,
      default: null
    },
    multiplierSettings: {
      A1: { type: Number, default: 1 },
      A2: { type: Number, default: 1 },
      B1: { type: Number, default: 1 },
      B2: { type: Number, default: 1 },
      operation: { 
        type: String, 
        enum: ['add', 'subtract', 'multiply', 'divide'],
        default: 'add'
      }
    },
    activeTriggers: [String]
  },
  settings: {
    type: Object,
    default: { theme: 'dark' }
  },
  xp: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  generatedWords: {
    type: Number,
    default: 0
  },
  xpHistory: [{
    timestamp: Date,
    amount: Number,
    source: String,
    description: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true 
});

// Update timestamps before saving
profileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add methods for trigger functionality
profileSchema.methods.toggleTrigger = function(triggerName, active) {
  const trigger = this.triggers.find(t => t.name === triggerName);
  
  if (trigger) {
    trigger.active = active;
    
    if (active) {
      trigger.lastActivated = new Date();
      trigger.activationCount += 1;
      
      if (!this.triggerHistory) {
        this.triggerHistory = [];
      }
      
      this.triggerHistory.push({
        timestamp: new Date(),
        triggers: [triggerName],
        source: 'toggleTrigger'
      });
      
      if (this.triggerHistory.length > 100) {
        this.triggerHistory = this.triggerHistory.slice(-100);
      }
    }
    
    this.updateActiveTriggerSession();
    return true;
  }
  
  return false;
};

profileSchema.methods.toggleAllTriggers = function(active) {
  this.triggers.forEach(trigger => {
    trigger.active = active;
    
    if (active) {
      trigger.lastActivated = new Date();
      trigger.activationCount += 1;
    }
  });
  
  this.updateActiveTriggerSession();
  
  if (active && this.triggers.length > 0) {
    if (!this.triggerHistory) {
      this.triggerHistory = [];
    }
    
    this.triggerHistory.push({
      timestamp: new Date(),
      triggers: this.triggers.map(t => t.name),
      source: 'toggleAllTriggers'
    });
    
    if (this.triggerHistory.length > 100) {
      this.triggerHistory = this.triggerHistory.slice(-100);
    }
  }
};

profileSchema.methods.setTriggerActive = function(triggerName, active) {
  return this.toggleTrigger(triggerName, active);
};

profileSchema.methods.updateActiveTriggerSession = function() {
  const activeTriggers = this.triggers.filter(trigger => trigger.active).map(t => t.name);
  
  if (!this.activeTriggerSession || !this.activeTriggerSession.startTime) {
    this.activeTriggerSession = {
      startTime: new Date(),
      activeTriggers: activeTriggers,
      lastUpdated: new Date()
    };
  } else {
    this.activeTriggerSession.activeTriggers = activeTriggers;
    this.activeTriggerSession.lastUpdated = new Date();
  }
  
  // Also update the flat activeTriggers array for backward compatibility
  this.activeTriggers = activeTriggers;
};

// Add a method to update system controls
profileSchema.methods.updateSystemControls = function(controlsData) {
  if (!this.systemControls) {
    this.systemControls = {};
  }
  
  // Update specific fields if provided
  if (controlsData.spiralsEnabled !== undefined) {
    this.systemControls.spiralsEnabled = controlsData.spiralsEnabled;
  }
  
  if (controlsData.hypnosisEnabled !== undefined) {
    this.systemControls.hypnosisEnabled = controlsData.hypnosisEnabled;
  }
  
  if (controlsData.collarText !== undefined) {
    this.systemControls.collarText = controlsData.collarText;
    this.systemControls.collarLastUpdated = new Date();
  }
  
  if (controlsData.collarEnabled !== undefined) {
    this.systemControls.collarEnabled = controlsData.collarEnabled;
  }
  
  if (controlsData.multiplierSettings) {
    this.systemControls.multiplierSettings = {
      ...this.systemControls.multiplierSettings,
      ...controlsData.multiplierSettings
    };
  }
  
  if (controlsData.activeTriggers) {
    this.systemControls.activeTriggers = controlsData.activeTriggers;
    // Also update the flat activeTriggers array for backward compatibility
    this.activeTriggers = controlsData.activeTriggers;
  }
};

// Add a method to add XP to the profile
profileSchema.methods.addXP = function(amount, source, description = '') {
  if (!amount || isNaN(amount)) return;
  
  // Add to total XP
  this.xp += amount;
  
  // Calculate level based on XP
  // Formula: level = 1 + floor(sqrt(xp / 100))
  this.level = 1 + Math.floor(Math.sqrt(this.xp / 100));
  
  // Add to XP history
  if (!this.xpHistory) {
    this.xpHistory = [];
  }
  
  this.xpHistory.push({
    timestamp: new Date(),
    amount,
    source,
    description
  });
  
  // Keep history to last 100 entries
  if (this.xpHistory.length > 100) {
    this.xpHistory = this.xpHistory.slice(-100);
  }
};

// Add method to get XP required for next level
profileSchema.methods.getNextLevelXP = function() {
  return Math.pow(this.level, 2) * 100;
};

// Static method to find a profile by cookie name
profileSchema.statics.findByCookieName = async function(cookieName) {
  return withDbConnection(async () => {
    return this.findOne({ cookieName });
  });
};

/**
 * Find or create a profile by cookie
 * Uses a transaction to ensure proper connection handling
 * 
 * @param {string} cookie - The cookie value to find profile by
 * @returns {Promise<Object>} - Profile object
 */
profileSchema.statics.findOrCreateByCookie = async function(cookie) {
  if (!cookie) {
    // Generate a random cookie if none provided
    cookie = crypto.randomBytes(32).toString('hex');
  }
  
  return withDbConnection(async () => {
    try {
      // Try to find profile by cookie
      let profile = await this.findOne({ cookie });
      
      // If not found, create a new anonymous profile
      if (!profile) {
        const username = `anonBambi_${Date.now().toString(36)}`;
        logger.info(`Creating new anonymous profile for cookie: ${cookie.substring(0, 8)}...`);
        
        profile = await this.create({
          username,
          displayName: username,
          cookie,
          activeTriggers: ["BAMBI SLEEP"],
          about: 'Anonymous Bambi',
          description: 'Share your bambi journey...',
          settings: { theme: 'dark' },
          triggers: [{ 
            name: "BAMBI SLEEP", 
            active: true, 
            description: "The foundational trigger for all bambi dolls" 
          }],
          systemControls: {
            activeTriggers: ["BAMBI SLEEP"],
            collarEnabled: false,
            collarText: ''
          }
        });
      }
      
      return profile;
    } catch (error) {
      logger.error(`Error in findOrCreateByCookie: ${error.message}`);
      
      // In case of error, return a temporary profile object
      return {
        username: 'anonBambi',
        activeTriggers: ["BAMBI SLEEP"],
        settings: { theme: 'dark' },
        xp: 0,
        level: 1,
        about: 'Anonymous Bambi'
      };
    }
  });
};

/**
 * Find or create a profile by username
 * 
 * @param {string} username - The username to find or create profile with
 * @returns {Promise<Object>} - Profile object
 */
profileSchema.statics.findOrCreateByUsername = async function(username) {
  if (!username) return null;
  
  return withDbConnection(async () => {
    try {
      // Try to find existing profile
      let profile = await this.findOne({ username });
      
      // If profile exists, return it
      if (profile) {
        return profile;
      }
      
      // Otherwise create a new one
      profile = new this({
        username,
        displayName: username,
        level: 1,
        xp: 0,
        activeTriggers: ["BAMBI SLEEP"],
        triggers: [{ 
          name: "BAMBI SLEEP", 
          active: true, 
          description: "The foundational trigger for all bambi dolls" 
        }],
        about: 'Tell us about yourself...',
        description: 'Share your bambi journey...',
        avatar: '/gif/default-avatar.gif',
        headerImage: '/gif/default-header.gif',
        headerColor: '#35424a',
        systemControls: {
          activeTriggers: ["BAMBI SLEEP"],
          collarEnabled: false,
          collarText: ''
        }
      });
      
      await profile.save();
      return profile;
    } catch (error) {
      if (error.code === 11000) {
        // Handle race condition where profile was created between our check and save
        return await this.findOne({ username });
      }
      logger.error(`Error in findOrCreateByUsername: ${error.message}`);
      throw error;
    }
  });
};

// Create the model
let Profile;
try {
  // Try to get the existing model first
  Profile = mongoose.model('Profile');
} catch (e) {
  // If it doesn't exist, create it
  Profile = mongoose.model('Profile', profileSchema);
}

/**
 * Get profile by username with proper connection management
 * 
 * @param {string} username - Profile username
 * @returns {Promise<Object>} - Profile object
 */
export async function getProfile(username) {
  return withDbConnection(async () => {
    try {
      return await Profile.findOne({ username });
    } catch (error) {
      logger.error(`Error getting profile for ${username}: ${error.message}`);
      return null;
    }
  });
}

/**
 * Update profile with proper connection management
 * 
 * @param {string} username - Profile username
 * @param {Object} updates - Profile updates
 * @returns {Promise<Object>} - Updated profile object
 */
export async function updateProfile(username, updates) {
  return withDbConnection(async () => {
    try {
      return await Profile.findOneAndUpdate(
        { username },
        { ...updates, updatedAt: Date.now() },
        { new: true, upsert: true, runValidators: true }
      );
    } catch (error) {
      logger.error(`Error updating profile for ${username}: ${error.message}`);
      throw error;
    }
  });
}

export { STANDARD_TRIGGERS };
export default Profile;