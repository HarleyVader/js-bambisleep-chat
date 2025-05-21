import mongoose from 'mongoose';
import Logger from './logger.js';

const logger = new Logger('Shutdown');
let isShuttingDown = false;

// Main graceful shutdown for the server
export default async function gracefulShutdown(signal, server) {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    logger.info('Shutdown already in progress');
    return;
  }
  
  isShuttingDown = true;
  logger.info('Received shutdown signal');

  // Set a 3 second timeout to force exit if shutdown takes too long
  const forceExitTimeout = setTimeout(() => {
    logger.warn('Forced exit after 3 second timeout');
    process.exit(0);
  }, 3000);
  
  try {
    // Run these tasks in parallel to speed up shutdown
    await Promise.all([
      closeServer(server),
      performCleanupTasks(),
      closeMongoConnection()
    ]);

    clearTimeout(forceExitTimeout);
    logger.success('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimeout);
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Helper function to close HTTP server
async function closeServer(server) {
  if (!server || typeof server.close !== 'function') {
    logger.info('No valid HTTP server to close or already closed');
    return;
  }
  
  try {
    // Set the server to not accept new connections
    server.maxConnections = 0;
    
    return new Promise((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });
  } catch (error) {
    logger.error('Error closing server:', error);
    return Promise.resolve();
  }
}

// Helper function to close MongoDB connection
async function closeMongoConnection() {
  if (mongoose.connection.readyState !== 1) {
    return;
  }
  
  try {
    await mongoose.connection.close(false); // false = don't force close
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
  }
}

// Perform cleanup tasks before shutdown
async function performCleanupTasks() {
  logger.info('Running cleanup tasks before shutdown');
  
  try {
    // Clear any scheduled tasks
    if (global.scheduledTasks) {
      global.scheduledTasks.stop();
      logger.info('Scheduled tasks stopped');
    }
        
    // Cleanup socket store
    if (global.socketStore) {
      const storeSize = global.socketStore.size;
      global.socketStore.clear();
      logger.info(`Cleared socket store (${storeSize} entries)`);
    }
    
    // Close all active socket connections
    if (global.io) {
      global.io.close();
      logger.info('Socket.IO connections closed');
    }
    
    // Release memory
    if (global.gc) {
      global.gc();
      logger.info('Garbage collection forced');
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
  
  let isWorkerShuttingDown = false;

  const shutdownWorker = async (signal) => {
    if (isWorkerShuttingDown) return;
    isWorkerShuttingDown = true;
    
    logger.info(`${workerName} worker received ${signal}`);
    
    // Force exit after 3 seconds
    const forceExitTimeout = setTimeout(() => {
      logger.warn(`Forced exit for ${workerName} worker after 3 second timeout`);
      process.exit(0);
    }, 3000);
    
    try {
      await handleWorkerShutdown(workerName, context);
      clearTimeout(forceExitTimeout);
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExitTimeout);
      logger.error(`Error during ${workerName} worker shutdown:`, error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdownWorker('SIGTERM'));
  process.on('SIGINT', () => shutdownWorker('SIGINT'));
  
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception in ${workerName} worker:`, err);
    shutdownWorker('UNCAUGHT_EXCEPTION');
  });
}

// Handle worker thread shutdown
export async function handleWorkerShutdown(workerName, context = {}) {
  logger.info(`Shutting down ${workerName} worker...`);

  try {
    const tasks = [];
    
    // Close MongoDB connection if open
    if (mongoose.connection.readyState === 1) {
      tasks.push(
        mongoose.connection.close(false).then(() => {
          logger.info(`MongoDB connection closed for ${workerName} worker`);
        })
      );
    }

    // Perform any worker-specific cleanup using the context
    if (context.sessionHistories) {
      logger.info(`Cleaning up session histories for ${workerName} worker`);
      // Add any cleanup as a task to the array
    }
    
    // Wait for all cleanup tasks to complete
    await Promise.all(tasks);

    logger.success(`${workerName} worker shutdown complete`);
  } catch (error) {
    logger.error(`Error during ${workerName} worker shutdown:`, error);
  }
}