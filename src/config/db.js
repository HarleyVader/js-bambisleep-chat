// Database connection handler for BambiSleep.chat
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Logger from '../utils/logger.js';

// Initialize logger
const logger = new Logger('Database');

// Load environment variables
dotenv.config();

// Connection URIs from .env file
const MAIN_DB_URI = process.env.MONGODB_URI;
const PROFILES_DB_URI = process.env.MONGODB_PROFILES;

// Mongoose connection options
const CONNECTION_OPTIONS = {
  connectTimeoutMS: 10000,          // 10 seconds timeout
  serverSelectionTimeoutMS: 10000,  // 10 seconds timeout for server selection
  socketTimeoutMS: 45000,           // 45 seconds timeout for socket operations
  maxPoolSize: 10,                  // Maximum number of sockets
  minPoolSize: 2                    // Minimum number of sockets
};

// Track database connection state
const dbState = {
  main: {
    connected: false,
    connection: null,
    uri: MAIN_DB_URI,
    name: null,
    fallback: false,
    lastConnectAttempt: null,
    retryCount: 0
  },
  profiles: {
    connected: false,
    connection: null,
    uri: PROFILES_DB_URI,
    name: null,
    fallback: false,
    lastConnectAttempt: null,
    retryCount: 0
  }
};

/**
 * Extract database name from a MongoDB URI
 * @param {string} uri - MongoDB connection URI
 * @returns {string|null} - Database name or null if not found
 */
function extractDatabaseName(uri) {
  if (!uri) return null;
  
  try {
    // Match pattern for standard and srv connection strings
    const matches = uri.match(/\/([^/?]+)(\?|$)/);
    
    // Special case for MongoDB Atlas style connections
    if (!matches && uri.includes('mongodb+srv://')) {
      // For Atlas connections in format mongodb+srv://user:pass@cluster.mongodb.net/dbname
      const atlasMatches = uri.match(/mongodb\+srv:\/\/[^/]+\/([^/?]+)/);
      return atlasMatches && atlasMatches[1] ? atlasMatches[1] : null;
    }
    
    return matches && matches[1] ? matches[1] : null;
  } catch (error) {
    return null;
  }
}

/**
 * Connect to a MongoDB database
 * @param {string} uri - MongoDB connection URI
 * @param {string} dbType - Database type ('main' or 'profiles')
 * @param {number} maxRetries - Maximum number of connection retries
 * @param {boolean} forceReconnect - Force reconnection even if already connected
 * @returns {Promise<boolean>} - True if connected successfully
 */
