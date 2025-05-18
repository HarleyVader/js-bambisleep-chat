/**
 * Connection pool monitor
 * Specifically monitors the connection pool health and takes action when issues are detected
 */

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Logger from './logger.js';

const logger = new Logger('ConnectionPoolMonitor');

// Config
const CHECK_INTERVAL = 45000; // Check every 45 seconds (offset from main health check)
let monitorInterval = null;

// Track when we need to force a pool refresh
let lastPoolRefresh = Date.now();
const REFRESH_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Start the connection pool monitor
 */
export function startConnectionPoolMonitor() {
  if (monitorInterval) {
    logger.warning('Connection Pool Monitor already running');
    return;
  }

  logger.info('Starting Connection Pool Monitor');
  
  // Initial check after a short delay
  setTimeout(checkConnectionPool, 5000);
  
  // Setup periodic checks
  monitorInterval = setInterval(checkConnectionPool, CHECK_INTERVAL);
}

/**
 * Stop the connection pool monitor
 */
export function stopConnectionPoolMonitor() {
  if (!monitorInterval) {
    logger.debug('Connection Pool Monitor not running');
    return;
  }
  
  logger.info('Stopping Connection Pool Monitor');
  clearInterval(monitorInterval);
  monitorInterval = null;
}

/**
 * Check connection pool health
 */
async function checkConnectionPool() {
  try {
    // Skip if there's no connection
    if (mongoose.connection.readyState !== 1) {
      return;
    }
    
    // Check if we need to force a pool refresh
    const now = Date.now();
    if (now - lastPoolRefresh > REFRESH_INTERVAL) {
      logger.info('Performing scheduled connection pool refresh');
      await refreshConnectionPool();
      lastPoolRefresh = now;
      return;
    }
    
    // Use a simpler approach - check if connection is actually working
    try {
      // Simple ping to check connection
      await mongoose.connection.db.admin().ping();
      
      // Check if we can perform a basic operation
      const connectionCheck = await mongoose.connection.db.command({ serverStatus: 1 });
      
      // If we have connection info, use it
      if (connectionCheck && connectionCheck.connections) {
        const { current, available, totalCreated } = connectionCheck.connections;
        
        logger.debug(`MongoDB connections - Current: ${current}, Available: ${available}, Total Created: ${totalCreated}`);
        
        // Check for potential connection issues
        if (current > 0 && available === 0) {
          logger.warning('No available connections, but connections exist');
          await refreshConnectionPool();
        }
      } else {
        // If we couldn't get detailed stats, do a time-based refresh
        // This is a fallback when we can't access internal pool stats
        const timeSinceLastRefresh = now - lastPoolRefresh;
        if (timeSinceLastRefresh > REFRESH_INTERVAL / 4) { // Do more frequent refreshes as fallback
          logger.info('Performing time-based pool refresh (limited stats available)');
          await refreshConnectionPool();
        }
      }
    } catch (pingError) {
      // If ping fails, we have connection issues
      logger.warning(`Connection check failed: ${pingError.message}`);
      await refreshConnectionPool();    }
  } catch (error) {
    // Don't show the full error for expected connection issues
    if (error.message && (
        error.message.includes('not authorized') || 
        error.message.includes('no such cmd'))) {
      logger.warning('Limited MongoDB permissions detected, using simplified connection monitoring');
      
      // Fall back to a simpler connection check - just try to ping the database
      try {
        await mongoose.connection.db.command({ ping: 1 });
      } catch (pingError) {
        logger.warning(`Connection issue detected: ${pingError.message}`);
        await refreshConnectionPool();
      }
    } else {
      logger.error(`Error checking connection pool: ${error.message}`);
      
      // If we get any error during checking, it's safer to refresh the pool
      const now = Date.now();
      const timeSinceLastRefresh = now - lastPoolRefresh;
      
      // Don't refresh too frequently
      if (timeSinceLastRefresh > 60000) { // At least 1 minute between forced refreshes
        await refreshConnectionPool();
      }
    }
  }
}

/**
 * Refresh the connection pool by forcing a reconnection
 */
async function refreshConnectionPool() {
  try {
    logger.info('Refreshing connection pool');
    
    // First try to close the connection - this helps free up resources
    try {
      if (mongoose.connection.readyState === 1) {
        // Set a timeout to avoid hanging indefinitely
        const closePromise = mongoose.connection.close();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection close timeout')), 5000)
        );
        
        await Promise.race([closePromise, timeoutPromise]);
        logger.debug('Existing connection closed');
      }
    } catch (closeError) {
      logger.warning(`Error closing connection: ${closeError.message}`);
      // Continue with reconnection even if close fails
    }
    
    // Brief pause to allow resources to be released
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Force a reconnection with extended retry logic
    await connectDB(2, true);
    
    // Update the last refresh timestamp
    lastPoolRefresh = Date.now();
    
    // Verify the connection is actually working
    await mongoose.connection.db.command({ ping: 1 });
    
    logger.success('Connection pool refreshed successfully');
  } catch (error) {
    logger.error(`Failed to refresh connection pool: ${error.message}`);
    
    // If we can't connect, try one more time after a delay
    try {
      logger.info('Attempting one final reconnection after delay');
      await new Promise(resolve => setTimeout(resolve, 3000));
      await connectDB(3, true);
      logger.success('Second connection attempt successful');
    } catch (retryError) {
      logger.error(`All reconnection attempts failed: ${retryError.message}`);
    }
  }
}

// Export the refresh function directly so it can be used by other modules
export { refreshConnectionPool };

export default {
  startConnectionPoolMonitor,
  stopConnectionPoolMonitor,
  refreshConnectionPool
};
