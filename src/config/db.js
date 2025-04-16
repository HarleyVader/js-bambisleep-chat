import mongoose from 'mongoose';
import Logger from '../utils/logger.js';

const logger = new Logger('Database');

// Standardized connection options to use across the application
const DEFAULT_CONNECTION_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 2,
  family: 4        // Use IPv4, skip trying IPv6
};

/**
 * Initialize database connection
 * 
 * @returns {Promise<boolean>} - True if connection successful
 */
export async function connectDB() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep';
    
    logger.info(`Connecting to MongoDB at ${mongoURI.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@')}`);
    
    // Connect to MongoDB
    await mongoose.connect(mongoURI, DEFAULT_CONNECTION_OPTIONS);
    
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

/**
 * Executes a database operation with proper connection management
 * Opens a connection if needed, performs the operation, then optionally closes the connection
 * 
 * @param {Function} operation - Async function that performs the database operation
 * @param {Object} options - Options for the transaction
 * @param {boolean} options.keepConnectionOpen - If true, won't close connection after use (default: false)
 * @param {number} options.timeout - Timeout in ms for the operation (default: 30000)
 * @returns {Promise<any>} - Result of the operation
 */
export async function withDbConnection(operation, options = {}) {
  const { keepConnectionOpen = false, timeout = 30000 } = options;
  
  // Check if already connected
  const wasConnected = mongoose.connection.readyState === 1;
  
  try {
    // Only connect if not already connected
    if (!wasConnected) {
      logger.debug('Opening new MongoDB connection for operation');
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep', 
        DEFAULT_CONNECTION_OPTIONS
      );
    } else {
      logger.debug('Using existing MongoDB connection');
    }
    
    // Execute operation with timeout
    const result = await Promise.race([
      operation(mongoose.connection),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Database operation timed out after ${timeout}ms`)), timeout)
      )
    ]);
    
    return result;
  } catch (error) {
    logger.error(`Database operation error: ${error.message}`);
    throw error;
  } finally {
    // Only close if we opened a new connection AND we're not keeping it open
    if (!wasConnected && !keepConnectionOpen) {
      logger.debug('Closing MongoDB connection after operation');
      try {
        await mongoose.disconnect();
        logger.debug('MongoDB connection closed successfully');
      } catch (closeError) {
        logger.error(`Error closing MongoDB connection: ${closeError.message}`);
      }
    }
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

// Export as default object for convenience
export default { 
  connectDB, 
  disconnectDB, 
  withDbConnection, 
  getModel 
};