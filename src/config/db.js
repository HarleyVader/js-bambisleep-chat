import mongoose from 'mongoose';
import Logger from '../utils/logger.js';

const logger = new Logger('Database');

// Track connection status
let isConnected = false;
let connectionPromise = null;

// Standardized connection options to use across the application
const DEFAULT_CONNECTION_OPTIONS = {
  serverSelectionTimeoutMS: 30000,    // Timeout for server selection (increased from 20000)
  connectTimeoutMS: 45000,            // Timeout for initial connection (increased from 30000)
  socketTimeoutMS: 90000,             // Timeout for operations (increased from 60000)
  maxPoolSize: 15,                    // Connection pool size
  minPoolSize: 3,                     // Minimum connections to maintain
  family: 4,                          // Use IPv4, skip trying IPv6
  autoIndex: true,                    // Build indexes
  maxIdleTimeMS: 120000,              // Close idle connections after 2 minutes
  retryWrites: true,                  // Auto-retry writes if they fail
  retryReads: true                    // Auto-retry reads if they fail
};

/**
 * Initialize database connection with cached promise
 * 
 * @returns {Promise<boolean>} - True if connection successful
 */
export async function connectDB(maxRetries = 3) {
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
  
  let retryCount = 0;
  let lastError = null;
  
  while (retryCount <= maxRetries) {
    try {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep';
      
      logger.info(`Connecting to MongoDB at ${mongoURI.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@')}${retryCount > 0 ? ` (attempt ${retryCount+1}/${maxRetries+1})` : ''}`);
      
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
      
      // Clear connectionPromise after successful connection
      connectionPromise = null;
      return true;
    } catch (error) {
      lastError = error;
      // More detailed error logging based on error type
      if (error.name === 'MongoServerSelectionError') {
        logger.error(`MongoDB server selection error: ${error.message}`);
        logger.debug(`Connection details: ${JSON.stringify(error.reason || {})}`);
      } else {
        logger.error(`Database connection error: ${error.message}`);
      }
      
      // Increment retry count
      retryCount++;
      
      // Clear connectionPromise to allow new connection attempts
      connectionPromise = null;
      isConnected = false;
      
      // If we have retries left, wait before retrying with exponential backoff
      if (retryCount <= maxRetries) {
        const delay = Math.min(2000 * retryCount, 10000); // Exponential backoff with cap
        logger.info(`Retrying MongoDB connection in ${delay}ms (attempt ${retryCount+1}/${maxRetries+1})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we've exhausted all retries, log a final error and return false
  logger.error(`Failed to connect to MongoDB after ${maxRetries+1} attempts. Last error: ${lastError?.message}`);
  return false;
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
      isConnected = false;
      connectionPromise = null;
    }
  } catch (error) {
    logger.error(`Error disconnecting from database: ${error.message}`);
  }
}

/**
 * Executes a database operation with proper connection management
 * Important: This is a key function that handles database operations safely
 * 
 * @param {Function} operation - Async function that performs the database operation
 * @param {Object} options - Options for the transaction
 * @param {boolean} options.keepConnectionOpen - If true, won't close connection after use (default: true)
 * @param {number} options.timeout - Timeout in ms for the operation (default: 30000)
 * @param {number} options.retries - Number of retries for failed operations (default: 1)
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
      
      // Don't close connection if it was already open or keepConnectionOpen is true
      if (!wasConnected && !keepConnectionOpen) {
        await disconnectDB();
      }
      
      return result;
    } catch (error) {
      lastError = error;
      attempt++;
      
      // Log the error with try count
      logger.error(`Database operation error (attempt ${attempt}/${retries + 1}): ${error.message}`);
      
      // If we have retries left, wait before retrying
      if (attempt <= retries) {
        const delay = Math.min(1000 * attempt, 5000); // Exponential backoff with 5s cap
        logger.info(`Retrying operation in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we got here, all attempts failed
  throw lastError;
}

/**
 * Ensure all models are registered
 * Call this function at application startup to guarantee models are ready before routes
 * 
 * @returns {Promise<void>}
 */
export async function ensureModelsRegistered() {
  try {
    // Import models explicitly to ensure they're registered
    await import('../models/SessionHistory.js');
    
    // You can add other model imports here as needed
    // await import('../models/Profile.js');
    
    logger.info('All models registered successfully');
  } catch (error) {
    logger.error(`Error registering models: ${error.message}`);
    throw error;
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
      logger.error(`Could not retrieve or load model ${modelName}: ${secondError.message}`);
      return null;
    }
  }
}

/**
 * Check the health of the database connection
 * 
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
  ensureModelsRegistered,
  getModel,
  checkDBHealth
};