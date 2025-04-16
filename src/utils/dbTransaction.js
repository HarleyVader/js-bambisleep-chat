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

// For default export
const dbTransaction = { withDbConnection, getModel };
export default dbTransaction;