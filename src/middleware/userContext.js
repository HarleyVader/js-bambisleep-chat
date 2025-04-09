import logger from '../utils/logger.js';

export const userContextMiddleware = (req, res, next) => {
  try {
    // Extract username from cookie or session
    const username = req.cookies && req.cookies.bambiname 
      ? decodeURIComponent(req.cookies.bambiname) 
      : null;
    
    // Attach to a shared context object
    req.bambiContext = {
      username,
      isAuthenticated: !!username && username !== 'anonBambi'
    };
    
    // Make available to views
    res.locals.bambiContext = req.bambiContext;
    
    next();
  } catch (error) {
    logger.error(`Error in userContext middleware: ${error.message}`);
    next();
  }
};