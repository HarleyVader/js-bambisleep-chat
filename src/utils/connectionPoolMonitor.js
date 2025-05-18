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
    
    // Get connection pool stats if available
    const connPoolStats = mongoose.connection.client?.topology?.s?.pool;
    if (!connPoolStats) {
      logger.debug('Unable to access connection pool stats');
      return;
    }
    
    // Check if pool is ready
    if (!connPoolStats.serverPool) {
      logger.warning('Server pool not available');
      await refreshConnectionPool();
      return;
    }
    
    // Check for issues in the connection pool
    const totalConnections = connPoolStats.size;
    const availableConnections = connPoolStats.availableConnections;
    const pendingConnections = connPoolStats.pendingConnectionCount;
    
    // Log pool statistics occasionally
    logger.debug(`Pool stats - Total: ${totalConnections}, Available: ${availableConnections}, Pending: ${pendingConnections}`);
    
    // Check for potential issues
    if (availableConnections === 0 && totalConnections > 0) {
      logger.warning('No available connections in the pool, but pool has connections');
      
      // If there are pending connections for too long, consider refreshing
      if (pendingConnections > 0) {
        logger.warning(`${pendingConnections} pending connections detected, refreshing pool`);
        await refreshConnectionPool();
      }
    }
  } catch (error) {
    logger.error(`Error checking connection pool: ${error.message}`);
  }
}

/**
 * Refresh the connection pool by forcing a reconnection
 */
async function refreshConnectionPool() {
  try {
    logger.info('Refreshing connection pool');
    
    // Force a reconnection
    await connectDB(2, true);
    
    // Update the last refresh timestamp
    lastPoolRefresh = Date.now();
    
    logger.success('Connection pool refreshed successfully');
  } catch (error) {
    logger.error(`Failed to refresh connection pool: ${error.message}`);
  }
}

export default {
  startConnectionPoolMonitor,
  stopConnectionPoolMonitor
};
