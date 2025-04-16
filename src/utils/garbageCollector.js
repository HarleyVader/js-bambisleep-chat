import Logger from './logger.js';
import { Worker } from 'worker_threads';

// Initialize logger
const logger = new Logger('GarbageCollector');

/**
 * Garbage collector for managing memory usage across workers and sockets
 * CRITICAL: Never collects active socket sessions
 */
export default class GarbageCollector {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.collectionInterval = 300000; // 5 minutes by default
    this.pendingCleanups = new Map(); // Track workers pending cleanup
  }

  // ... other methods stay the same ...

  /**
   * Clean up only disconnected sockets from the socket store
   * @param {Map} socketStore - The socket store to clean
   */
  cleanDisconnectedSockets(socketStore) {
    if (!socketStore || socketStore.size === 0) {
      return;
    }
    
    let removedCount = 0;
    
    // Check each socket in the store
    for (const [socketId, socketData] of socketStore.entries()) {
      try {
        // CRUCIAL: Only process definitively disconnected sockets
        const isDisconnected = !socketData.socket || 
                               socketData.socket.disconnected === true || 
                               socketData.socket.connected === false;
        
        // Skip any socket that might still be active
        if (!isDisconnected) {
          continue;
        }
        
        logger.debug(`Found disconnected socket: ${socketId}`);
        
        // Check if this socket is already in cleanup process
        if (this.pendingCleanups.has(socketId)) {
          logger.debug(`Socket ${socketId} is already in cleanup process, skipping`);
          continue;
        }
        
        // Handle worker cleanup if it exists
        if (socketData.worker) {
          this.pendingCleanups.set(socketId, {
            worker,
            startTime: Date.now(),
            timeoutId: null
          });
          this.cleanupWorker(socketId, socketData.worker, socketStore);
        } else {
          // If no worker, remove from socket store directly
          socketStore.delete(socketId);
          removedCount++;
        }
      } catch (socketError) {
        logger.error(`Error cleaning up socket ${socketId}: ${socketError.message}`);
      }
    }
    
    if (removedCount > 0) {
      logger.info(`Cleaned up ${removedCount} disconnected sockets from store. Remaining: ${socketStore.size}`);
    }
  }

  /**
   * Properly clean up a worker with confirmation
   * @param {string} socketId - The socket ID
   * @param {Worker} worker - The worker thread
   * @param {Map} socketStore - The socket store
   */
  cleanupWorker(socketId, worker, socketStore) {
    // Mark this socket as pending cleanup
    this.pendingCleanups.set(socketId, {
      worker,
      startTime: Date.now(),
      timeoutId: null
    });
    
    try {
      // Set up the message handler for cleanup confirmation
      const messageHandler = (message) => {
        if (message && message.type === 'cleanup:complete' && message.socketId === socketId) {
          logger.debug(`Received cleanup confirmation from worker for socket ${socketId}`);
          
          // Clean up timeout if it exists
          const cleanupData = this.pendingCleanups.get(socketId);
          if (cleanupData && cleanupData.timeoutId) {
            clearTimeout(cleanupData.timeoutId);
          }
          
          // Remove the message handler
          worker.removeListener('message', messageHandler);
          
          // Terminate the worker
          try {
            worker.terminate();
            logger.debug(`Worker for socket ${socketId} terminated after cleanup confirmation`);
          } catch (termError) {
            logger.warning(`Error terminating worker after cleanup: ${termError.message}`);
          }
          
          // Remove from socket store and pending cleanups
          socketStore.delete(socketId);
          this.pendingCleanups.delete(socketId);
          
          logger.info(`Successfully cleaned up socket ${socketId} after worker confirmation`);
        }
      };
      
      // Add the message handler
      worker.on('message', messageHandler);
      socketId.worker.on('message', messageHandler);
      
      // Send cleanup request to worker
      worker.postMessage({
        type: 'socket:disconnect',
        socketId: socketId,
        requestCleanupConfirmation: true
      });
      
      // Set a timeout to force cleanup if worker doesn't respond
      const timeoutId = setTimeout(() => {
        if (this.pendingCleanups.has(socketId)) {
          logger.warning(`Worker for socket ${socketId} did not confirm cleanup within timeout, forcing termination`);
          
          // Remove the message handler
          worker.removeListener('message', messageHandler);
          
          // Force terminate
          try {
            worker.terminate();
            logger.debug(`Worker for socket ${socketId} force-terminated after timeout`);
          } catch (termError) {
            logger.warning(`Error force-terminating worker: ${termError.message}`);
          }
          
          // Remove from socket store and pending cleanups
          socketStore.delete(socketId);
          this.pendingCleanups.delete(socketId);
        }
      }, 5000); // 5 second timeout for worker to respond
      
      // Store the timeout ID
      const cleanupData = this.pendingCleanups.get(socketId);
      if (cleanupData) {
        cleanupData.timeoutId = timeoutId;
        this.pendingCleanups.set(socketId, cleanupData);
      }
      
    } catch (error) {
      logger.error(`Error setting up worker cleanup for socket ${socketId}: ${error.message}`);
      
      // Force cleanup if there's an error in setup
      try {
        worker.terminate();
      } catch (termError) {
        logger.error(`Also failed to terminate worker: ${termError.message}`);
      }
      logger.debug(`Worker for socket ${socketId} terminated after setup error`);
      
      // Clean up
      socketStore.delete(socketId);
      this.pendingCleanups.delete(socketId);
    }
  }

  /**
   * Handle socket disconnect logic
   * @param {string} socketId - The socket ID
   * @param {Map} socketStore - The socket store
   */
  handleSocketDisconnect(socketId, socketStore) {
    try {
      const socketData = socketStore.get(socketId);
      if (!socketData) {
        logger.warning(`Socket ${socketId} not found in store during disconnect handling`);
        return;
      }

      // Perform cleanup logic
      if (socketData.worker) {
        this.cleanupWorker(socketId, socketData.worker, socketStore);
      } else {
        socketStore.delete(socketId);
        logger.info(`Socket ${socketId} removed from store during disconnect handling`);
      }
    } catch (error) {
      logger.error(`Error during socket cleanup: ${error.message}`);
      
      // Mark for garbage collection later if cleanup fails
      // We do NOT remove from socket store here to avoid potential data loss on active connections
    }
  }

  /**
   * Monitor worker health without interfering with active sessions
   * @param {Map} socketStore - The socket store to monitor
   */
  monitorWorkerHealth(socketStore) {
    if (!socketStore || socketStore.size === 0) {
      return;
    }
    
    logger.info(`Performing health check on ${socketStore.size} socket workers`);
    
    // Track problematic workers for reporting
    const problematicWorkers = [];
    
    // Check each socket in the store
    for (const [socketId, socketData] of socketStore.entries()) {
      // Skip if we're already cleaning up this socket
      if (this.pendingCleanups.has(socketId)) {
        continue;
      }
      
      // Check if socket is connected - ONLY check connected sockets
      // We want to ensure their workers are healthy
      const isConnected = socketData.socket && 
                          socketData.socket.connected === true &&
                          socketData.socket.disconnected !== true;
      
      if (isConnected && socketData.worker) {
        try {
          // Set up one-time handler for health response
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Health check timeout')), 5000);
          });
          
          const healthCheckPromise = new Promise((resolve) => {
            const responseHandler = (message) => {
              if (message && message.type === 'health:status' && message.socketId === socketId) {
                socketData.worker.removeListener('message', responseHandler);
                resolve(message);
              }
            };
            
            socketData.worker.on('message', responseHandler);
            
            // Send health check request
            socketData.worker.postMessage({
              type: 'health:check',
              socketId: socketId,
              timestamp: Date.now()
            });
          });
          
          // Race the promises
          Promise.race([healthCheckPromise, timeoutPromise])
            .then(response => {
              // Store last health check result in socket data for monitoring
              socketData.lastHealthCheck = {
                timestamp: Date.now(),
                status: response.status,
                diagnostics: response.diagnostics
              };
              
              if (response.status === 'unhealthy') {
                logger.warning(`Worker for socket ${socketId} reported unhealthy status`);
                problematicWorkers.push({
                  socketId,
                  reason: 'self-reported unhealthy',
                  diagnostics: response.diagnostics
                });
              }
            })
            .catch(error => {
              logger.warning(`Health check failed for worker ${socketId}: ${error.message}`);
              
              // Mark as problematic but DO NOT TERMINATE - socket is still active
              problematicWorkers.push({
                socketId,
                reason: error.message,
                lastActivity: socketData.lastActivity || 'unknown'
              });
              
              // Update last activity time
              socketData.lastActivity = Date.now();
            });
        } catch (error) {
          logger.error(`Error performing health check for socket ${socketId}: ${error.message}`);
        }
      }
    }
    
    // Report on problematic workers after checks complete
    setTimeout(() => {
      if (problematicWorkers.length > 0) {
        logger.warning(`Found ${problematicWorkers.length} potentially problematic workers out of ${socketStore.size} total sockets`);
        // We're logging but NOT taking action on active connections
      }
    }, 6000);
  }

  /**
   * Clean up stale pending cleanups that never completed
   * This prevents memory leaks in the GC itself
   */
  cleanStalePendingCleanups() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [socketId, cleanupData] of this.pendingCleanups.entries()) {
      // If cleanup has been pending for more than 10 minutes, something's wrong
      if (now - cleanupData.startTime > 600000) {
        logger.warning(`Cleaning up stale pending cleanup for socket ${socketId} (pending for ${Math.round((now - cleanupData.startTime) / 1000 / 60)} minutes)`);
        
        // Clear any timeout
        if (cleanupData.timeoutId) {
          clearTimeout(cleanupData.timeoutId);
        }
        
        // Remove from pending cleanups
        this.pendingCleanups.delete(socketId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} stale pending cleanups`);
    }
  }

  /**
   * Run garbage collection cycle
   * @param {Map} socketStore - The socket store
   */
  collect(socketStore) {
    try {
      logger.info('Running garbage collection cycle');
      
      // Skip if no socket store is provided
      if (!socketStore) {
        logger.info('No socket store provided, skipping collection');
        return;
      }
      
      // First, run health checks on active workers
      this.monitorWorkerHealth(socketStore);
      
      // Only clean disconnected sockets - NEVER touch active sessions
      this.cleanDisconnectedSockets(socketStore);
      
      // Clean up stale pending cleanups that never completed
      this.cleanStalePendingCleanups();
      
      // Force V8 garbage collection if possible (only in development)
      this.forceV8GarbageCollection();
      
      logger.info('Garbage collection cycle completed');
    } catch (error) {
      logger.error(`Error during garbage collection: ${error.message}`);
    }
  }
}

// Add to server.js to monitor resource usage
function monitorResources() {
  const memoryUsage = process.memoryUsage();
  logger.info(`Memory usage: RSS ${Math.round(memoryUsage.rss / 1024 / 1024)}MB, Heap ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}/${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`);
  
  if (socketStore) {
    logger.info(`Active sockets: ${socketStore.size}`);
  }
}

// Run every 10 minutes
setInterval(monitorResources, 10 * 60 * 1000);