async function connectDatabase(uri, dbType, maxRetries = 3, forceReconnect = false) {
  if (!uri) {
    logger.error(`No connection URI provided for ${dbType} database`);
    return false;
  }

  // Don't reconnect if already connected, unless forced
  if (dbState[dbType].connected && !forceReconnect) {
    logger.debug(`${dbType} database already connected`);
    return true;
  }

  // Track connection attempt
  dbState[dbType].lastConnectAttempt = Date.now();
  dbState[dbType].retryCount = 0;

  // Extract database name before connecting
  const dbName = extractDatabaseName(uri);
  dbState[dbType].name = dbName;

  try {
    logger.info(`Connecting to ${dbType} database${dbName ? ` (${dbName})` : ''}...`);

    // Close existing connection if any and forceReconnect is true
    if (dbState[dbType].connection && forceReconnect) {
      try {
        await dbState[dbType].connection.close();
        logger.debug(`Closed existing ${dbType} database connection for reconnection`);
      } catch (closeErr) {
        logger.warning(`Error closing existing ${dbType} connection: ${closeErr.message}`);
      }
    }

    // Create new connection
    const connection = await mongoose.createConnection(uri, CONNECTION_OPTIONS);
    
    // Update connection state
    dbState[dbType].connection = connection;
    dbState[dbType].connected = true;
    dbState[dbType].fallback = false;
    
    logger.success(`Connected to ${dbType} database${dbName ? ` (${dbName})` : ''}`);
    return true;
  } catch (error) {
    logger.error(`Failed to connect to ${dbType} database: ${error.message}`);
    
    // Try reconnecting up to maxRetries times
    if (dbState[dbType].retryCount < maxRetries) {
      dbState[dbType].retryCount++;
      const delay = dbState[dbType].retryCount * 1000; // Increase delay with each retry
      
      logger.warning(`Retrying ${dbType} database connection in ${delay/1000}s (attempt ${dbState[dbType].retryCount}/${maxRetries})...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectDatabase(uri, dbType, maxRetries, forceReconnect);
    }
    
    return false;
  }
}

/**
 * Connect to the main database
 * @param {number} maxRetries - Maximum number of connection retries
 * @param {boolean} forceReconnect - Force reconnection even if already connected
 * @returns {Promise<boolean>} - True if connected successfully
 */
export async function connectDB(maxRetries = 3, forceReconnect = false) {
  return connectDatabase(MAIN_DB_URI, 'main', maxRetries, forceReconnect);
}

/**
 * Connect to the profiles database
 * @param {number} maxRetries - Maximum number of connection retries
 * @param {boolean} forceReconnect - Force reconnection even if already connected
 * @returns {Promise<boolean>} - True if connected successfully
 */
export async function connectProfilesDB(maxRetries = 3, forceReconnect = false) {
  return connectDatabase(PROFILES_DB_URI, 'profiles', maxRetries, forceReconnect);
}

/**
 * Connect to all databases
 * @param {number} maxRetries - Maximum number of connection retries
 * @param {boolean} forceReconnect - Force reconnection even if already connected
 * @returns {Promise<{main: boolean, profiles: boolean}>} - Connection status for each database
 */
export async function connectAllDatabases(maxRetries = 3, forceReconnect = false) {
  const mainResult = await connectDB(maxRetries, forceReconnect);
  const profilesResult = await connectProfilesDB(maxRetries, forceReconnect);
  
  // Set up mongoose default connection to main DB for compatibility
  if (mainResult && dbState.main.connection) {
    mongoose.connection = dbState.main.connection;
  }
  
  return {
    main: mainResult,
    profiles: profilesResult
  };
}

/**
 * Disconnect from all databases
 * @returns {Promise<void>}
 */
export async function disconnectDB() {
  try {
    // Disconnect from main database
    if (dbState.main.connection) {
      await dbState.main.connection.close();
      dbState.main.connected = false;
      dbState.main.connection = null;
      logger.debug('Disconnected from main database');
    }
    
    // Disconnect from profiles database
    if (dbState.profiles.connection) {
      await dbState.profiles.connection.close();
      dbState.profiles.connected = false;
      dbState.profiles.connection = null;
      logger.debug('Disconnected from profiles database');
    }
  } catch (error) {
    logger.error(`Error disconnecting from databases: ${error.message}`);
  }
}

/**
 * Check if we're in fallback mode (no database connection)
 * @returns {boolean} - True if in fallback mode
 */
export function inFallbackMode() {
  return dbState.main.fallback || !dbState.main.connected;
}

/**
 * Check health of all database connections
 * @returns {Promise<{main: {status: string, database: string}, profiles: {status: string, database: string}}>}
 */
export async function checkAllDatabasesHealth() {
  return {
    main: await checkDBHealth('main'),
    profiles: await checkDBHealth('profiles')
  };
}

/**
 * Check health of a specific database connection
 * @param {string} dbType - Database type ('main' or 'profiles')
 * @returns {Promise<{status: string, database: string}>}
 */
export async function checkDBHealth(dbType) {
  if (!dbState[dbType].connected) {
    return {
      status: 'disconnected',
      database: dbState[dbType].name || 'unknown'
    };
  }
  
  try {
    // Simple connection status check
    const isConnected = dbState[dbType].connection.readyState === 1;
    
    if (!isConnected) {
      return {
        status: 'error',
        database: dbState[dbType].name || 'unknown',
        error: 'Connection not ready'
      };
    }
    
    return {
      status: 'connected',
      database: dbState[dbType].name || 'unknown'
    };
  } catch (error) {
    logger.error(`Error checking ${dbType} database health: ${error.message}`);
    return {
      status: 'error',
      database: dbState[dbType].name || 'unknown',
      error: error.message
    };
  }
}

/**
 * Execute a function with database connection
 * @param {Function} fn - Function to execute with database connection
 * @param {boolean} requireConnection - Whether to throw error if not connected
 * @returns {Promise<any>} - Result of the function
 */
export async function withDbConnection(fn, requireConnection = true) {
  // Check if main database is connected
  if (!dbState.main.connected) {
    // Try to connect if not connected
    try {
      await connectDB(1);
    } catch (connErr) {
      logger.warning(`Automatic reconnection failed: ${connErr.message}`);
      // If we require a connection and can't establish one, throw error
      if (requireConnection) {
        throw new Error('Database connection required but unavailable');
      }
    }
  }
  
  try {
    return await fn();
  } catch (error) {
    // Handle connection errors by attempting to reconnect once
    if (error.name === 'MongoNetworkError' || 
        error.name === 'MongooseServerSelectionError' ||
        error.message.includes('topology')) {
      
      logger.warning(`Database operation failed, attempting reconnection: ${error.message}`);
      
      try {
        await connectDB(1, true); // Force reconnection with 1 retry
        // Try the operation again after reconnecting
        return await fn();
      } catch (reconnectError) {
        logger.error(`Reconnection failed: ${reconnectError.message}`);
        throw error; // Throw original error if reconnection also fails
      }
    }
    
    throw error; // Re-throw any other error
  }
}

/**
 * Get a database model by name
 * @param {string} modelName - Name of the model to get
 * @returns {mongoose.Model} - Mongoose model
 */
export function getModel(modelName) {
  return mongoose.model(modelName);
}

/**
 * Check if database connections are available
 * @returns {boolean} - True if main database is connected
 */
export function hasConnection() {
  return dbState.main.connected && dbState.main.connection && dbState.main.connection.readyState === 1;
}

/**
 * Ensure all models are properly registered
 * @returns {Promise<void>}
 */
export async function ensureModelsRegistered() {
  try {
    logger.debug('Registering database models...');
    
    // Dynamic import of all models to ensure they're registered
    await Promise.all([
      import('../models/ChatMessage.js'),
      import('../models/Profile.js'),
      import('../models/SessionHistory.js')
    ]);
    
    logger.debug('All models registered successfully');
  } catch (error) {
    logger.error(`Failed to register models: ${error.message}`);
    throw error;
  }
}

/**
 * Check if database connection is healthy
 * @returns {Promise<boolean>}
 */
export async function isDatabaseConnectionHealthy() {
  try {
    const health = await checkDBHealth('main');
    return health.status === 'connected';
  } catch (error) {
    logger.error(`Error checking database health: ${error.message}`);
    return false;
  }
}

// Initialize default connection on module load for backward compatibility
if (MAIN_DB_URI) {
  connectDB(1)
    .then(result => {
      if (!result) {
        logger.warning('Failed to establish initial database connection');
      }
    })
    .catch(err => {
      logger.error(`Initial database connection error: ${err.message}`);
    });
}
