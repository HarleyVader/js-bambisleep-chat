import mongoose from 'mongoose';
import Logger from './logger.js';
import config from '../config/config.js';

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
 * Cleans up memory resources for a worker
 * @param {Object} workerContext - Context data specific to the worker (optional)
 */
export function cleanupWorkerResources(workerContext) {
  // If the worker has in-memory sessions that need to be cleaned up
  if (workerContext && workerContext.sessionHistories) {
    const sessionCount = Object.keys(workerContext.sessionHistories).length;
    if (sessionCount > 0) {
      const logger = new Logger('Cleanup');
      logger.info(`Cleaning up ${sessionCount} active sessions`);
      
      // Clear all sessions
      for (const socketId in workerContext.sessionHistories) {
        delete workerContext.sessionHistories[socketId];
      }
    }
  }
}

/**
 * Handles immediate worker shutdown
 * @param {string} workerName - The name of the worker
 * @param {Object} workerContext - Context data specific to the worker (optional)
 */
export async function workerGracefulShutdown(workerName, workerContext) {
  const workerLogger = new Logger(`Worker:${workerName}`);
  workerLogger.info('Terminating...');
  
  try {
    // Clean up any in-memory resources
    if (workerContext) {
      // Save all session histories to database before cleanup
      if (workerContext.sessionHistories) {
        workerLogger.info('Saving session histories to database before shutdown...');
        
        const sessionIds = Object.keys(workerContext.sessionHistories);
        if (sessionIds.length > 0) {
          try {
            // Save each session to database
            for (const socketId of sessionIds) {
              if (mongoose.connection.readyState === 1) {
                await syncSessionWithDatabase(socketId);
              }
            }
            workerLogger.info(`Successfully saved ${sessionIds.length} sessions to database`);
          } catch (saveError) {
            workerLogger.error(`Error saving sessions to database: ${saveError.message}`);
          }
        }
      }
      
      cleanupWorkerResources(workerContext);
      workerLogger.info('Worker resources cleaned up');
    }
    
    // Close database if connected
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      workerLogger.info('Closing database connection...');
      mongoose.connection.close(true); // force close
    }
  } catch (error) {
    workerLogger.error(`Error during worker shutdown: ${error.message}`);
  }
  
  // Force exit after a short timeout, using a fraction of the worker timeout
  // to ensure we exit before a parent process might force kill us
  setTimeout(() => process.exit(0), Math.min(100, config.WORKER_TIMEOUT / 10));
}

/**
 * Sets up signal handlers for worker shutdown
 * @param {string} workerName - The name of the worker
 * @param {Object} workerContext - Context data specific to the worker (optional)
 */
export function setupWorkerShutdownHandlers(workerName, workerContext) {
  // Handle termination signals with immediate shutdown
  process.on('SIGTERM', () => workerGracefulShutdown(workerName, workerContext));
  process.on('SIGINT', () => workerGracefulShutdown(workerName, workerContext));
  process.on('message', (msg) => {
    if (msg === 'shutdown') workerGracefulShutdown(workerName, workerContext);
  });
  
  // Handle uncaught errors with immediate shutdown
  process.on('uncaughtException', (error) => {
    const workerLogger = new Logger(`Worker:${workerName}`);
    workerLogger.error(`Uncaught exception: ${error.message}`);
    workerGracefulShutdown(workerName, workerContext);
  });
  
  process.on('unhandledRejection', (reason) => {
    const workerLogger = new Logger(`Worker:${workerName}`);
    workerLogger.error(`Unhandled rejection: ${reason}`);
    workerGracefulShutdown(workerName, workerContext);
  });
}

/**
 * Handles socket disconnect cleanup for worker sessions
 * @param {string} socketId - The ID of the disconnected socket
 * @param {Object} sessionHistories - The session histories object to clean up
 */
export function cleanupSocketSession(socketId, sessionHistories) {
  if (sessionHistories && sessionHistories[socketId]) {
    const logger = new Logger('SocketCleanup');
    logger.debug(`Cleaning up session for disconnected socket: ${socketId}`);
    delete sessionHistories[socketId];
    return true;
  }
  return false;
}