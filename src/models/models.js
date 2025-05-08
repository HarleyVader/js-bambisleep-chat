/**
 * Central model exports to avoid circular dependencies
 * This file solves the Linux case-sensitivity issue by providing a single entry point
 */
import mongoose from 'mongoose';
import crypto from 'crypto';
import { withDbConnection } from '../config/db.js';
import Logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logger
const logger = new Logger('ModelsLoader');

// Standard BambiSleep triggers
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

// === USER SCHEMA ===
const userSchema = new mongoose.Schema({
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
  cookie: {
    type: String,
    unique: true,
    sparse: true
  },
  cookieName: {
    type: String,
    trim: true,
    index: true
  },
  avatar: {
    type: String,
    default: '/gif/default-avatar.gif'
  },
  preferences: {
    theme: {
      type: String,
      default: 'dark'
    },
    notifications: {
      type: Boolean,
      default: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  profile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profile'
  }
}, { 
  timestamps: true 
});

// Update timestamps before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to find a user by cookie name
userSchema.statics.findByCookieName = async function(cookieName) {
  return withDbConnection(async () => {
    return this.findOne({ cookieName });
  });
};

// Find or create a user by cookie
userSchema.statics.findOrCreateByCookie = async function(cookie) {
  if (!cookie) {
    cookie = crypto.randomBytes(32).toString('hex');
  }
  
  return withDbConnection(async () => {
    try {
      let user = await this.findOne({ cookie });
      
      if (!user) {
        const username = `anonBambi_${Date.now().toString(36)}`;
        logger.info(`Creating new anonymous user: ${username}`);
        
        user = await this.create({
          username,
          displayName: username,
          cookie,
          preferences: { theme: 'dark' }
        });
      }
      
      return user;
    } catch (error) {
      logger.error(`Error in findOrCreateByCookie: ${error.message}`);
      return {
        username: 'anonBambi',
        preferences: { theme: 'dark' }
      };
    }
  });
};

// Find or create a user by username
userSchema.statics.findOrCreateByUsername = async function(username) {
  try {
    let user = await this.findOne({ username });
    
    if (!user) {
      user = new this({
        username,
        createdAt: new Date(),
        level: 1,
        xp: 0
      });
      await user.save();
    }
    
    return user;
  } catch (error) {
    throw new Error(`Failed to find or create user: ${error.message}`);
  }
};

// Static method to get user by username
userSchema.statics.getUserByUsername = async function(username) {
  try {
    return await this.findOne({ username });
  } catch (error) {
    throw new Error(`Failed to find user by username: ${error.message}`);
  }
};

// Create model after adding statics
const User = mongoose.model('User', userSchema);

// === PROFILE SCHEMA ===
const profileSchema = new mongoose.Schema({
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
  systemControls: {
    collarText: {
      type: String,
      default: ''
    },
    collarEnabled: {
      type: Boolean,
      default: false
    },
    activeTriggers: [String]
  },
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

// Toggle trigger methods
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
    }
    
    this.updateActiveTriggerSession();
    return true;
  }
  
  return false;
};

