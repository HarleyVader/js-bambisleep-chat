/**
 * User Model for BambiSleep Chat
 * Handles user authentication and profile data
 */
import mongoose from 'mongoose';
import { withDbConnection } from '../config/db.js';
import Logger from '../utils/logger.js';
import crypto from 'crypto';

const logger = new Logger('UserModel');

// Define schema
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
  xp: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  sessions: [{
    name: String,
    description: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    triggers: [String],
    settings: mongoose.Schema.Types.Mixed
  }],
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
  }
}, { 
  timestamps: true 
});

// Update timestamps before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add XP and handle level-up if necessary
userSchema.methods.addXP = function(amount, source = 'activity') {
  if (!amount || isNaN(amount)) return;
  
  // Add to total XP
  this.xp += amount;
  
  // Calculate level based on XP
  // Formula: level = 1 + floor(sqrt(xp / 100))
  this.level = 1 + Math.floor(Math.sqrt(this.xp / 100));
  
  return {
    level: this.level,
    xp: this.xp
  };
};

// Get XP needed for next level
userSchema.methods.getNextLevelXP = function() {
  return Math.pow(this.level, 2) * 100;
};

// Static method to find a user by cookie name
userSchema.statics.findByCookieName = async function(cookieName) {
  return withDbConnection(async () => {
    return this.findOne({ cookieName });
  });
};

/**
 * Find or create a user by cookie
 * Uses a transaction to ensure proper connection handling
 */
userSchema.statics.findOrCreateByCookie = async function(cookie) {
  if (!cookie) {
    // Generate a random cookie if none provided
    cookie = crypto.randomBytes(32).toString('hex');
  }
  
  return withDbConnection(async () => {
    try {
      // Try to find user by cookie
      let user = await this.findOne({ cookie });
      
      // If not found, create a new anonymous user
      if (!user) {
        const username = `anonBambi_${Date.now().toString(36)}`;
        logger.info(`Creating new anonymous user for cookie: ${cookie.substring(0, 8)}...`);
        
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
      
      // In case of error, return a temporary user object
      return {
        username: 'anonBambi',
        preferences: { theme: 'dark' },
        xp: 0,
        level: 1
      };
    }
  });
};

/**
 * Find or create a user by username
 */
userSchema.statics.findOrCreateByUsername = async function(username) {
  if (!username) return null;
  
  return withDbConnection(async () => {
    try {
      // Try to find existing user
      let user = await this.findOne({ username });
      
      // If user exists, return it
      if (user) {
        return user;
      }
      
      // Otherwise create a new one
      user = new this({
        username,
        displayName: username,
        level: 1,
        xp: 0
      });
      
      await user.save();
      return user;
    } catch (error) {
      if (error.code === 11000) {
        // Handle race condition where user was created between our check and save
        return await this.findOne({ username });
      }
      logger.error(`Error in findOrCreateByUsername: ${error.message}`);
      throw error;
    }
  });
};

// Static methods to find user by various criteria
userSchema.statics.getUserByUsername = async function(username) {
  return withDbConnection(async () => {
    try {
      return await this.findOne({ username });
    } catch (error) {
      logger.error(`Error getting user for ${username}: ${error.message}`);
      return null;
    }
  });
};

userSchema.statics.updateUserProfile = async function(username, updates) {
  return withDbConnection(async () => {
    try {
      return await this.findOneAndUpdate(
        { username },
        updates,
        { new: true, upsert: false }
      );
    } catch (error) {
      logger.error(`Error updating user for ${username}: ${error.message}`);
      throw error;
    }
  });
};

// Create the model
let User;
try {
  // Try to get the existing model first
  User = mongoose.model('User');
} catch (e) {
  // If it doesn't exist, create it
  User = mongoose.model('User', userSchema);
}

/**
 * Get user by username with proper connection management
 */
export async function getUser(username) {
  return withDbConnection(async () => {
    try {
      return await User.findOne({ username });
    } catch (error) {
      logger.error(`Error getting user for ${username}: ${error.message}`);
      return null;
    }
  });
}

/**
 * Update user with proper connection management
 */
export async function updateUser(username, updates) {
  return withDbConnection(async () => {
    try {
      return await User.findOneAndUpdate(
        { username },
        updates,
        { new: true, upsert: false }
      );
    } catch (error) {
      logger.error(`Error updating user for ${username}: ${error.message}`);
      throw error;
    }
  });
}

export { User, getUser, updateUser };

// Also add these for backward compatibility
export const getUserByUsername = getUser;
export const updateUserProfile = updateUser;