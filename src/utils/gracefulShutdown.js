import mongoose from 'mongoose';
import Logger from './logger.js';

// Initialize logger
const logger = new Logger('Shutdown');

/**
 * Handle quick server shutdown
 * @param {string} signal - The signal that triggered the shutdown
 * @param {http.Server} server - HTTP server instance
 * @param {Object} workerCoordinator - Worker coordinator instance
 */
export default async function gracefulShutdown(signal, server, workerCoordinator) {
  logger.warning(`Received ${signal}. Shutting down NOW...`);
  
  // Set a hard timeout - we're shutting down no matter what
  const forceExit = setTimeout(() => {
    logger.warning('Force exit timeout reached. Terminating.');
    process.exit(1);
  }, 1000);
  
  try {
    // Step 1: Kill all workers immediately
    if (workerCoordinator) {
      logger.info('Killing worker processes...');
      workerCoordinator.shutdown();
    }
    
    // Step 2: Close server immediately (don't wait for connections to finish)
    if (server) {
      logger.info('Closing server...');
      server.close();
    }
    
    // Step 3: Force database connections closed
    logger.info('Closing database...');
    if (mongoose.connection) {
      mongoose.connection.close(true); // force close
    }
    
    logger.success('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Handles immediate worker shutdown
 * @param {string} workerName - The name of the worker
 */
export async function workerGracefulShutdown(workerName) {
  const workerLogger = new Logger(`Worker:${workerName}`);
  workerLogger.info('Terminating immediately...');
  
  // Force exit after a very short timeout
  setTimeout(() => process.exit(0), 100);
  
  try {
    // Close database if connected
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      mongoose.connection.close(true); // force close
    }
  } catch (error) {
    // Just exit anyway
    process.exit(0);
  }
}

/**
 * Sets up signal handlers for worker shutdown
 * @param {string} workerName - The name of the worker
 */
export function setupWorkerShutdownHandlers(workerName) {
  // Handle termination signals with immediate shutdown
  process.on('SIGTERM', () => workerGracefulShutdown(workerName));
  process.on('SIGINT', () => workerGracefulShutdown(workerName));
  process.on('message', (msg) => {
    if (msg === 'shutdown') workerGracefulShutdown(workerName);
  });
  
  // Handle uncaught errors with immediate shutdown
  process.on('uncaughtException', () => workerGracefulShutdown(workerName));
  process.on('unhandledRejection', () => workerGracefulShutdown(workerName));
}