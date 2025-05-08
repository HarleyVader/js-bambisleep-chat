import mongoose from 'mongoose';
import { withDbConnection } from '../config/db.js';
import Logger from '../utils/logger.js';

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
  // Reference to user (parent document)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
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
  xpHistory: [{
    timestamp: Date,
    amount: Number,
    source: String,
    description: String
  }],
  sessionHistories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SessionHistory'
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
      
      if (!this.triggerHistory) this.triggerHistory = [];
      
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
    if (!this.triggerHistory) this.triggerHistory = [];
    
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
  
  this.activeTriggers = activeTriggers;
};

// Add a method to update system controls
profileSchema.methods.updateSystemControls = function(controlsData) {
  if (!this.systemControls) this.systemControls = {};
  
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
    this.activeTriggers = controlsData.activeTriggers;
  }
};

// Add a method to add XP to the profile
profileSchema.methods.addXP = function(amount, source, description = '') {
  if (!amount || isNaN(amount)) return;
  
  this.xp += amount;
  this.level = 1 + Math.floor(Math.sqrt(this.xp / 100));
  
  if (!this.xpHistory) this.xpHistory = [];
  
  this.xpHistory.push({
    timestamp: new Date(),
    amount,
    source,
    description
  });
  
  if (this.xpHistory.length > 100) {
    this.xpHistory = this.xpHistory.slice(-100);
  }
};

// Add method to get XP required for next level
profileSchema.methods.getNextLevelXP = function() {
  return Math.pow(this.level, 2) * 100;
};

/**
 * Create profile for existing user
 */
profileSchema.statics.createForUser = async function(user) {
  return withDbConnection(async () => {
    try {
      // Check if profile already exists
      let profile = await this.findOne({ username: user.username });
      if (profile) return profile;
      
      // Create profile with reference to user
      profile = new this({
        user: user._id,
        username: user.username,
        activeTriggers: ["BAMBI SLEEP"],
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
      
      await profile.save();
      
      // Update user with reference to profile
      await User.findByIdAndUpdate(user._id, { profile: profile._id });
      
      return profile;
    } catch (error) {
      logger.error(`Error creating profile for user ${user.username}: ${error.message}`);
      throw error;
    }
  });
};

/**
 * Find profile by username
 */
profileSchema.statics.findByUsername = async function(username) {
  return withDbConnection(async () => {
    try {
      return await this.findOne({ username });
    } catch (error) {
      logger.error(`Error finding profile for ${username}: ${error.message}`);
      return null;
    }
  });
};

// Create the model
let Profile;
try {
  Profile = mongoose.model('Profile');
} catch (e) {
  Profile = mongoose.model('Profile', profileSchema);
}

/**
 * Get profile by username
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
 * Get or create profile by username
 */
export async function getOrCreateProfile(username) {
  return withDbConnection(async () => {
    try {
      // Find or create user first
      const user = await User.findOrCreateByUsername(username);
      if (!user) return null;
      
      // Then find or create profile
      let profile = await Profile.findOne({ username });
      
      if (!profile) {
        profile = await Profile.createForUser(user);
      }
      
      return profile;
    } catch (error) {
      logger.error(`Error in getOrCreateProfile: ${error.message}`);
      throw error;
    }
  });
}

/**
 * Update profile
 */
export async function updateProfile(username, updates) {
  return withDbConnection(async () => {
    try {
      return await Profile.findOneAndUpdate(
        { username },
        { ...updates, updatedAt: Date.now() },
        { new: true }
      );
    } catch (error) {
      logger.error(`Error updating profile for ${username}: ${error.message}`);
      throw error;
    }
  });
}

export { STANDARD_TRIGGERS };
export default Profile;