import http from 'http';
import { Server } from 'socket.io';
import os from 'os';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Import app and other components from app.js
import { 
  app, // Import the app instance directly - no need to rename it
  sessionMiddleware, 
  loadFilteredWords,
  initializeScraperSystem,
  initializeWorkerSystem
} from './src/app.js';

// Utilities
import { Logger } from './src/utils/logger.js';
import dbConnection from './src/database/dbConnection.js';
import gracefulShutdown from './src/utils/gracefulShutdown.js';

// Import socket handlers
import { initializeSockets } from './src/sockets/socketManager.js';

// Initialize logger and environment variables
const logger = new Logger('Server');
dotenv.config();

// Create HTTP server using the imported app instance
const server = http.createServer(app);
const io = new Server(server);

// Apply Socket.IO middleware to share session with Socket.IO
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Load filtered words for message filtering
let filteredWords = [];

// Get server network address
function getServerAddress() {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  } catch (error) {
    logger.error('Error in getServerAddress:', error);
    return 'localhost';
  }
}

// Server initialization sequence
async function initializeServer() {
  try {
    // Step 1: Connect to MongoDB
    logger.info('Step 1/5: Connecting to MongoDB...');
    await dbConnection.connect();

    // Step 2: Load filtered words
    logger.info('Step 2/5: Loading filtered words...');
    filteredWords = await loadFilteredWords();
    
    // Step 3: Setup socket handlers
    logger.info('Step 3/5: Setting up socket handlers...');
    initializeSockets(io);
    
    // Step 4: Initialize scrapers and workers
    logger.info('Step 4/5: Initializing subsystems...');
    await initializeScraperSystem();
    await initializeWorkerSystem();

    // Step 5: Start server
    logger.info('Step 5/5: Starting HTTP server...');
    
    // Set up signal handlers for graceful shutdown
    process.on('SIGTERM', async () => {
      await gracefulShutdown('SIGTERM', server);
      await dbConnection.disconnect();
    });
    
    process.on('SIGINT', async () => {
      await gracefulShutdown('SIGINT', server);
      await dbConnection.disconnect();
    });
    
    process.on('uncaughtException', async (err) => {
      logger.error('Uncaught Exception:', err);
      try {
        await gracefulShutdown('UNCAUGHT_EXCEPTION', server);
        await dbConnection.disconnect();
      } catch (error) {
        logger.error('Error during shutdown after uncaught exception:', error);
        process.exit(1);
      }
    });

    const PORT = process.env.SERVER_PORT || 6969;
    server.listen(PORT, async () => {
      logger.success(`Server running on http://${getServerAddress()}:${PORT}`);
      logger.success('Server initialization sequence completed successfully');
    });
  } catch (err) {
    logger.error('Error in server initialization sequence:', err);
    process.exit(1);
  }
}

// Start the server
initializeServer();