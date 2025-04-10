import { handleMessage } from './handlers/messageHandler.js';
import { socketAuth } from './middleware/socketAuth.js';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import Logger from '../utils/logger.js';

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logger
const logger = new Logger('SocketHandlers');

// Active worker instances tracking
const activeWorkers = new Map();

export const setupSocketRoutes = (io) => {
  io.use(socketAuth);

  io.on('connection', (socket) => {
    logger.success(`Client connected: ${socket.id}`);
    startWorkerForSocket(socket.id);

    // Handle user bambi/bambi name setting
    socket.on('set username', (username) => {
      logger.info(`Setting username for socket ${socket.id}: ${username}`);
      socket.username = username;
      // Store in session if available
      if (socket.request.session) {
        socket.request.session.username = username;
        socket.request.session.save();
      }
    });

    // Chat messages
    socket.on('chat message', (msg) => {
      logger.info(`Chat message from ${socket.username || 'anonymous'}`);
      const messageData = {
        username: socket.username || 'anonymous',
        data: msg.data,
        timestamp: new Date()
      };
      io.emit('chat message', messageData);

      // Forward to LMStudio worker if needed
      const worker = activeWorkers.get(socket.id);
      if (worker) {
        worker.postMessage({
          type: 'message',
          data: msg.data,
          socketId: socket.id,
          username: socket.username || 'anonymous'
        });
      }
    });

    // Handle custom collar messages for BambiSleep
    socket.on('collar', (msg) => {
      logger.info(`Collar message from ${socket.username || 'anonymous'}`);
      const worker = activeWorkers.get(socket.id);
      if (worker) {
        worker.postMessage({
          type: 'collar',
          data: msg.data,
          socketId: socket.id
        });
      }
    });

    // Handle trigger updates
    socket.on('update triggers', (triggers) => {
      logger.info(`Trigger update from ${socket.username || 'anonymous'}`);
      const worker = activeWorkers.get(socket.id);
      if (worker) {
        worker.postMessage({
          type: 'triggers',
          triggers: triggers,
          socketId: socket.id
        });
      }
    });

    // Handle query messages for AI processing
    socket.on('query', (data) => {
      logger.info(`Query from ${socket.username || 'anonymous'}: ${JSON.stringify(data).substring(0, 50)}...`);
      const worker = activeWorkers.get(socket.id);
      if (worker) {
        worker.postMessage({
          type: 'query',
          data: data,
          requestId: data.requestId,
          socketId: socket.id
        });
      } else {
        socket.emit('error', { error: 'Worker not available' });
      }
    });

    // Handle bambi updates
    socket.on('bambi update', (bambiData) => {
      logger.info(`bambi update from ${socket.username || 'anonymous'}`);
      // Forward to relevant handler or API endpoint
      io.to(socket.id).emit('bambi update status', { 
        success: true, 
        message: 'bambi update received' 
      });
    });

    // Handle connection info
    socket.on('connection_info', (info) => {
      logger.info(`Connection type for ${socket.id}: ${info.type}`);
      socket.connectionType = info.type; // 'service-worker' or 'direct'
      
      // Store connection info in session if available
      if (socket.request.session) {
        socket.request.session.connectionType = info.type;
        socket.request.session.save();
      }
      
      // Apply different connection settings based on connection type
      if (info.type === 'service-worker') {
        // Service worker connections need longer timeouts since they may go to sleep
        socket.conn.pingInterval = 30000; // 30 seconds
        socket.conn.pingTimeout = 15000; // 15 seconds
        
        // Send acknowledgment to service worker
        socket.emit('connection_info_ack', { 
          status: 'connected',
          type: 'service-worker',
          id: socket.id,
          username: socket.bambiname || null
        });
      } else if (info.type === 'direct') {
        // Direct connections get more frequent heartbeats
        socket.conn.pingInterval = 10000; // 10 seconds
        socket.conn.pingTimeout = 5000; // 5 seconds
        
        // Send acknowledgment to client
        socket.emit('connection_info_ack', { 
          status: 'connected',
          type: 'direct',
          id: socket.id,
          username: socket.bambiname || null
        });
      }
      
      // Update worker with connection info
      const worker = activeWorkers.get(socket.id);
      if (worker) {
        worker.postMessage({
          type: 'connection_info',
          connectionType: info.type,
          socketId: socket.id
        });
      }
    });

    // Handle reconnection attempts
    socket.on('reconnect_attempt', (attemptNumber) => {
      logger.info(`Reconnection attempt ${attemptNumber} for ${socket.id}`);
      
      // If this was a service worker connection, notify client
      if (socket.connectionType === 'service-worker') {
        io.to(socket.id).emit('system', {
          type: 'info',
          message: `Reconnecting (attempt ${attemptNumber})...`
        });
      }
    });

    // Handle successful reconnection
    socket.on('reconnect', () => {
      logger.success(`Client ${socket.id} reconnected successfully`);
      
      // Re-establish any state that was lost during the disconnection
      if (socket.bambiname) {
        // Re-join the user-specific room
        socket.join(`user:${socket.bambiname}`);
      }
      
      // Notify client about successful reconnection
      io.to(socket.id).emit('system', {
        type: 'success',
        message: 'Reconnected successfully'
      });
    });

    // Standard disconnect handler
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
      
      // Clean up worker
      const worker = activeWorkers.get(socket.id);
      if (worker) {
        try {
          worker.postMessage({ type: 'shutdown' });
          activeWorkers.delete(socket.id);
        } catch (error) {
          logger.error(`Error shutting down worker for socket ${socket.id}: ${error.message}`);
        }
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}: ${error.message}`);
    });
  });

  // Handle worker responses
  function handleWorkerMessage(socketId, message) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      logger.warning(`Socket ${socketId} not found for worker message`);
      return;
    }

    switch (message.type) {
      case 'response':
        socket.emit('ai response', message.data);
        break;
      case 'query_response':
        socket.emit('query response', message.data);
        break;
      case 'error':
        socket.emit('error', { error: message.error });
        break;
      default:
        socket.emit('message', message);
    }
  }

  // Start a worker for a socket
  function startWorkerForSocket(socketId) {
    try {
      const workerPath = path.join(__dirname, '..', 'workers', 'lmstudio.js');
      const worker = new Worker(workerPath);
      
      logger.success(`Worker started for socket ${socketId}`);
      
      worker.on('message', (message) => {
        if (message.socketId) {
          handleWorkerMessage(message.socketId, message);
        } else {
          logger.warning(`Worker message without socketId: ${JSON.stringify(message)}`);
        }
      });
      
      worker.on('error', (error) => {
        logger.error(`Worker error for socket ${socketId}: ${error.message}`);
        io.to(socketId).emit('error', { 
          error: 'AI processing error', 
          details: error.message 
        });
      });
      
      worker.on('exit', (code) => {
        logger.warning(`Worker exited with code ${code} for socket ${socketId}`);
        activeWorkers.delete(socketId);
        
        // Notify client if abnormal exit
        if (code !== 0) {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit('error', { 
              error: 'AI processing service restarting',
              reconnect: true
            });
          }
        }
      });
      
      // Store worker reference
      activeWorkers.set(socketId, worker);
      
      return worker;
    } catch (error) {
      logger.error(`Failed to start worker for socket ${socketId}: ${error.message}`);
      io.to(socketId).emit('error', { 
        error: 'Failed to initialize AI processing', 
        details: error.message
      });
      return null;
    }
  }
};

// Initialize socket connection
function initializeSocket() {
  // Check if service workers are supported
  if ('serviceWorker' in navigator) {
    // Original service worker implementation
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
        // Continue with service worker-based socket connection
        setupSocketWithServiceWorker();
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
        // Fall back to direct socket connection
        setupDirectSocketConnection();
      });
  } else {
    console.log('Service Workers not supported in this browser. Using fallback connection...');
    // Fall back to direct socket connection
    setupDirectSocketConnection();
  }
}

function setupSocketWithServiceWorker() {
  // Your existing service worker-based socket implementation
  // This might involve messaging through the service worker
}

function setupDirectSocketConnection() {
  // Direct socket.io connection without service worker
  const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });
  
  // Setup all your socket event handlers here
  socket.on('connect', () => {
    console.log('Connected directly to server');
    // Additional connection setup
  });
  
  socket.on('error', (errorData) => {
    console.error('Socket error:', errorData);
    handleSocketError(errorData);
  });
  
  // All other event handlers
  // socket.on('ai response', ...
  // socket.on('chat message', ...
  
  // Return or store the socket for other parts of your application
  window.appSocket = socket;
  return socket;
}

// Function to handle socket errors consistently in both approaches
function handleSocketError(errorData) {
  // Display error to user
  if (errorData.reconnect) {
    // Show reconnection message
    showNotification('Connection issue. Reconnecting...', 'warning');
    
    // You might want to implement automatic reconnection logic here
    setTimeout(() => {
      if (!window.appSocket.connected) {
        window.location.reload();
      }
    }, 5000);
  } else {
    // Show error message
    showNotification(`Error: ${errorData.error}`, 'error');
    console.error('Socket error details:', errorData.details || 'No details provided');
  }
}

// Helper function to show notifications to the user
function showNotification(message, type) {
  // Implement based on your UI framework (could be a toast, alert, etc.)
  // Example:
  const notificationArea = document.getElementById('notification-area');
  if (notificationArea) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notificationArea.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  } else {
    console.log(`Notification (${type}): ${message}`);
  }
}