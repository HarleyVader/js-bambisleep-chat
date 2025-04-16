import mongoose from 'mongoose';
import config from './config.js';
import connectToMongoDB from './dbConnection.js';
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

/**
 * Executes a database transaction with proper connection management
 * Opens a connection, performs the operation, then closes the connection
 * 
 * @param {Function} operation - Async function that performs the database operation
 * @param {Object} options - Options for the transaction
 * @param {boolean} options.useExistingConnection - If true, won't close connection after use (default: false)
 * @param {number} options.timeout - Timeout in ms for the operation (default: 30000)
 * @returns {Promise<any>} - Result of the operation
 */
export async function withDbConnection(operation, options = {}) {
  const { useExistingConnection = false, timeout = 30000 } = options;
  
  // Check if already connected
  const wasConnected = mongoose.connection.readyState === 1;
  let connection;
  
  try {
    // Only connect if not already connected or if we're forcing a new connection
    if (!wasConnected) {
      logger.debug('Opening new MongoDB connection for transaction');
      connection = await connectToMongoDB();
    } else {
      logger.debug('Using existing MongoDB connection');
      connection = mongoose.connection;
    }
    
    // Execute operation with timeout
    const result = await Promise.race([
      operation(connection),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Database operation timed out after ${timeout}ms`)), timeout)
      )
    ]);
    
    return result;
  } catch (error) {
    logger.error(`Database transaction error: ${error.message}`);
    throw error;
  } finally {
    // Only close if we opened a new connection and we're not keeping it open
    if (!wasConnected && !useExistingConnection) {
      logger.debug('Closing MongoDB connection after transaction');
      try {
        await mongoose.disconnect();
        logger.debug('MongoDB connection closed successfully');
      } catch (closeError) {
        logger.error(`Error closing MongoDB connection: ${closeError.message}`);
      }
    }
  }
}

export default { connectDB, getModel, closeConnections, withDbConnection };