import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Logger from '../utils/logger.js';
import { connectDB } from '../config/db.js';

// Initialize logger
const logger = new Logger('DatabaseConnection');

// Ensure environment variables are loaded
dotenv.config();

// Connection function with retry logic
const connectToMongoDB = async (maxRetries = 2) => {
  try {
    logger.info('Connecting to MongoDB...');
    
    if (mongoose.connection.readyState === 1) {
      logger.info('Already connected to MongoDB');
      return mongoose.connection;
    }
    
    // Use the main connectDB function from db.js instead of duplicating logic
    const connected = await connectDB(maxRetries);
    
    if (connected && mongoose.connection.readyState === 1) {
      logger.success('MongoDB connected successfully');
      return mongoose.connection;
    } else {
      throw new Error('Connection attempt returned but connection is not established');
    }
  } catch (error) {
    logger.error('MongoDB connection error:', error.message);
    return null; // Return null to indicate connection failure instead of infinite retries
  }
};

export default connectToMongoDB;