import mongoose from 'mongoose';
import Logger from './logger.js';

const logger = new Logger('Shutdown');

export default async function gracefulShutdown(server) {
  logger.info('Received shutdown signal');

  try {
    // Close HTTP server
    await new Promise((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });

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