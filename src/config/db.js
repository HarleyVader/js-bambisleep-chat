import mongoose from 'mongoose';
import Logger from '../utils/logger.js';

// Initialize logger
const logger = new Logger('Database');

// Track connection status
let isConnected = false;
let profilesConnection = null;
let inFallbackModeState = false;
let modelsRegistered = false;

/**
 * Connect to the main MongoDB database
 * @returns {Promise<mongoose.Connection>} The database connection
 */
export async function connectToDatabase() {
  if (isConnected) {
    logger.info('Using existing database connection');
    return mongoose.connection;
  }

  try {
    const connectionOptions = {
      // No need for useNewUrlParser and useUnifiedTopology in newer mongoose versions
    };

    await mongoose.connect(process.env.MONGODB_URI, connectionOptions);
    
    isConnected = true;
    logger.info('Connected to main database');
    
    // Set up connection event handlers
    mongoose.connection.on('error', (err) => {
      logger.error(`Database connection error: ${err.message}`);
      isConnected = false;
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('Database disconnected');
      isConnected = false;
    });
    
    return mongoose.connection;
  } catch (error) {
    logger.error(`Failed to connect to database: ${error.message}`);
    throw error;
  }
}

/**
 * Connect to the profiles MongoDB database
 * @returns {Promise<mongoose.Connection>} The profiles database connection
 */
export async function connectToProfilesDatabase() {
  if (profilesConnection) {
    logger.info('Using existing profiles database connection');
    return profilesConnection;
  }

  try {
    // Create a separate connection for profiles
    profilesConnection = mongoose.createConnection(process.env.MONGODB_PROFILES);
    
    logger.info('Connected to profiles database');
    
    // Set up connection event handlers
    profilesConnection.on('error', (err) => {
      logger.error(`Profiles database connection error: ${err.message}`);
      profilesConnection = null;
    });
    
    profilesConnection.on('disconnected', () => {
      logger.warn('Profiles database disconnected');
      profilesConnection = null;
    });
    
    return profilesConnection;
  } catch (error) {
    logger.error(`Failed to connect to profiles database: ${error.message}`);
    throw error;
  }
}

/**
 * Disconnect from all databases
 */
export async function disconnectFromDatabases() {
  try {
    if (isConnected) {
      await mongoose.disconnect();
      logger.info('Disconnected from main database');
    }
    
    if (profilesConnection) {
      await profilesConnection.close();
      logger.info('Disconnected from profiles database');
    }
    
    isConnected = false;
    profilesConnection = null;
  } catch (error) {
    logger.error(`Error during database disconnection: ${error.message}`);
    throw error;
  }
}

/**
 * Alias for connectToDatabase for server.js compatibility
 */
