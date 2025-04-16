import mongoose from 'mongoose';
import { withDbConnection } from '../config/db.js';
import Logger from '../utils/logger.js';

const logger = new Logger('Profile');

const profileSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  activeTriggers: {
    type: [String],
    default: []
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

profileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Define model outside the function to maintain schema consistency
const Profile = mongoose.model('Profile', profileSchema);

/**
 * Get profile by username
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
 * Update profile
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

export default Profile;