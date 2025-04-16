import mongoose from 'mongoose';
import config from './config.js';
import Logger from '../utils/logger.js';

const logger = new Logger('DBConnection');

/**
 * Connect to MongoDB
 * 
 * Establishes connection to MongoDB using Mongoose
 * 
 * @returns {Promise<mongoose.Connection>} - Mongoose connection object
 */
async function connectToMongoDB() {
  const mongoURI = config.MONGODB_URI || 'mongodb://localhost:27017/bambisleep';
  
  try {
    if (mongoose.connection.readyState === 1) {
      logger.info('MongoDB already connected');
      return mongoose.connection;
    }
    
    logger.info(`Connecting to MongoDB at ${mongoURI.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@')}`);
    
    // Configure mongoose connection
    mongoose.set('strictQuery', true);
    
    // Set up connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4 // Use IPv4, skip trying IPv6
    };
    
    // Connect to MongoDB
    const connection = await mongoose.connect(mongoURI, options);
    
    // Log connection status
    logger.success(`MongoDB connected: ${mongoose.connection.host}`);
    
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
    
    return connection.connection;
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 * 
 * @returns {Promise<void>}
 */
async function disconnectFromMongoDB() {
  try {
    if (mongoose.connection.readyState !== 0) {
      logger.info('Disconnecting from MongoDB...');
      await mongoose.disconnect();
      logger.info('MongoDB disconnected');
    }
  } catch (error) {
    logger.error(`Error disconnecting from MongoDB: ${error.message}`);
    throw error;
  }
}

/**
 * Execute a database transaction with proper connection management
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
        await disconnectFromMongoDB();
      } catch (closeError) {
        logger.error(`Error closing MongoDB connection: ${closeError.message}`);
      }
    }
  }
}

export default connectToMongoDB;