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

/**
 * Get a Mongoose model
 * Safely retrieves a model or creates it if it doesn't exist
 * 
 * @param {string} modelName - The name of the model to retrieve
 * @returns {mongoose.Model} - The Mongoose model
 */
export function getModel(modelName) {
  try {
    // Try to get an existing model first
    return mongoose.model(modelName);
  } catch (error) {
    // If the model doesn't exist, the error will indicate that
    logger.warning(`Model ${modelName} not found, it should be registered before use`);
    
    // Instead of throwing, return a simple placeholder model
    // This is a safety mechanism - proper models should be registered elsewhere
    const schema = new mongoose.Schema({}, { strict: false });
    return mongoose.model(modelName, schema);
  }
}

/**
 * Register a model with mongoose
 * 
 * @param {string} modelName - Name of the model
 * @param {mongoose.Schema} schema - Mongoose schema for the model
 * @returns {mongoose.Model} - The registered model
 */
export function registerModel(modelName, schema) {
  try {
    // Check if model already exists
    return mongoose.model(modelName);
  } catch (e) {
    // If not, register it
    return mongoose.model(modelName, schema);
  }
}

export { withDbConnection };
export default { connectDB, disconnectDB, withDbConnection, getModel, registerModel };