profileSchema.methods.updateActiveTriggerSession = function() {
  const activeTriggers = this.triggers.filter(trigger => trigger.active).map(t => t.name);
  
  if (!this.activeTriggerSession) {
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

// Add static method to find or create profile by username
profileSchema.statics.findOrCreateByUsername = async function(username) {
  try {
    // First try to find an existing profile
    let profile = await this.findOne({ username });
    
    // If no profile exists, create one with defaults
    if (!profile) {
      // Get or create the user first
      const User = mongoose.model('User');
      const user = await User.findOrCreateByUsername(username);
      
      // Create basic profile with minimal settings
      profile = new this({
        user: user._id,
        username,
        activeTriggers: ['BAMBI SLEEP'],
        triggers: [{ 
          name: 'BAMBI SLEEP', 
          active: true, 
          description: 'Default trigger for all bambis' 
        }],
        systemControls: {
          activeTriggers: ['BAMBI SLEEP'],
          collarEnabled: false,
          collarText: ''
        }
      });
      
      await profile.save();
      
      // Update user with profile reference
      user.profile = profile._id;
      await user.save();
    }
    
    return profile;
  } catch (error) {
    console.error(`Error in findOrCreateByUsername: ${error}`);
    throw error;
  }
};

// === CHAT MESSAGE SCHEMA ===
const chatMessageSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    default: 'anonymous'
  },
  data: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Enhanced message retrieval with better debugging
chatMessageSchema.statics.getRecentMessages = async function(limit = 50) {
  logger.info(`Attempting to retrieve ${limit} recent messages from database`);
  try {
    return withDbConnection(async () => {
      // Track performance of database query
      const startTime = Date.now();
      
      // Get the most recent messages by sorting in descending order (-1)
      const messages = await this.find({})
        .sort({ timestamp: -1 }) 
        .limit(limit)
        .lean();
      
      const queryTime = Date.now() - startTime;
      logger.info(`Retrieved ${messages.length} messages in ${queryTime}ms`);
      
      // Send in chronological order (oldest first)
      return messages.reverse();
    });
  } catch (error) {
    logger.error(`Error retrieving chat messages: ${error.message}`);
    return [];
  }
};

// Add static method to ChatMessage model
chatMessageSchema.statics.saveMessage = async function(messageData) {
  try {
    const newMessage = new this(messageData);
    return await newMessage.save();
  } catch (error) {
    throw new Error(`Failed to save chat message: ${error.message}`);
  }
};

chatMessageSchema.statics.getRecentMessages = async function(limit) {
  try {
    return await this.find()
      .sort({ timestamp: -1 })
      .limit(limit || 100);
  } catch (error) {
    throw new Error(`Failed to retrieve recent messages: ${error.message}`);
  }
};

// === SESSION HISTORY SCHEMA ===
const sessionHistorySchema = new mongoose.Schema({
  username: { type: String, required: true, index: true },
  socketId: { type: String, required: true },
  title: { type: String, default: 'Untitled Session' },
  shareToken: { type: String, unique: true, sparse: true },
  messages: [{
    role: String,
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  metadata: {
    createdAt: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now },
    triggers: [String],
    collarActive: Boolean,
    collarText: String,
    spiralSettings: Object
  },
  activeTriggers: [String],
  collarSettings: {
    enabled: Boolean,
    text: String
  },
  spiralSettings: {
    enabled: Boolean,
    spiral1Width: Number,
    spiral2Width: Number,
    spiral1Speed: Number,
    spiral2Speed: Number
  }
}, { timestamps: true });

// Add indexes explicitly to avoid duplication
sessionHistorySchema.index({ 'metadata.createdAt': -1 });
sessionHistorySchema.index({ title: 'text' }); // Text index for title search

// Add instance methods for session data
sessionHistorySchema.methods = {
  // Update last activity timestamp
  updateActivity() {
    this.metadata.lastActivity = new Date();
    return this.save();
  },
  
  // Update session settings
  updateSettings(settings) {
    // Update trigger settings
    if (settings.activeTriggers) {
      this.activeTriggers = settings.activeTriggers;
      this.metadata.triggers = settings.activeTriggers;
    }
    
    // Update collar settings
    if (settings.collarSettings) {
      this.collarSettings = settings.collarSettings;
      this.metadata.collarActive = settings.collarSettings.enabled;
      this.metadata.collarText = settings.collarSettings.text;
    }
    
    // Update spiral settings
    if (settings.spiralSettings) {
      this.spiralSettings = settings.spiralSettings;
      this.metadata.spiralSettings = settings.spiralSettings;
    }
    
    // Update title if provided
    if (settings.title) {
      this.title = settings.title;
    }
    
    this.metadata.lastActivity = new Date();
    return this.save();
  },
  
  // Remove a message by its index
  removeMessage(index) {
    if (index >= 0 && index < this.messages.length) {
      this.messages.splice(index, 1);
      this.metadata.lastActivity = new Date();
      return this.save();
    }
    return Promise.resolve(this);
  }
};

// Add static methods for common queries
sessionHistorySchema.statics = {
  // Find sessions by username
  findByUsername(username, options = {}) {
    const { limit = 20, skip = 0, sort = { 'metadata.createdAt': -1 } } = options;
    
    return this.find({ username })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .exec();
  },
  
  // Find session by share token
  findByShareToken(token) {
    return this.findOne({ shareToken: token }).exec();
  },
  
  // Get recent sessions
  findRecentSessions(username, limit = 5) {
    return this.find({ username })
      .sort({ 'metadata.lastActivity': -1 })
      .limit(limit)
      .exec();
  },
  
  // Create new session with defaults
  createSession(data) {
    return this.create({
      username: data.username,
      socketId: data.socketId,
      title: data.title || `Session ${new Date().toLocaleString()}`,
      messages: data.messages || [],
      metadata: {
        createdAt: new Date(),
        lastActivity: new Date(),
        triggers: data.triggers || [],
        collarActive: data.collarActive || false,
        collarText: data.collarText || '',
        spiralSettings: data.spiralSettings || {}
      },
      activeTriggers: data.activeTriggers || data.triggers || [],
      collarSettings: {
        enabled: data.collarActive || false,
        text: data.collarText || ''
      },
      spiralSettings: data.spiralSettings || {
        enabled: false,
        spiral1Width: 5,
        spiral2Width: 3,
        spiral1Speed: 20,
        spiral2Speed: 15
      }
    });
  }
};

// === SCRAPER SCHEMA ===
const scraperSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video'],
    required: true
  },
  bambiname: {
    type: String,
    default: 'Anonymous Bambi'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  upvotes: {
    type: Number,
    default: 0
  },
  downvotes: {
    type: Number,
    default: 0
  },
  comments: [{
    bambiname: String,
    text: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  results: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

// Add helper methods for common operations
scraperSchema.methods.updateStatus = function(status) {
  this.status = status;
  return this.save();
};

scraperSchema.methods.addComment = function(bambiname, text) {
  this.comments.push({
    bambiname,
    text,
    date: new Date()
  });
  return this.save();
};

scraperSchema.methods.vote = function(isUpvote) {
  if (isUpvote) {
    this.upvotes += 1;
  } else {
    this.downvotes += 1;
  }
  return this.save();
};

// Static methods
scraperSchema.statics.findByBambiname = function(bambiname) {
  return this.find({ bambiname });
};

scraperSchema.statics.findByStatus = function(status) {
  return this.find({ status });
};

// Create and export model
let Scraper;
try {
  // Try to get existing model
  Scraper = mongoose.model('Scraper');
  logger.info('Using existing Scraper model');
} catch (e) {
  // Create new model if it doesn't exist
  Scraper = mongoose.model('Scraper', scraperSchema);
  logger.info('Created new Scraper model');
}

// Create model instances
let Profile, ChatMessage, SessionHistory;

// Initialize models
function initModels() {
  // Profile model
  try {
    Profile = mongoose.model('Profile');
  } catch (e) {
    Profile = mongoose.model('Profile', profileSchema);
  }

  // ChatMessage model
  try {
    ChatMessage = mongoose.model('ChatMessage');
  } catch (e) {
    ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
  }

  // SessionHistory model
  try {
    SessionHistory = mongoose.model('SessionHistory');
  } catch (e) {
    SessionHistory = mongoose.model('SessionHistory', sessionHistorySchema);
  }

  logger.info('All models initialized successfully');
  return { User, Profile, ChatMessage, SessionHistory, Scraper };
}

// === USER FUNCTIONS ===
async function getUser(username) {
  return withDbConnection(async () => {
    try {
      return await User.findOne({ username });
    } catch (error) {
      logger.error(`Error getting user ${username}: ${error.message}`);
      return null;
    }
  });
}

async function updateUser(username, updates) {
  return withDbConnection(async () => {
    try {
      return await User.findOneAndUpdate(
        { username },
        updates,
        { new: true }
      );
    } catch (error) {
      logger.error(`Error updating user ${username}: ${error.message}`);
      throw error;
    }
  });
}

// === PROFILE FUNCTIONS ===
async function getProfile(username) {
  return withDbConnection(async () => {
    try {
      return await Profile.findOne({ username });
    } catch (error) {
      logger.error(`Error getting profile for ${username}: ${error.message}`);
      return null;
    }
  });
}

async function getOrCreateProfile(username) {
  return withDbConnection(async () => {
    try {
      // First find the user
      const user = await User.findOne({ username });
      if (!user) return null;
      
      // Then find or create profile
      let profile = await Profile.findOne({ username });
      
      if (!profile) {
        profile = new Profile({
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
        user.profile = profile._id;
        await user.save();
      }
      
      return profile;
    } catch (error) {
      logger.error(`Error in getOrCreateProfile: ${error.message}`);
      throw error;
    }
  });
}

async function updateProfile(username, updates) {
  return withDbConnection(async () => {
    try {
      return await Profile.findOneAndUpdate(
        { username },
        updates,
        { new: true }
      );
    } catch (error) {
      logger.error(`Error updating profile for ${username}: ${error.message}`);
      throw error;
    }
  });
}

// Initialize all models
initModels();

// Export models and functions
export {
  User,
  Profile,
  ChatMessage,
  SessionHistory,
  Scraper,
  getUser,
  updateUser,
  getProfile,
  getOrCreateProfile,
  updateProfile,
  STANDARD_TRIGGERS
};

// Backward compatibility
export const getUserByUsername = getUser;
export const updateUserProfile = updateUser;
export default Scraper;