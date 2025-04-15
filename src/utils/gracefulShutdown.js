import mongoose from 'mongoose';
import Logger from './logger.js';
import { closeConnections } from '../config/db.js';

// Initialize logger
const logger = new Logger('Shutdown');

/**
 * Handle graceful server shutdown
 * @param {string} signal - The signal that triggered the shutdown
 * @param {http.Server} server - HTTP server instance
 */
export default async function gracefulShutdown(signal, server) {
  logger.warning(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Step 1: Stop accepting new connections
    logger.info('Closing HTTP server...');
    const serverClosed = new Promise((resolve) => {
      server.close(() => {
        logger.success('HTTP server closed');
        resolve();
      });
    });
    
    // Step 2: Close database connections
    logger.info('Closing database connections...');
    await closeConnections();
    
    // Wait for server to close
    await serverClosed;
    
    logger.success('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

/**
 * Sets up signal handlers for graceful worker shutdown
 * @param {string} workerName - The name of the worker
 * @param {function} customCleanup - Optional custom cleanup function
 */
export function setupWorkerShutdownHandlers(workerName, customCleanup = null) {
  const logger = new Logger(workerName);
  
  async function shutdownHandler(signal) {
    logger.warning(`Worker ${workerName} received ${signal}. Starting graceful shutdown...`);
    
    try {
      // Run custom cleanup if provided
      if (typeof customCleanup === 'function') {
        logger.info('Running custom cleanup...');
        await customCleanup();
      }
      
      // Close mongoose connection if it exists in this context
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        logger.info('Closing database connection...');
        await mongoose.connection.close();
        logger.success('Database connection closed');
      }
      
      logger.success(`Worker ${workerName} shutdown completed`);
      process.exit(0);
    } catch (error) {
      logger.error(`Error during ${workerName} shutdown:`, error);
      process.exit(1);
    }
  }
  
  // Set up signal handlers
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGINT', () => shutdownHandler('SIGINT'));
  process.on('message', (msg) => {
    if (msg === 'shutdown') shutdownHandler('shutdown message');
  });
}