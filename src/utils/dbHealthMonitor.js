/**
 * Database health monitor
 * Periodically checks database connection health and reconnects if needed
 */

import { checkDBHealth, connectDB } from '../config/db.js';
import Logger from './logger.js';
import { broadcastDbStatus } from './dbStatusNotifier.js';

const logger = new Logger('DBHealthMonitor');

// Config
const CHECK_INTERVAL = 30000; // Check every 30 seconds (reduced from 60)
const UNHEALTHY_THRESHOLD = 2; // Number of consecutive failed checks before taking action (reduced from 3)
let unhealthyCount = 0;
let monitorInterval = null;

// Track reconnection attempts
let reconnectionAttempts = 0;
const MAX_RECONNECTION_ATTEMPTS = 10;
const RECONNECTION_RESET_TIME = 5 * 60 * 1000; // 5 minutes
let lastReconnectionTime = 0;

/**
 * Start the database health monitor
 */
export function startDbHealthMonitor() {
  if (monitorInterval) {
    logger.warning('DB Health Monitor already running');
    return;
  }

  logger.info('Starting DB Health Monitor');
  
  // Initial check
  checkAndReconnect();
  
  // Setup periodic checks
  monitorInterval = setInterval(checkAndReconnect, CHECK_INTERVAL);
}

/**
 * Stop the database health monitor
 */
export function stopDbHealthMonitor() {
  if (!monitorInterval) {
    logger.debug('DB Health Monitor not running');
    return;
  }
  
  logger.info('Stopping DB Health Monitor');
  clearInterval(monitorInterval);
  monitorInterval = null;
}

/**
 * Check database health and reconnect if needed
 */
async function checkAndReconnect() {
  try {
    // Reset reconnection attempts counter if it's been a while
    if (Date.now() - lastReconnectionTime > RECONNECTION_RESET_TIME) {
      reconnectionAttempts = 0;
    }
    
    const health = await checkDBHealth();
    let statusChanged = false;
    
    // Track previous status to detect changes
    const previousStatus = {
      isHealthy: unhealthyCount === 0,
      fallbackMode: inFallbackMode()
    };
    
    if (health.status === 'healthy') {
      if (unhealthyCount > 0) {
        logger.info(`Database connection restored after ${unhealthyCount} unhealthy checks`);
        statusChanged = true;
      }
      unhealthyCount = 0;
      
      // Check for fallback mode change
      if (previousStatus.fallbackMode !== health.fallbackMode) {
        statusChanged = true;
      }
    } else {
      // Connection is unhealthy
      unhealthyCount++;
      statusChanged = unhealthyCount === 1; // Status changed on first unhealthy
      logger.warning(`Unhealthy database connection detected (${unhealthyCount}/${UNHEALTHY_THRESHOLD}): ${health.error || 'Unknown error'}`);
      
      // Take action after threshold is reached
      if (unhealthyCount >= UNHEALTHY_THRESHOLD) {
        // Check if we're not in a reconnection storm
        if (reconnectionAttempts >= MAX_RECONNECTION_ATTEMPTS) {
          logger.error(`Maximum reconnection attempts (${MAX_RECONNECTION_ATTEMPTS}) reached. Waiting before trying again.`);
          unhealthyCount = 0; // Reset so we don't spam logs
          return;
        }
        
        reconnectionAttempts++;
        lastReconnectionTime = Date.now();
        
        logger.warning(`Attempting to reconnect after ${unhealthyCount} consecutive unhealthy checks (attempt ${reconnectionAttempts}/${MAX_RECONNECTION_ATTEMPTS})`);
        
        // Force reconnection
        const reconnected = await connectDB(2, true);
        if (reconnected) {
          logger.success('Successfully reconnected to database');
          unhealthyCount = 0;
          statusChanged = true;
        } else {
          logger.error('Failed to reconnect to database after multiple attempts');
        }
      }
    }
    
    // Broadcast status changes to connected clients if there's a change
    if (statusChanged && global.io) {
      try {
        broadcastDbStatus(global.io);
      } catch (err) {
        logger.debug(`Error broadcasting DB status: ${err.message}`);
      }
    }
  } catch (error) {
    logger.error(`Error in DB health check: ${error.message}`);
  }
}

export default {
  startDbHealthMonitor,
  stopDbHealthMonitor
};
