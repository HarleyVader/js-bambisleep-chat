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

    // Handle user profile/bambi name setting
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

    // Handle profile updates
    socket.on('profile update', (profileData) => {
      logger.info(`Profile update from ${socket.username || 'anonymous'}`);
      // Forward to relevant handler or API endpoint
      io.to(socket.id).emit('profile update status', { 
        success: true, 
        message: 'Profile update received' 
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