import http from 'http';
import { Server } from 'socket.io';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Define __dirname first
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import app and other components
import { 
  app, 
  sessionMiddleware, 
  loadFilteredWords,
  initializeScraperSystem,
  initializeWorkerSystem,
} from './src/app.js';

// Use direct import instead of dynamic import
import { Logger } from './src/utils/logger.js';
import dbConnection from './src/database/dbConnection.js';
import gracefulShutdown from './src/utils/gracefulShutdown.js';

// Import socket handlers
import { setupSocketHandlers } from './src/sockets/handlers/handlers.js';

// Initialize logger
const logger = new Logger('Server');

dotenv.config();

// Create HTTP server and socket.io instance
const server = http.createServer(app);
const io = new Server(server);

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

// Delay helper function
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    setupSocketHandlers(io);
    
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