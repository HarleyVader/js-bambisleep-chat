import mongoose from 'mongoose';
import Logger from '../utils/logger.js';

// Initialize logger
const logger = new Logger('Database');

// Database configurations for different purposes
const DB_CONFIG = {
  main: process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep',
  profiles: process.env.PROFILES_MONGODB_URI || 'mongodb://localhost:27017/bambi-profiles'
};

// Configure mongoose
mongoose.set('strictQuery', false);

/**
 * Create mongoose connection
 * @param {string} uri - MongoDB connection URI
 * @param {Object} options - Connection options
 * @returns {Promise} Mongoose connection
 */
async function createConnection(uri, options = {}) {
  try {
    // Default connection options
    const connectionOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      ...options
    };
    
    const connection = await mongoose.createConnection(uri, connectionOptions);
    
    // Setup event handlers for this connection
    connection.on('error', err => {
      logger.error(`MongoDB connection error for ${uri}: ${err}`);
    });
    
    connection.on('disconnected', () => {
      logger.warning(`MongoDB disconnected for ${uri}, trying to reconnect...`);
    });
    
    connection.on('reconnected', () => {
      logger.success(`MongoDB reconnected successfully for ${uri}`);
    });
    
    return connection;
  } catch (error) {
    logger.error(`Error creating MongoDB connection for ${uri}: ${error.message}`);
    throw error;
  }
}

// Connection objects
const connections = {
  main: null,
  profiles: null
};

/**
 * Connect to all MongoDB databases
 * @returns {Promise} Object containing all connections
 */
export async function connectDB() {
  try {
    // Connect to main database
    connections.main = await createConnection(DB_CONFIG.main);
    logger.success(`Main MongoDB Connected: ${connections.main.host}`);
    
    // Connect to profiles database
    connections.profiles = await createConnection(DB_CONFIG.profiles);
    logger.success(`Profiles MongoDB Connected: ${connections.profiles.host}`);
    
    // Set default connection for backward compatibility
    mongoose.connection = connections.main;
    
    // Handle process termination
    process.on('SIGINT', async () => {
      await closeDB();
      logger.info('MongoDB connections closed due to app termination');
      process.exit(0);
    });
    
    return connections;
  } catch (error) {
    logger.error(`Error connecting to MongoDB databases: ${error.message}`);
    throw error;
  }
}

/**
 * Close all database connections
 * @returns {Promise}
 */
export async function closeDB() {
  try {
    const promises = [];
    
    for (const [name, connection] of Object.entries(connections)) {
      if (connection) {
        promises.push(
          connection.close().then(() => {
            logger.info(`MongoDB ${name} connection closed successfully`);
          })
        );
      }
    }
    
    await Promise.all(promises);
  } catch (error) {
    logger.error(`Error closing MongoDB connections: ${error.message}`);
    throw error;
  }
}

/**
 * Get connection by name
 * @param {string} name - Connection name ("main" or "profiles")
 * @returns {mongoose.Connection} Mongoose connection
 */
export function getConnection(name = 'main') {
  if (!connections[name]) {
    throw new Error(`No connection exists with name: ${name}`);
  }
  return connections[name];
}

export default { connectDB, closeDB, getConnection };