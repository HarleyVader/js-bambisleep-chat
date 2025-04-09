import mongoose from 'mongoose';
import User from '../models/User.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('DbManager');

export class DbManager {
  /**
   * Find a user by their ID
   * @param {string} userId - The user's ID
   * @returns {Promise<Object>} User document
   */
  async findUser(userId) {
    try {
      const user = await User.findById(userId);
      return user;
    } catch (error) {
      logger.error(`Error finding user: ${error.message}`);
      throw new Error(`Error finding user: ${error.message}`);
    }
  }

  /**
   * Save a new user to the database
   * @param {Object} userData - User data to save
   * @returns {Promise<Object>} Saved user document
   */
  async saveUser(userData) {
    try {
      const user = new User(userData);
      await user.save();
      logger.success(`User saved: ${user._id}`);
      return user;
    } catch (error) {
      logger.error(`Error saving user: ${error.message}`);
      throw new Error(`Error saving user: ${error.message}`);
    }
  }

  /**
   * Get all users from the database
   * @returns {Promise<Array>} Array of user documents
   */
  async getAllUsers() {
    try {
      const users = await User.find();
      logger.info(`Retrieved ${users.length} users`);
      return users;
    } catch (error) {
      logger.error(`Error retrieving users: ${error.message}`);
      throw new Error(`Error retrieving users: ${error.message}`);
    }
  }
}

/**
 * Connect to MongoDB
 * @returns {Promise<Object>} MongoDB connection
 */
export async function connectToMongoDB() {
  try {
    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep';
    
    await mongoose.connect(MONGO_URI)
      .then(() => {
        console.log('Successfully connected to MongoDB');
      })
      .catch(err => {
        console.error('MongoDB connection error:', err);
      });
    
    return mongoose.connection;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

export default DbManager;