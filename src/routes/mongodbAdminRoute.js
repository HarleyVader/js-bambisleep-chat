import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Logger from '../utils/logger.js';
import footerConfig from '../config/footer.config.js';
import config from '../config/config.js';
import mongoose from 'mongoose';

const logger = new Logger('MongoDBAdminRoute');
const router = express.Router();

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  // Simple admin check - you can replace with your actual auth logic
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.status(403).render('error', {
      title: 'Access Denied',
      message: 'You need admin privileges to access this page',
      error: { status: 403 },
      showFooter: true,
      footerConfig
    });
  }
};

// Apply admin middleware to all routes
router.use(isAdmin);

// MongoDB admin dashboard route
router.get('/', async (req, res) => {
  try {
    // Get MongoDB stats
    const stats = await mongoose.connection.db.stats();
    
    // Render the admin dashboard
    res.render('mongodb-status', { 
      title: 'MongoDB Admin Dashboard',
      showFooter: true,
      footerConfig,
      stats,
      collections: Object.keys(mongoose.connection.collections),
      serverStatus: {
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      }
    });
  } catch (error) {
    logger.error('Error in MongoDB admin dashboard:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Error fetching MongoDB stats',
      error: { status: 500, stack: error.stack },
      showFooter: true,
      footerConfig
    });
  }
});

export { router };
export default router;