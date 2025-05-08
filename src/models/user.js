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
  // Authentication fields
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
  // Reference to profile
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

/**
 * Find or create a user by cookie
 */
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

/**
 * Find or create a user by username
 */
userSchema.statics.findOrCreateByUsername = async function(username) {
  if (!username) return null;
  
  return withDbConnection(async () => {
    try {
      let user = await this.findOne({ username });
      
      if (user) return user;
      
      user = new this({
        username,
        displayName: username
      });
      
      await user.save();
      return user;
    } catch (error) {
      if (error.code === 11000) {
        return await this.findOne({ username });
      }
      logger.error(`Error in findOrCreateByUsername: ${error.message}`);
      throw error;
    }
  });
};

// Create the model
let User;
try {
  User = mongoose.model('User');
} catch (e) {
  User = mongoose.model('User', userSchema);
}

/**
 * Get user by username with database connection handling
 */
export async function getUser(username) {
  return withDbConnection(async () => {
    try {
      return await User.findOne({ username });
    } catch (error) {
      logger.error(`Error getting user ${username}: ${error.message}`);
      return null;
    }
  });
}

/**
 * Update user with database connection handling
 */
export async function updateUser(username, updates) {
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

export { User };

// Backward compatibility
export const getUserByUsername = getUser;
export const updateUserProfile = updateUser;