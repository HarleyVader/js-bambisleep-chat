import mongoose from 'mongoose';
import Logger from './logger.js';

const logger = new Logger('ConnectionMonitor');
let monitorInterval = null;

/**
 * Starts monitoring database and other connections
 * @param {Object} options Configuration options for monitoring
 * @param {number} options.interval Interval in milliseconds between checks
 */
export function startConnectionMonitoring(options = {}) {
  const interval = options.interval || 60000; // Default to checking every minute
  
  // Clear any existing monitor
  if (monitorInterval) {
    clearInterval(monitorInterval);
  }
  
  logger.info('Starting connection monitoring');
  
  // Start monitoring interval
  monitorInterval = setInterval(() => {
    // Check MongoDB connection
    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      logger.warning(`Database connection issue detected. Current state: ${getDbStateName(dbState)}`);
    }
    
    // Additional connection checks can be added here as needed
    // For example: Redis, external APIs, etc.
    
  }, interval);
  
  // Return a function to stop monitoring
  return () => {
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
      logger.info('Connection monitoring stopped');
    }
  };
}

/**
 * Converts MongoDB connection state number to readable name
 * @param {number} state MongoDB connection state
 * @returns {string} Human-readable state name
 */
function getDbStateName(state) {
  switch (state) {
    case 0: return 'disconnected';
    case 1: return 'connected';
    case 2: return 'connecting';
    case 3: return 'disconnecting';
    default: return 'unknown';
  }
}

export default {
  startConnectionMonitoring
};
