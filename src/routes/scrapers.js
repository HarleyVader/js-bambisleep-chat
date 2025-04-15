import express from 'express';
import mongoose from 'mongoose';
import Logger from '../utils/logger.js';
import footerConfig from '../config/footer.config.js';

const logger = new Logger('ScrapersRoutes');
const router = express.Router();

// Define the base path for this router
export const basePath = '/scrapers';

// Export initialization function that can be called during server startup
export async function initializeScrapers() {
  try {
    logger.info('Initializing scrapers system...');
    // Your initialization logic here
    return true;
  } catch (error) {
    logger.error(`Error initializing scrapers: ${error.message}`);
    return false;
  }
}

// Setup function following the new pattern
export function setup(app) {
  logger.info('Setting up scrapers routes');
  
  // Define your routes
  router.get('/', (req, res) => {
    res.render('scrapers', {
      title: 'Content Scrapers',
      validConstantsCount: 5,
      footer: footerConfig
    });
  });
  
  router.get('/list', (req, res) => {
    // API endpoint for listing scrapers
    res.json({ message: 'Scrapers list endpoint' });
  });
  
  return router;
}

export default router;