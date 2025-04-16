import mongoose from 'mongoose';
import Logger from './logger.js';

const logger = new Logger('DBTransaction');

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
  
  try {
    // Only connect if not already connected or if we're forcing a new connection
    if (!wasConnected) {
      logger.debug('Opening new MongoDB connection for transaction');
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4 // Use IPv4, skip trying IPv6
      });
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

/**
 * Safely execute a database operation that will be retried on failure
 * 
 * @param {Function} operation - The database operation to execute
 * @param {Object} options - Options for the retries
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay between retries in ms (default: 1000)
 * @param {boolean} options.useExistingConnection - If true, won't close connection after use (default: false)
 * @returns {Promise<any>} - Result of the operation
 */
export async function withRetry(operation, options = {}) {
  const { maxRetries = 3, initialDelay = 1000, useExistingConnection = false } = options;
  let retries = 0;
  let lastError;
  
  while (retries <= maxRetries) {
    try {
      return await withDbConnection(operation, { useExistingConnection });
    } catch (error) {
      lastError = error;
      
      // Certain errors should not be retried
      if (error.name === 'ValidationError' || error.code === 11000) {
        // Validation errors or duplicate key errors - retrying won't help
        throw error;
      }
      
      retries++;
      
      if (retries > maxRetries) {
        logger.error(`Operation failed after ${maxRetries} retries: ${error.message}`);
        throw error;
      }
      
      // Exponential backoff (1s, 2s, 4s, etc.)
      const delay = initialDelay * Math.pow(2, retries - 1);
      logger.warning(`Retrying operation in ${delay}ms (attempt ${retries}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should not happen due to the throw in the loop, but just in case
  throw lastError;
}

/**
 * Create a database connection pool using mongoose
 * Should be called at application startup
 * 
 * @returns {Promise<mongoose.Connection>} - Mongoose connection object
 */
export async function createConnectionPool() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep';
    logger.info(`Creating MongoDB connection pool to ${mongoURI.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@')}`);
    
    // Configure mongoose
    mongoose.set('strictQuery', true);
    
    // Connection options with poolSize
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10, // Set the connection pool size
      minPoolSize: 2,  // Keep at least 2 connections
      family: 4        // Use IPv4, skip trying IPv6
    };
    
    // Connect to MongoDB
    const connection = await mongoose.connect(mongoURI, options);
    
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
    
    logger.success(`MongoDB connection pool created: ${mongoose.connection.host}`);
    return connection.connection;
  } catch (error) {
    logger.error(`Error creating MongoDB connection pool: ${error.message}`);
    throw error;
  }
}

/**
 * Closes all connections in the pool
 * Should be called during application shutdown
 * 
 * @returns {Promise<void>}
 */
export async function closeConnectionPool() {
  try {
    if (mongoose.connection.readyState !== 0) {
      logger.info('Closing MongoDB connection pool...');
      await mongoose.disconnect();
      logger.info('MongoDB connection pool closed');
    }
  } catch (error) {
    logger.error(`Error closing MongoDB connection pool: ${error.message}`);
    throw error;
  }
}

export default {
  withDbConnection,
  withRetry,
  createConnectionPool,
  closeConnectionPool
};