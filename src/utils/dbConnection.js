import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Logger from '../utils/logger.js';

// Initialize logger
const logger = new Logger('DatabaseConnection');

// Ensure environment variables are loaded
dotenv.config();

// Connection function with retry logic
const connectToMongoDB = async () => {
  try {
    logger.info('Connecting to MongoDB...');
    
    if (mongoose.connection.readyState === 1) {
      logger.info('Already connected to MongoDB');
      return mongoose.connection;
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    logger.success('MongoDB connected successfully');
    return mongoose.connection;
  } catch (error) {
    logger.error('MongoDB connection error:', error.message);
    logger.info('Retrying connection in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    return connectToMongoDB(); // Retry recursively
  }
};

export default connectToMongoDB;

// Export the connection
export const getMongoConnection = () => mongoose.connection;