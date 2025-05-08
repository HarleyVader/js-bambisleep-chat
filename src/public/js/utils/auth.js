import Logger from '../../../utils/logger.js';

const logger = new Logger('AuthMiddleware');

/**
 * Middleware to require login for protected routes
 */
export function requireLogin(req, res, next) {
  try {
    // Check for bambiname cookie
    const username = req.cookies?.bambiname;
    
    if (!username || username === 'anonBambi') {
      logger.info(`Unauthorized access attempt to ${req.originalUrl}`);
      return res.redirect('/');
    }
    
    // User is logged in, proceed
    req.username = username;
    next();
  } catch (error) {
    logger.error('Error in auth middleware:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Middleware to check login without requiring it
 */
export function checkLogin(req, res, next) {
  try {
    const username = req.cookies?.bambiname;
    req.username = username || 'anonBambi';
    req.isLoggedIn = username && username !== 'anonBambi';
    next();
  } catch (error) {
    req.username = 'anonBambi';
    req.isLoggedIn = false;
    next();
  }
}