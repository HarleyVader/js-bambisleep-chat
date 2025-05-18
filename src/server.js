import { promises as fsPromises } from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';

// Import modules
import cors from 'cors';
import helmet from 'helmet';

// Import configuration
import config from './config/config.js';
import footerConfig from './config/footer.config.js';

// Import routes
import indexRouter from './routes/index.js';
import helpRouter from './routes/help.js';
import profileRouter from './routes/profile.js';
import { router as mongodbRoutesRouter } from './routes/mongodbRoutes.js';

const mongodbBasePath = '/mongodb';

// Initialize environment and paths
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logger
const logger = new Logger('Server');
logger.info('Starting BambiSleep.chat server...');

/**
 * Main application setup
 */
async function initializeApp() {
  const app = express();
  
  // Setup middleware
  setupMiddleware(app);
  
  // Setup routes
  setupRoutes(app);
  
  return app;
}

/**
 * Configure Express middleware
 */
function setupMiddleware(app) {
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static('public'));
  
  // Security middleware
  app.use(helmet());
  app.use(cors());
}

/**
 * Configure routes for the application
 */
function setupRoutes(app) {
  const routes = [
    { path: '/', handler: indexRouter },
    { path: '/help', handler: helpRouter },
    { path: '/profile', handler: profileRouter },
    { path: mongodbBasePath, handler: mongodbRoutesRouter }
  ];

  routes.forEach(route => {
    app.use(route.path, route.handler);
  });
}

/**
 * Main server initialization sequence
 */
async function startServer() {
  try {
    logger.info('Step 1/3: Initializing application...');
    const app = await initializeApp();
    logger.success('Application initialized');
    
    logger.info('Step 2/3: Starting HTTP server...');
    const PORT = config.SERVER_PORT || 6969;
    
    const server = http.createServer(app);
    server.listen(PORT, () => {
      logger.success(`Server running on http://localhost:${PORT}`);
      logger.success('Server startup completed successfully');
    });
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
    process.on('SIGINT', () => gracefulShutdown('SIGINT', server));
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception:', err);
      gracefulShutdown('UNCAUGHT_EXCEPTION', server);
    });
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION', server);
    });
    
    return server;
  } catch (error) {
    logger.error('Error during server startup:', error);
    process.exit(1);
  }
}

startServer();