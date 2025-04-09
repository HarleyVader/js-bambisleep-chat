import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Logger } from '../utils/logger.js';

// Initialize logger
const logger = new Logger('Database');

dotenv.config();

// MongoDB connection options with proper pooling and timeouts
const CONNECTION_OPTIONS = {
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 30000,
  maxIdleTimeMS: 60000
};

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.connectionPromise = null;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000;
    this.healthCheckInterval = null;
  }

  /**
   * Connect to MongoDB with automatic retries
   * @returns {Promise<mongoose.Connection>} Mongoose connection
   */
  async connect() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    this.connectionPromise = new Promise(async (resolve, reject) => {
      try {
        const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep';
        
        // Set up connection events
        mongoose.connection.on('error', this._handleError.bind(this));
        mongoose.connection.on('disconnected', this._handleDisconnect.bind(this));
        mongoose.connection.on('connected', this._handleConnection.bind(this));
        
        await mongoose.connect(MONGO_URI, CONNECTION_OPTIONS);
        
        // Start health check
        this._startHealthCheck();
        
        resolve(mongoose.connection);
      } catch (error) {
        this.connectionPromise = null;
        
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          logger.error(`Connection failed. Retrying (${this.retryCount}/${this.maxRetries}) in ${this.retryDelay/1000}s...`);
          
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
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

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
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.pingDatabase();
        if (!isHealthy && this.isConnected) {
          logger.warn('Health check failed, attempting reconnection');
          this.isConnected = false;
          
          this.connectionPromise = null;
          await this.connect();
        }
      } catch (error) {
        logger.error(`Health check error: ${error.message}`);
      }
    }, 30000);
  }

  /**
   * Handle connection event
   * @private
   */
  _handleConnection() {
    this.isConnected = true;
    this.retryCount = 0;
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
    logger.warning('MongoDB disconnected');
  }
}

// Export singleton instance
const dbConnection = new DatabaseConnection();
export default dbConnection;