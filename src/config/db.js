import mongoose from 'mongoose';
import Logger from '../utils/logger.js';

const logger = new Logger('Database');

// Track connection status
let isConnected = false;
let connectionPromise = null;

// Standardized connection options to use across the application
const DEFAULT_CONNECTION_OPTIONS = {
  serverSelectionTimeoutMS: 8000,     // Increased from 5000
  connectTimeoutMS: 12000,            // Increased from 10000
  socketTimeoutMS: 60000,             // Increased from 45000
  maxPoolSize: 15,                    // Increased from 10
  minPoolSize: 3,                     // Increased from 2
  family: 4,                          // Use IPv4, skip trying IPv6
  autoIndex: true,                    // Build indexes
  keepAlive: true,                    // Keep connection alive
  maxIdleTimeMS: 120000               // Close idle connections after 2 minutes
};

/**
 * Initialize database connection with cached promise
 * 
 * @returns {Promise<boolean>} - True if connection successful
 */
export async function connectDB() {
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
  
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep';
    
    logger.info(`Connecting to MongoDB at ${mongoURI.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@')}`);
    
    // Create a promise for the connection and store it
    connectionPromise = mongoose.connect(mongoURI, DEFAULT_CONNECTION_OPTIONS);
    
    // Wait for connection
    await connectionPromise;
    
    // Mark as connected
    isConnected = true;
    
    // Set up connection event handlers
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
      isConnected = false;
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warning('MongoDB disconnected');
      isConnected = false;
      connectionPromise = null;
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      isConnected = true;
    });
    
    logger.success(`MongoDB connected: ${mongoose.connection.host}`);
    
    return true;
  } catch (error) {
    logger.error(`Database connection error: ${error.message}`);
    isConnected = false;
    connectionPromise = null;
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
      isConnected = false;
      connectionPromise = null;
    }
  } catch (error) {
    logger.error(`Error disconnecting from database: ${error.message}`);
  }
}

/**
 * Executes a database operation with proper connection management
 * Reuses connections when possible for better performance
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
    keepConnectionOpen = true,  // Changed default to true for better performance
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
      if (!wasConnected) {
        logger.debug('Opening new MongoDB connection for operation');
        await connectDB();
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
 * Check the health of the database connection
 * 
 * @returns {Promise<Object>} Health check result
 */
export async function checkDBHealth() {
  try {
    await withDbConnection(async (conn) => {
      // Simple ping to check connection
      await conn.db.admin().ping();
    });
    
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