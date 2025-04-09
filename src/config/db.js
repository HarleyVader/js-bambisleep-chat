import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Logger } from '../utils/logger.js';

// Create a specialized logger for database operations
const logger = new Logger('Database');

dotenv.config();

// Get MongoDB URI from environment variables with fallbacks
export const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep';
export const profilesURI = `${process.env.MONGODB_URI}/bambisleep-profiles` || 'mongodb://localhost:27017/bambisleep-profiles';

/**
 * Connect to MongoDB database
 * @returns {Promise<mongoose.Connection>} Mongoose connection object
 */
export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(mongoURI);
    logger.success(`MongoDB Connected: ${conn.connection.host}`);
    return mongoose.connection;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Get the current mongoose connection
 * @returns {mongoose.Connection} Current mongoose connection
 */
export const getMongoConnection = () => mongoose.connection;

// Export connectDB as default for simpler imports
export default connectDB;