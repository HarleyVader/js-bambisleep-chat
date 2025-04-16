import mongoose from 'mongoose';
import Logger from './logger.js';

const logger = new Logger('ConnectionMonitor');
let monitorInterval = null;

/**
 * Starts monitoring MongoDB connections
 * @param {number} interval - Monitoring interval in ms (default: 60000 - 1 minute)
 */
export function startConnectionMonitoring(interval = 60000) {
  if (monitorInterval) {
    clearInterval(monitorInterval);
  }
  
  monitorInterval = setInterval(() => {
    const state = mongoose.connection.readyState;
    const stateString = ['disconnected', 'connected', 'connecting', 'disconnecting'][state] || 'unknown';
    
    // Log connection state
    logger.info(`MongoDB connection state: ${stateString} (${state})`);
    
    // If we have active connections, log them
    if (mongoose.connection.db) {
      mongoose.connection.db.admin().serverStatus()
        .then(status => {
          const connections = status.connections;
          logger.info(`MongoDB connections: ${JSON.stringify(connections)}`);
        })
        .catch(err => {
          logger.error(`Error getting MongoDB server status: ${err.message}`);
        });
    }
  }, interval);
  
  return monitorInterval;
}

/**
 * Stops the connection monitoring
 */
export function stopConnectionMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('Connection monitoring stopped');
  }
}

export default { startConnectionMonitoring, stopConnectionMonitoring };