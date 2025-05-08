import mongoose from 'mongoose';
import Logger from '../utils/logger.js';
import dotenv from 'dotenv';

// Initialize logger
const logger = new Logger('Database');

// Ensure environment variables are loaded
dotenv.config();

// Track connection status
let isConnected = false;
let connectionPromise = null;

// Standardized connection options to use across the application
const DEFAULT_CONNECTION_OPTIONS = {
  serverSelectionTimeoutMS: 8000,     // Timeout for server selection
  connectTimeoutMS: 12000,            // Timeout for initial connection
  socketTimeoutMS: 60000,             // Timeout for operations
  maxPoolSize: 15,                    // Connection pool size
  minPoolSize: 3,                     // Minimum connections to maintain
  family: 4,                          // Use IPv4, skip trying IPv6
  autoIndex: true,                    // Build indexes
  maxIdleTimeMS: 120000               // Close idle connections after 2 minutes
};

/**
 * Initialize database connection with cached promise and retry logic
 * @param {number} retryAttempts - Number of retry attempts (default: 3)
 * @param {number} retryDelay - Delay between retries in ms (default: 3000)
 * @returns {Promise<boolean>} - True if connection successful
 */
export async function connectDB(retryAttempts = 3, retryDelay = 3000) {
  // If we're already connected, return immediately
  if (isConnected) {
    logger.debug('Using existing MongoDB connection');
    return true;
  }
  
  // If we're in the process of connecting, return the existing promise
  if (connectionPromise) {
    logger.debug('Connection in progress, waiting for completion');
    return connectionPromise;
  }

  let attempts = 0;

  const connect = async () => {
    try {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep';
      
      logger.info(`Connecting to MongoDB at ${mongoURI.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@')}`);
      
      // Create a promise for the connection and store it
      connectionPromise = mongoose.connect(mongoURI, DEFAULT_CONNECTION_OPTIONS);
      
      // Wait for connection
      await connectionPromise;
      
      // Mark as connected
      isConnected = true;
  
      // Set up connection event handlers - using once for initial setup to avoid duplicate handlers
      mongoose.connection.once('error', (err) => {
        logger.error(`MongoDB connection error: ${err.message}`);
        isConnected = false;
      });
      
      mongoose.connection.once('disconnected', () => {
        logger.warning('MongoDB disconnected');
        isConnected = false;
        connectionPromise = null;
      });
      
      mongoose.connection.once('reconnected', () => {
        logger.info('MongoDB reconnected');
        isConnected = true;
      });
      
      logger.success(`MongoDB connected: ${mongoose.connection.host}`);
      
      return true;
    } catch (error) {
      attempts++;
      logger.error(`Database connection error (attempt ${attempts}/${retryAttempts}): ${error.message}`);
      
      if (attempts < retryAttempts) {
        logger.info(`Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return connect();
      }
      
      isConnected = false;
      connectionPromise = null;
      return false;
    } finally {
      // Clear connectionPromise after connection attempt completes (success or failure)
      connectionPromise = null;
    }
  };

  return connect();
}

/**
 * Close database connection
 * @returns {Promise<void>}
 */
export async function disconnectDB() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      logger.info('Database disconnected');
      isConnected = false;
      connectionPromise = null;
    }
  } catch (error) {
    logger.error(`Error disconnecting from database: ${error.message}`);
  }
}

/**
 * Execute a database transaction with proper connection management
 * @param {Function} operation - Async function that performs the database operation
 * @param {Object} options - Options for the transaction
 * @returns {Promise<any>} - Result of the operation
 */
export async function withDbConnection(operation, options = {}) {
  const { 
    keepConnectionOpen = true,
    timeout = 30000,
    retries = 1
  } = options;
  
  // Check if already connected
  const wasConnected = isConnected || mongoose.connection.readyState === 1;
  
  // For retry logic
  let lastError = null;
  let attempt = 0;
  
  while (attempt <= retries) {
    try {
      // Only connect if not already connected
      if (!wasConnected && mongoose.connection.readyState !== 1) {
        logger.debug('Opening new MongoDB connection for operation');
        const connected = await connectDB();
        if (!connected) {
          throw new Error('Failed to establish database connection');
        }
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
      
      // Close connection if requested and wasn't connected before
      if (!keepConnectionOpen && !wasConnected) {
        await disconnectDB();
      }
      
      return result;
    } catch (error) {
      lastError = error;
      attempt++;
      
      if (attempt <= retries) {
        logger.warning(`Database operation failed, retrying (${attempt}/${retries}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        logger.error(`Database operation failed after ${retries} retries: ${error.message}`);
        throw error;
      }
    }
  }
}

/**
 * Get a Mongoose model
 * Safely retrieves a model or creates it if it doesn't exist
 * @param {string} modelName - The name of the model to retrieve
 * @returns {mongoose.Model} - The Mongoose model
 */
export function getModel(modelName) {
  try {
    // Try to get an existing model first
    return mongoose.model(modelName);
  } catch (error) {
    // If the model doesn't exist, log a warning
    logger.warning(`Model ${modelName} not found, attempting to load it dynamically`);
    
    // Try to import the model dynamically based on name
    try {
      // This is a safer approach than returning null
      const modelPath = `../models/${modelName}.js`;
      import(modelPath)
        .then(() => logger.info(`Dynamically loaded model: ${modelName}`))
        .catch(e => logger.error(`Failed to dynamically load model: ${modelName}`, e));
      
      // Try again after import attempt
      return mongoose.model(modelName);
    } catch (secondError) {
      logger.error(`Could not dynamically load model: ${modelName}`, secondError);
      throw new Error(`Model ${modelName} not found and could not be loaded dynamically`);
    }
  }
}

/**
 * Check the health of the database connection
 * @returns {Promise<Object>} Health check result
 */
export async function checkDBHealth() {
  try {
    await withDbConnection(async (conn) => {
      // Use a simpler ping approach that doesn't require admin privileges
      await conn.db.command({ ping: 1 });
    }, { timeout: 5000 });
    
    return {
      status: 'healthy',
      connected: isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      readyState: mongoose.connection?.readyState || 0
    };
  }
}

// Export as default object for convenience
export default { 
  connectDB, 
  disconnectDB, 
  withDbConnection, 
  getModel,
  checkDBHealth
};