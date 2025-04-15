import express from 'express';
import Logger from '../utils/logger.js';
import footerConfig from '../config/footer.config.js';

const logger = new Logger('TriggerManiaRoutes');
const router = express.Router();

// Define the base path for this router
export const basePath = '/triggers/mania';

// Define route handlers
router.get('/', (req, res) => {
  res.render('psychodelic-trigger-mania', { 
    title: 'Psychodelic Trigger Mania',
    validConstantsCount: 5,
    footer: footerConfig
  });
});

// Export the router
export default router;