import logger from '../utils/logger.js';
import jwt from 'jsonwebtoken';

export default function auth(req, res, next) {
  try {
    // First try JWT authentication if token exists
    const token = req.cookies.token;
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        return next();
      } catch (jwtError) {
        logger.error(`JWT verification error: ${jwtError.message}`);
        // Continue to try cookie-based auth as fallback
      }
    }
    
    // Fall back to bambiname cookie authentication
    const isAuthenticated = req.cookies && req.cookies.bambiname;
    
    if (!isAuthenticated) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Add user to request using cookie data
    req.user = {
      username: decodeURIComponent(req.cookies.bambiname)
    };
    
    next();
  } catch (error) {
    logger.error(`Auth error: ${error.message}`);
    res.status(401).json({ message: 'Authentication failed' });
  }
}

// Also export named middleware for backward compatibility
export const authMiddleware = auth;