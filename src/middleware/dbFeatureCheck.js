import mongoose from 'mongoose';
import { hasConnection, inFallbackMode } from '../config/db.js';
import Logger from '../utils/logger.js';

const logger = new Logger('DbFeatureCheck');

/**
 * Middleware to check if database is available for required features
 * 
 * @param {boolean} required - Whether the database is required for this route
 * @returns {Function} Express middleware
 */
export function dbFeatureCheck(required = true) {
  return (req, res, next) => {
    // Critical features require working database connection
    if (required) {
      // Check if database is connected
      if (!hasConnection()) {
        logger.warning(`Database required but unavailable for ${req.originalUrl}`);
        return res.status(503).render('error', {
          error: {
            status: 503,
            stack: 'Database connection unavailable'
          },
          message: 'This feature requires a database connection which is currently unavailable. Please try again later.'
        });
      }
      
      // Check if in fallback mode and this is a write operation
      if (inFallbackMode() && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        logger.warning(`Write operation attempted in fallback mode: ${req.method} ${req.originalUrl}`);
        return res.status(503).render('error', {
          error: {
            status: 503,
            stack: 'Database in fallback mode'
          },
          message: 'This write operation cannot be performed while the system is in database fallback mode. Please try again later.'
        });
      }
    }
    
    // Add database status to request object for template rendering
    req.dbStatus = {
      connected: hasConnection(),
      fallbackMode: inFallbackMode(),
      readyState: mongoose.connection.readyState
    };
    
    next();
  };
}

export default dbFeatureCheck;
