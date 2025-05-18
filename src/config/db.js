import mongoose from 'mongoose';
import Logger from '../utils/logger.js';

const logger = new Logger('Database');

// Track connection status
let isConnected = false;
let connectionPromise = null;

// Standardized connection options to use across the application
const DEFAULT_CONNECTION_OPTIONS = {
  serverSelectionTimeoutMS: 15000,    // Timeout for server selection (reduced to prevent long hangs)
  connectTimeoutMS: 30000,            // Timeout for initial connection (reduced)
  socketTimeoutMS: 45000,             // Timeout for operations (reduced)
  maxPoolSize: 10,                    // Connection pool size (reduced)
  minPoolSize: 2,                     // Minimum connections to maintain
  family: 4,                          // Use IPv4, skip trying IPv6
  autoIndex: true,                    // Build indexes
  maxIdleTimeMS: 60000,               // Close idle connections after 1 minute (reduced)
  retryWrites: true,                  // Auto-retry writes if they fail
  retryReads: true,                   // Auto-retry reads if they fail
  heartbeatFrequencyMS: 10000,        // More frequent heartbeats
};

// Fallback connection options for local database when primary is unavailable
const FALLBACK_CONNECTION_OPTIONS = {
  ...DEFAULT_CONNECTION_OPTIONS,
  serverSelectionTimeoutMS: 5000,     // Faster timeouts for local connection
  connectTimeoutMS: 10000,
  socketTimeoutMS: 15000
};

/**
 * Connect to MongoDB database
 * 
 * @param {number} retries - Number of connection retry attempts
 * @returns {Promise<boolean>} - True if connection successful
 */
export async function connectDB(retries = 3) {
  let currentAttempt = 1;
  const maxAttempts = retries + 1;
  
  while (currentAttempt <= maxAttempts) {
    try {
      const attemptStr = currentAttempt > 1 ? ` (attempt ${currentAttempt}/${maxAttempts})` : '';
      logger.info(`Connecting to MongoDB at ${getMongoUri()}${attemptStr}`);
      
      // Get connection string
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep';
      
      // Simplified connection options that work with newer MongoDB drivers
      const connectionOptions = {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 2,
        family: 4
      };
      
      await mongoose.connect(uri, connectionOptions);
      
      isConnected = true;
      logger.success('MongoDB connected');
      return true;
    } catch (error) {
      logger.error(`Database connection error: ${error.message}`);
      
      if (currentAttempt < maxAttempts) {
        const delay = currentAttempt * 2000;
        logger.info(`Retrying MongoDB connection in ${delay}ms (attempt ${currentAttempt + 1}/${maxAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        currentAttempt++;
      } else {
        logger.error(`Failed to connect to MongoDB after ${maxAttempts} attempts. Last error: ${error.message}`);
        return false;
      }
    }
  }
  
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