/**
 * Database Reconnection Service
 * 
 * Provides a persistent background service that attempts to reconnect to MongoDB
 * when the connection is lost.
 */
import Logger from './logger.js';

const logger = new Logger('DBReconnect');

class DBReconnector {  constructor() {
    this.isConnecting = false;
    this.reconnectTimer = null;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 10;
    this.initialDelay = 10000; // Start with 10 seconds
    this.maxDelay = 300000;   // Cap at 5 minutes
    this.lastPoolStats = null;
  }

  /**
   * Start the reconnection process
   * @param {Function} connectFn - Function to call to connect to database
   */
  start(connectFn) {
    if (!connectFn || typeof connectFn !== 'function') {
      logger.error('Invalid connection function provided');
      return;
    }

    this.connectFn = connectFn;
    this.scheduleReconnect();
  }

  /**
   * Schedule the next reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      logger.warning(`Maximum reconnection attempts (${this.maxConnectionAttempts}) reached. Stopping automatic reconnection.`);
      logger.info('Server will continue with limited functionality. Manual restart may be required.');
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.initialDelay * Math.pow(1.5, this.connectionAttempts),
      this.maxDelay
    );

    this.connectionAttempts++;
    
    logger.info(`Scheduling database reconnection attempt ${this.connectionAttempts}/${this.maxConnectionAttempts} in ${Math.round(delay/1000)}s`);
    
    this.reconnectTimer = setTimeout(() => {
      this.tryReconnect();
    }, delay);
  }

  /**
   * Attempt to reconnect to database
   */
  async tryReconnect() {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    
    try {
      logger.info(`Attempting database reconnection (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts})`);
      
      const result = await Promise.resolve(this.connectFn()).catch(error => {
        logger.error(`Reconnection failed: ${error.message}`);
        return false;
      });
      
      if (result) {
        logger.success('Database reconnection successful');
        this.reset();
      } else {
        logger.warning('Database reconnection failed');
        this.scheduleReconnect();
      }
    } catch (error) {
      logger.error(`Error during database reconnection: ${error.message}`);
      this.scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }
  /**
   * Monitor MongoDB connection pool health
   * @param {mongoose.Connection} connection - Mongoose connection to monitor
   */
  async monitorConnectionPool(connection) {
    if (!connection || typeof connection.db !== 'function') {
      logger.warning('Invalid connection provided for pool monitoring');
      return;
    }
    
    try {
      const db = connection.db();
      const serverStatus = await db.command({ serverStatus: 1 });
      
      if (serverStatus && serverStatus.connections) {
        const { current, available, totalCreated } = serverStatus.connections;
        
        // Log connection pool status
        logger.debug(`Connection pool: ${current} active, ${available} available, ${totalCreated} total created`);
        
        // Check for potential connection leaks
        if (this.lastPoolStats) {
          const createdSinceLast = totalCreated - this.lastPoolStats.totalCreated;
          const timeDiff = (Date.now() - this.lastPoolStats.timestamp) / 1000;
          
          if (createdSinceLast > 50 && timeDiff < 60) {
            // More than 50 new connections in less than 60 seconds
            logger.warning(`Potential connection leak detected: ${createdSinceLast} new connections in ${Math.round(timeDiff)}s`);
            logger.warning('Review application code for unclosed connections or missing await statements');
          }
        }
        
        // Store current stats
        this.lastPoolStats = {
          current,
          available,
          totalCreated,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      logger.error(`Error monitoring connection pool: ${error.message}`);
    }
  }

  /**
   * Reset the reconnection state
   */
  reset() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connectionAttempts = 0;
    this.isConnecting = false;
    logger.info('Database reconnection service reset');
  }

  /**
   * Stop the reconnection process
   */  stop() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isConnecting = false;
    logger.info('Database reconnection service stopped');
  }

  /**
   * Check MongoDB connection pool health
   * @returns {Promise<Object>} Pool statistics
   */
  async checkPool() {
    try {
      // Import mongoose dynamically
      const mongoose = (await import('mongoose')).default;
      
      if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        return { status: 'disconnected' };
      }

      // Check if we can access the connection pool
      const db = mongoose.connection.db;
      if (!db || !db.serverConfig || !db.serverConfig.s || !db.serverConfig.s.pool) {
        return { status: 'no-pool-access' };
      }

      const pool = db.serverConfig.s.pool;
      
      // Extract relevant metrics
      const stats = {
        status: 'connected',
        totalConnections: pool.totalConnectionCount || 0,
        availableConnections: pool.availableConnectionCount || 0,
        waitQueueSize: pool.waitQueueSize || 0,
        maxPoolSize: pool.options?.maxPoolSize || 0,
        minPoolSize: pool.options?.minPoolSize || 0
      };
      
      // Calculate usage percentage
      stats.usagePercentage = stats.maxPoolSize ? 
        Math.round((stats.totalConnections / stats.maxPoolSize) * 100) : 0;
      
      // Compare with last stats to detect issues
      if (this.lastPoolStats) {
        // Check for connection leaks
        if (stats.totalConnections > this.lastPoolStats.totalConnections + 5 && 
            stats.usagePercentage > 80) {
          logger.warning(`Potential connection leak detected: ${stats.totalConnections} connections (${stats.usagePercentage}% of max)`);
        }
        
        // Check for wait queue growth
        if (stats.waitQueueSize > 2 && stats.waitQueueSize > this.lastPoolStats.waitQueueSize) {
          logger.warning(`MongoDB wait queue growing: ${stats.waitQueueSize} requests waiting`);
        }
      }
      
      // Store for next comparison
      this.lastPoolStats = stats;
      
      // Log issues
      if (stats.usagePercentage > 90) {
        logger.warning(`MongoDB connection pool near capacity: ${stats.usagePercentage}%`);
      }
      
      if (stats.waitQueueSize > 5) {
        logger.warning(`High MongoDB wait queue: ${stats.waitQueueSize} requests waiting`);
      }
      
      return stats;
    } catch (error) {
      logger.error(`Error checking MongoDB connection pool: ${error.message}`);
      return { status: 'error', error: error.message };
    }
  }
}

const reconnector = new DBReconnector();

/**
 * Exported function to check MongoDB connection pool
 * @returns {Promise<Object>} Pool statistics
 */
export async function checkMongoConnectionPool() {
  return await reconnector.checkPool();
}

export default reconnector;
