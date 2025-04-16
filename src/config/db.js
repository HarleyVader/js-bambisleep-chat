import mongoose from 'mongoose';
import config from './config.js';
import Logger from '../utils/logger.js';
import connectToMongoDB, { withDbConnection } from './dbConnection.js';

const logger = new Logger('Database');

/**
 * Initialize database connection
 * 
 * @returns {Promise<boolean>} - True if connection successful
 */
export async function connectDB() {
  try {
    await connectToMongoDB();
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

export { withDbConnection };
export default { connectDB, disconnectDB, withDbConnection };