export async function connectDB(retries = 1, force = false) {
  try {
    if (isConnected && !force) {
      return { success: true, connection: mongoose.connection };
    }
    
    let lastError = null;
    for (let i = 0; i < retries; i++) {
      try {
        const connection = await connectToDatabase();
        return { success: true, connection };
      } catch (error) {
        lastError = error;
        logger.warn(`Connection attempt ${i + 1}/${retries} failed: ${error.message}`);
        if (i < retries - 1) {
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    return { success: false, error: lastError?.message || 'Failed to connect to database' };
  } catch (error) {
    logger.error(`Failed to connect to database: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Alias for connectToProfilesDatabase for server.js compatibility
 */
export async function connectProfilesDB(retries = 1, force = false) {
  try {
    if (profilesConnection && !force) {
      return { success: true, connection: profilesConnection };
    }
    
    let lastError = null;
    for (let i = 0; i < retries; i++) {
      try {
        const connection = await connectToProfilesDatabase();
        return { success: true, connection };
      } catch (error) {
        lastError = error;
        logger.warn(`Profiles connection attempt ${i + 1}/${retries} failed: ${error.message}`);
        if (i < retries - 1) {
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    return { success: false, error: lastError?.message || 'Failed to connect to profiles database' };
  } catch (error) {
    logger.error(`Failed to connect to profiles database: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Connect to both databases with retries
 */
export async function connectAllDatabases(retries = 1) {
  const mainResult = await connectDB(retries);
  const profilesResult = await connectProfilesDB(retries);
  
  return {
    main: mainResult.success,
    profiles: profilesResult.success
  };
}

/**
 * Alias for disconnectFromDatabases for server.js compatibility
 */
export async function disconnectDB() {
  return disconnectFromDatabases();
}

/**
 * Check health of database connections
 */
export async function checkDBHealth() {
  try {
    // Check main connection
    const mainStatus = mongoose.connection.readyState;
    const mainConnected = mainStatus === 1;
    
    // Check profiles connection
    const profilesStatus = profilesConnection ? profilesConnection.readyState : 0;
    const profilesConnected = profilesStatus === 1;
    
    return {
      status: mainConnected && profilesConnected ? 'healthy' : 'unhealthy',
      main: mainConnected ? 'connected' : 'disconnected',
      profiles: profilesConnected ? 'connected' : 'disconnected'
    };
  } catch (error) {
    logger.error(`Error checking database health: ${error.message}`);
    return { status: 'error', error: error.message };
  }
}

/**
 * Check health of all database connections
 */
export async function checkAllDatabasesHealth() {
  try {
    const mainStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
    const profilesStatus = profilesConnection && profilesConnection.readyState === 1 ? 'healthy' : 'unhealthy';
    
    return {
      main: { 
        status: mainStatus,
        database: mongoose.connection.db?.databaseName || 'unknown'
      },
      profiles: { 
        status: profilesStatus,
        database: profilesConnection?.db?.databaseName || 'unknown'
      }
    };
  } catch (error) {
    logger.error(`Error checking all databases health: ${error.message}`);
    return {
      main: { status: 'error', error: error.message },
      profiles: { status: 'error', error: error.message }
    };
  }
}

/**
 * Check if the main database connection is healthy
 */
export async function isDatabaseConnectionHealthy(type = 'main') {
  try {
    if (type === 'main') {
      return mongoose.connection.readyState === 1;
    } else if (type === 'profiles') {
      return profilesConnection && profilesConnection.readyState === 1;
    } else if (type === 'all') {
      return mongoose.connection.readyState === 1 && 
             profilesConnection && profilesConnection.readyState === 1;
    }
    return false;
  } catch (error) {
    logger.error(`Error checking database health: ${error.message}`);
    return false;
  }
}

/**
 * Check if any database connection is available
 */
export function hasConnection() {
  return mongoose.connection.readyState === 1 || 
         (profilesConnection && profilesConnection.readyState === 1);
}

/**
 * Check if using fallback database mode
 */
export function inFallbackMode() {
  return inFallbackModeState;
}

/**
 * Set fallback mode
 */
export function setFallbackMode(mode) {
  inFallbackModeState = !!mode;
}

/**
 * Ensure all models are registered
 */
export async function ensureModelsRegistered() {
  if (modelsRegistered) return true;
  
  try {
    // Dynamically import models to prevent circular dependencies
    await Promise.all([
      import('../models/SessionHistory.js'),
      import('../models/Profile.js')
    ]);
    
    modelsRegistered = true;
    return true;
  } catch (error) {
    logger.error(`Failed to register models: ${error.message}`);
    return false;
  }
}

/**
 * Execute a function with a database connection
 * Handles reconnection if necessary
 */
export async function withDbConnection(callback, options = {}) {
  const { retries = 1, requireConnection = true } = options;
  
  // Check if we have a connection
  if (requireConnection && !hasConnection()) {
    // Try to reconnect
    const reconnected = await connectDB(1).then(res => res.success);
    if (!reconnected && requireConnection) {
      throw new Error('No database connection available');
    }
  }
  
  // Execute the callback
  let lastError = null;
  for (let i = 0; i < retries; i++) {
    try {
      return await callback();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  // If we get here, all retries failed
  if (lastError) throw lastError;
}

export default {
  connectToDatabase,
  connectToProfilesDatabase,
  disconnectFromDatabases,
  connectDB,
  connectProfilesDB,
  connectAllDatabases,
  disconnectDB,
  checkDBHealth,
  checkAllDatabasesHealth,
  isDatabaseConnectionHealthy,
  hasConnection,
  inFallbackMode,
  setFallbackMode,
  ensureModelsRegistered,
  withDbConnection,
  getConnection: () => mongoose.connection,
  getProfilesConnection: () => profilesConnection
};