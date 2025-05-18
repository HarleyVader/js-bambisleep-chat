import mongoose from 'mongoose';
import Logger from './logger.js';

const logger = new Logger('Shutdown');

// Main graceful shutdown for the server
export default async function gracefulShutdown(signal, server) {
  logger.info('Received shutdown signal');

  try {
    // Check if server is an HTTP server instance
    if (server && typeof server.close === 'function') {
      // Close HTTP server
      await new Promise((resolve) => {
        server.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      });
    } else {
      logger.info('No valid HTTP server to close or already closed');
    }

    // Run cleanup routines
    await performCleanupTasks();

    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    }

    logger.success('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Perform cleanup tasks before shutdown
 */
async function performCleanupTasks() {
  logger.info('Running cleanup tasks before shutdown');
  
  try {
    // Clear any scheduled tasks
    if (global.scheduledTasks) {
      global.scheduledTasks.stop();
      logger.info('Scheduled tasks stopped');
    }
    
    // Release memory
    if (global.gc) {
      logger.info('Forcing garbage collection');
      global.gc();
    }
    
    // Cleanup socket store
    if (global.socketStore) {
      const storeSize = global.socketStore.size;
      global.socketStore.clear();
      logger.info(`Cleared socket store (${storeSize} entries)`);
    }
    
    return true;
  } catch (error) {
    logger.error('Error in cleanup tasks:', error);
    return false;
  }
}

// Setup shutdown handlers for worker threads
export function setupWorkerShutdownHandlers(workerName, context = {}) {
  logger.info(`Setting up shutdown handlers for ${workerName} worker`);
  
  // Make context available to the shutdown handler
  global.workerShutdownContext = context;
  global.workerName = workerName;

  process.on('SIGTERM', async () => {
    logger.info(`${workerName} worker received SIGTERM`);
    await handleWorkerShutdown(workerName, context);
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info(`${workerName} worker received SIGINT`);
    await handleWorkerShutdown(workerName, context);
    process.exit(0);
  });

  process.on('uncaughtException', async (err) => {
    logger.error(`Uncaught exception in ${workerName} worker:`, err);
    await handleWorkerShutdown(workerName, context);
    process.exit(1);
  });
}

// Handle worker thread shutdown
export async function handleWorkerShutdown(workerName, context = {}) {
  logger.info(`Shutting down ${workerName} worker...`);

  try {
    // Close MongoDB connection if open
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logger.info(`MongoDB connection closed for ${workerName} worker`);
    }

    // Perform any worker-specific cleanup using the context
    if (context.sessionHistories) {
      logger.info(`Cleaning up session histories for ${workerName} worker`);
      // Any cleanup logic can go here
    }

    logger.success(`${workerName} worker shutdown complete`);
  } catch (error) {
    logger.error(`Error during ${workerName} worker shutdown:`, error);
  }
}