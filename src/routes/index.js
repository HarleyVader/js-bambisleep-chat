import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import Logger from '../utils/logger.js';
import footerConfig from '../config/footer.config.js';
import { getModel } from '../config/db.js'; // Add this import
import ChatMessage from '../models/ChatMessage.js';

const logger = new Logger('RouteManager');
const router = express.Router();

// Function to dynamically load all route modules
export async function loadAllRoutes(app) {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Get all route files
    const files = await fs.readdir(__dirname);
    const routeFiles = files.filter(file => 
      file !== 'index.js' && 
      file.endsWith('.js')
    );
    
    logger.info(`Found ${routeFiles.length} route modules to load`);
    
    // Load each route module
    for (const file of routeFiles) {
      const moduleName = file.replace('.js', '');
      try {
        logger.info(`Loading route module: ${moduleName}`);
        const routeModule = await import(`./${file}`);
        
        // Check if the module exports a setup function or a router
        if (typeof routeModule.setup === 'function') {
          // Use the setup function
          const moduleRouter = routeModule.setup(app);
          if (moduleRouter) {
            // Check for corresponding view before registering
            const basePath = routeModule.basePath || `/${moduleName}`;
            app.use(basePath, moduleRouter);
            logger.success(`Registered route module '${moduleName}' at path: ${basePath}`);
          }
        } else if (routeModule.default) {
          // Use the default export directly - it should already be a router instance
          const basePath = routeModule.basePath || `/${moduleName}`;
          app.use(basePath, routeModule.default);
          logger.success(`Registered route module '${moduleName}' at path: ${basePath}`);
        } else {
          logger.warning(`Module '${moduleName}' has no default export or setup function`);
        }
      } catch (error) {
        logger.error(`Failed to load route module '${moduleName}': ${error.message}`);
      }
    }
    
    // Register the homepage routes
    app.use('/', router);
    
    // Handle 404 routes - move this to the end after all routes are registered
    app.use((req, res, next) => {
      res.status(404).render('error', {
        message: 'Page not found',
        error: { status: 404 },
        title: 'Error - Page Not Found'
      });
    });
    
    return true;
  } catch (error) {
    logger.error(`Error loading route modules: ${error.message}`);
    return false;
  }
}

// Home page - Shows the chat interface
router.get('/', async (req, res) => {
  try {
    const bambiname = req.cookies && req.cookies.bambiname 
      ? decodeURIComponent(req.cookies.bambiname) 
      : null;
    
    // Get or create profile based on cookie
    let profile = null;
    if (bambiname) {
      const Profile = getModel('Profile');
      profile = await Profile.findOrCreateByCookie(bambiname);
    }
    
    // Get the most recent chat messages
    const chatMessages = await ChatMessage.getRecentMessages(15);
    
    res.render('index', { 
      title: 'BambiSleep.Chat AIGF',
      username: bambiname || 'anonBambi',
      profile: profile || null,
      footer: footerConfig,
      chatMessages: chatMessages.reverse()
    });
  } catch (error) {
    logger.error('Error rendering home page:', error);
    res.status(500).render('index', { 
      title: 'BambiSleep.Chat AIGF',
      profile: req.profile || {},
      chatMessages: [] // Empty array if there's an error
    });
  }
});

export default router;