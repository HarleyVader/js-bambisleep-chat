import mongoose from 'mongoose';
import config from './config.js';
import Logger from '../utils/logger.js';

const logger = new Logger('Database');

/**
 * Connects to MongoDB using the configured URI
 * @returns {Promise} Mongoose connection promise
 */
export async function connectDB() {
  try {
    // Use MONGODB_URI instead of MONGO_URI
    await mongoose.connect(config.MONGODB_URI, {
      // MongoDB connection options
    });
    
    logger.success('MongoDB connection established');
    return mongoose.connection;
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    throw error; // Re-throw to allow server to handle it
  }
}

/**
 * Gets a model by name
 * @param {string} modelName - Name of the model to retrieve
 * @returns {mongoose.Model} Mongoose model
 */
export function getModel(modelName) {
  try {
    return mongoose.model(modelName);
  } catch (error) {
    logger.error(`Error getting model ${modelName}: ${error.message}`);
    throw error;
  }
}

/**
 * Gracefully close database connections
 * @returns {Promise} Mongoose disconnect promise
 */
export async function closeConnections() {
  try {
    logger.info('Closing database connections...');
    await mongoose.disconnect();
    logger.success('Database connections closed');
  } catch (error) {
    logger.error(`Error closing database connections: ${error.message}`);
    // Still resolve as we're shutting down anyway
  }
}

export default { connectDB, getModel, closeConnections };