import Logger from '../utils/logger.js';

const logger = new Logger('SocketMiddleware');

/**
 * Socket authentication middleware
 * Extracts username from cookies and attaches it to the socket
 */
export const socketAuth = (socket, next) => {
  try {
    // Get bambiname from cookies
    const cookies = socket.request.headers.cookie;
    if (cookies) {
      const bambinameCookie = cookies.split(';').find(c => c.trim().startsWith('bambiname='));
      if (bambinameCookie) {
        const bambiname = decodeURIComponent(bambinameCookie.split('=')[1].trim());
        if (bambiname) {
          // Attach user info to socket
          socket.user = { bambiname };
          socket.bambiname = bambiname;
          logger.info(`Authenticated user: ${bambiname}`);
          return next();
        }
      }
    }
    
    // Allow connection even without authentication
    // Users will be treated as anonymous until they set a BambiName
    logger.info(`Anonymous connection: ${socket.id}`);
    socket.user = { bambiname: null };
    socket.bambiname = null;
    next();
  } catch (error) {
    logger.error(`Auth error: ${error.message}`);
    next();
  }
};

/**
 * Rate limiting middleware for socket connections
 * Prevents abuse by limiting the frequency of certain events
 */
export const rateLimit = (options = {}) => {
  const {
    windowMs = 60000, // 1 minute
    max = 100, // 100 requests per minute
    standardHeaders = true,
    message = 'Too many requests, please try again later.',
    keyGenerator = (socket) => socket.id
  } = options;
  
  // Store for tracking request counts
  const store = new Map();
  
  return (socket, next) => {
    try {
      const key = keyGenerator(socket);
      
      // Get current count or initialize
      const now = Date.now();
      const record = store.get(key) || {
        count: 0,
        resetTime: now + windowMs
      };
      
      // Reset if window has passed
      if (now > record.resetTime) {
        record.count = 0;
        record.resetTime = now + windowMs;
      }
      
      // Increment count
      record.count += 1;
      store.set(key, record);
      
      // Attach remaining counts to socket for potential use
      if (standardHeaders) {
        socket.rateLimit = {
          limit: max,
          current: record.count,
          remaining: Math.max(0, max - record.count),
          resetTime: record.resetTime
        };
      }
      
      // Allow or block request
      if (record.count <= max) {
        next();
      } else {
        // Too many requests
        socket.emit('error', { 
          error: 'Rate limit exceeded', 
          message 
        });
        
        // Still let the connection proceed but the client knows it's rate-limited
        next();
      }
    } catch (error) {
      logger.error(`Rate limit error: ${error.message}`);
      next();
    }
  };
};