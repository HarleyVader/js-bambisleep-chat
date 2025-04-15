import express from 'express';
import footerConfig from '../config/footer.config.js';

const router = express.Router();

// Define route handlers
router.get('/', (req, res) => {
  res.render('help', { 
    title: 'Help Center',
    footer: footerConfig,
    validConstantsCount: 5
  });
});

// Export the router
export default router;