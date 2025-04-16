import mongoose from 'mongoose';
import Logger from '../utils/logger.js';
import { withDbConnection, getModel } from '../utils/dbTransaction.js';

const logger = new Logger('Database');

/**
 * Initialize database connection
 * 
 * @returns {Promise<boolean>} - True if connection successful
 */
export async function connectDB() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep';
    
    logger.info(`Connecting to MongoDB at ${mongoURI.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@')}`);
    
    // Connection options with poolSize
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10, // Set the connection pool size
      minPoolSize: 2,  // Keep at least 2 connections
      family: 4        // Use IPv4, skip trying IPv6
    };
    
    // Connect to MongoDB
    await mongoose.connect(mongoURI, options);
    
    // Set up connection event handlers
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warning('MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
    
    logger.success(`MongoDB connected: ${mongoose.connection.host}`);
    
    return true;
  } catch (error) {
    logger.error(`Database connection error: ${error.message}`);
    return false;
  }
}

/**
 * Close database connection
 * 
 * @returns {Promise<void>}
 */
export async function disconnectDB() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      logger.info('Database disconnected');
    }
  } catch (error) {
    logger.error(`Error disconnecting from database: ${error.message}`);
  }
}

// Re-export these functions for use elsewhere
export { withDbConnection, getModel };
export default { connectDB, disconnectDB, withDbConnection, getModel };