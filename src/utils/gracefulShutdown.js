import mongoose from 'mongoose';
import Logger from '../utils/logger.js';

// Initialize logger
const logger = new Logger('WorkerShutdown');

/**
 * Handles graceful shutdown of a worker
 * @param {string} workerName - The name of the worker to identify it in logs
 * @param {function} customCleanup - Optional custom cleanup function
 * @returns {Promise<void>}
 */
export default async function workerGracefulShutdown(workerName, customCleanup = null) {
  try {
    logger.info(`Shutting down ${workerName || 'worker'}...`);
    
    // Run custom cleanup if provided
    if (typeof customCleanup === 'function') {
      logger.info(`Running custom cleanup for ${workerName}`);
      await customCleanup();
    }
    
    // Close MongoDB connection if it's open
    if (mongoose.connection.readyState === 1) {
      logger.info(`Closing MongoDB connection for ${workerName}`);
      await mongoose.connection.close(false);
      logger.success(`MongoDB connection closed for ${workerName}`);
    }
    
    logger.success(`${workerName || 'Worker'} shutdown complete`);
    
    // Exit with success code
    process.exit(0);
  } catch (error) {
    logger.error(`Error during ${workerName} shutdown:`, error);
    
    // Exit with error code
    process.exit(1);
  }
}

/**
 * Sets up signal handlers for graceful worker shutdown
 * @param {string} workerName - The name of the worker
 * @param {function} customCleanup - Optional custom cleanup function
 */
export function setupWorkerShutdownHandlers(workerName, customCleanup = null) {
  // Handle termination signals
  process.on('SIGTERM', () => {
    logger.warning(`${workerName}: Received SIGTERM`);
    workerGracefulShutdown(workerName, customCleanup);
  });
  
  process.on('SIGINT', () => {
    logger.warning(`${workerName}: Received SIGINT`);
    workerGracefulShutdown(workerName, customCleanup);
  });
  
  // Handle messages from parent (like shutdown command)
  process.on('message', (msg) => {
    if (msg === 'shutdown') {
      logger.warning(`${workerName}: Received shutdown message from parent`);
      workerGracefulShutdown(workerName, customCleanup);
    }
  });
}