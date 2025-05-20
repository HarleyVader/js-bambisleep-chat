// socketMonitor.js - Monitoring and recovery for socket connections
import Logger from './logger.js';

const logger = new Logger('SocketMonitor');

// Track connection metrics
const socketMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  disconnections: 0,
  reconnections: 0,
  failedReconnections: 0,
  connectionTimes: {}
};

// Map to track reconnection attempts
const reconnectionAttempts = new Map();
const MAX_RECONNECTION_ATTEMPTS = 5;

/**
 * Monitor socket connections and handle reconnection logic
 */
export function setupSocketMonitoring(io, socketStore) {
  // Setup interval to log connection metrics
  setInterval(() => {
    logger.info(`Socket Stats: Active=${socketMetrics.activeConnections}, Total=${socketMetrics.totalConnections}, Disconnects=${socketMetrics.disconnections}, Reconnects=${socketMetrics.reconnections}`);
  }, 60000); // Log every minute

  // Handle connection
  io.on('connection', (socket) => {
    const socketId = socket.id;
    socketMetrics.totalConnections++;
    socketMetrics.activeConnections++;
    socketMetrics.connectionTimes[socketId] = Date.now();

    // Clear any previous reconnection attempts
    if (reconnectionAttempts.has(socketId)) {
      reconnectionAttempts.delete(socketId);
    }

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      socketMetrics.disconnections++;
      socketMetrics.activeConnections--;
      logger.info(`Socket ${socketId} disconnected: ${reason}`);

      // Start reconnection tracking only for certain disconnect reasons
      if (['transport close', 'ping timeout'].includes(reason)) {
        reconnectionAttempts.set(socketId, { 
          attempts: 0, 
          username: socket.bambiUsername || 'unknown', 
          lastAttempt: Date.now()
        });
      }

      // Remove from connection times
      delete socketMetrics.connectionTimes[socketId];
    });

    // Track reconnection
    socket.on('reconnect', (attemptNumber) => {
      socketMetrics.reconnections++;
      logger.info(`Socket ${socketId} reconnected after ${attemptNumber} attempts`);
    });

    socket.on('reconnect_failed', () => {
      socketMetrics.failedReconnections++;
      logger.error(`Socket ${socketId} failed to reconnect`);
    });
  });

  // Check for sockets that need reconnection
  setInterval(() => {
    checkForReconnectionNeeds(socketStore);
  }, 30000); // Check every 30 seconds
}

/**
 * Check if any disconnected sockets need recovery
 */
function checkForReconnectionNeeds(socketStore) {
  const now = Date.now();
  
  reconnectionAttempts.forEach((data, socketId) => {
    // Skip if we've tried too many times
    if (data.attempts >= MAX_RECONNECTION_ATTEMPTS) {
      logger.warning(`Abandoning reconnection for ${socketId} (${data.username}) after ${data.attempts} attempts`);
      reconnectionAttempts.delete(socketId);
      return;
    }

    // Only try again after at least 10 seconds
    if (now - data.lastAttempt < 10000) {
      return;
    }

    // Increment attempt counter and update timestamp
    data.attempts++;
    data.lastAttempt = now;
    
    // Try to recover the session
    logger.info(`Attempting to recover session for ${socketId} (${data.username}), attempt ${data.attempts}`);
    
    // Here you would implement the actual recovery logic
    // This might involve creating a new socket, reloading session history, etc.
  });
}

export default { 
  setupSocketMonitoring,
  getMetrics: () => ({ ...socketMetrics })
};
