import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Logger from '../utils/logger.js';

dotenv.config();

// Create a specialized logger for database operations
const logger = new Logger('Database');

// MongoDB connection options with proper pooling and timeouts
const CONNECTION_OPTIONS = {
  // Connection pooling settings
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 45000,      // Close sockets after 45 seconds of inactivity
  connectTimeoutMS: 10000,     // Give up initial connection after 10 seconds
  serverSelectionTimeoutMS: 5000, // How long to try selecting server
  heartbeatFrequencyMS: 30000, // Check connection health every 30 seconds
  maxIdleTimeMS: 60000,        // Remove idle connections after 60 seconds
  
  // Signal to driver that we understand the new connection string parser
  useNewUrlParser: true,

  // For replica sets and general connection stability
  autoReconnect: true
};

// Get MongoDB URI from environment variables with fallbacks
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep';

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.healthCheckInterval = null;
    this.connectionPromise = null;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Connect to MongoDB with automatic retries
   * @returns {Promise<mongoose.Connection>} Mongoose connection
   */
  async connect() {
    // Return existing connection promise if already connecting
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    // Create new connection promise
    this.connectionPromise = new Promise(async (resolve, reject) => {
      try {
        // Set up connection events before connecting
        mongoose.connection.on('error', this._handleError.bind(this));
        mongoose.connection.on('disconnected', this._handleDisconnect.bind(this));
        mongoose.connection.on('connected', this._handleConnection.bind(this));
        
        // Attempt to connect
        await mongoose.connect(MONGODB_URI, CONNECTION_OPTIONS);
        
        // Start health check once connected
        this._startHealthCheck();
        
        resolve(mongoose.connection);
      } catch (error) {
        this.connectionPromise = null;
        
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          logger.warn(`Connection failed. Retrying (${this.retryCount}/${this.maxRetries}) in ${this.retryDelay/1000}s...`);
          
          // Retry after delay
          setTimeout(() => {
            this.connect()
              .then(resolve)
              .catch(reject);
          }, this.retryDelay);
        } else {
          logger.error(`Failed to connect after ${this.maxRetries} attempts: ${error.message}`);
          reject(error);
        }
      }
    });
    
    return this.connectionPromise;
  }

  /**
   * Get current connection object
   * @returns {mongoose.Connection} Mongoose connection
   */
  getConnection() {
    return mongoose.connection;
  }

  /**
   * Check if database is connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Gracefully close the database connection
   * @returns {Promise<void>}
   */
  async disconnect() {
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Close connection if it exists
    if (mongoose.connection.readyState !== 0) {
      logger.info('Closing database connection...');
      await mongoose.connection.close(false);
      this.isConnected = false;
      this.connectionPromise = null;
      logger.success('Database connection closed');
    }
  }

  /**
   * Create a session for transactions
   * @returns {Promise<mongoose.ClientSession>} Mongoose session
   */
  async startSession() {
    if (!this.isConnected()) {
      await this.connect();
    }
    return mongoose.startSession();
  }

  /**
   * Ping database to verify connection
   * @returns {Promise<boolean>} True if connection is healthy
   */
  async pingDatabase() {
    try {
      // Use admin command to check connection
      await mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      logger.error(`Database ping failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Run health checks at regular intervals
   * @private
   */
  _startHealthCheck() {
    // Clear any existing interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Create new interval check
    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.pingDatabase();
        if (!isHealthy && this.isConnected) {
          logger.warn('Health check failed, attempting reconnection');
          this.isConnected = false;
          
          // Reset connection and try again
          this.connectionPromise = null;
          await this.connect();
        }
      } catch (error) {
        logger.error(`Health check error: ${error.message}`);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Handle connection event
   * @private
   */
  _handleConnection() {
    this.isConnected = true;
    this.retryCount = 0; // Reset retry counter
    logger.success(`MongoDB Connected: ${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}`);
  }

  /**
   * Handle error event
   * @param {Error} error - Connection error 
   * @private
   */
  _handleError(error) {
    logger.error(`MongoDB Error: ${error.message}`);
  }

  /**
   * Handle disconnection event
   * @private
   */
  _handleDisconnect() {
    this.isConnected = false;
    logger.warn('MongoDB disconnected');
    
    // Reconnection will be handled by mongoose's autoReconnect option
  }
}

// Export a singleton instance
const dbConnection = new DatabaseConnection();
export default dbConnection;