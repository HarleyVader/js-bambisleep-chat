import Logger from '../utils/logger.js';

const logger = new Logger('Performance');

const performanceMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Store the original end and send methods
  const originalEnd = res.end;
  const originalSend = res.send;
  
  // When response is finished, calculate duration
  res.on('finish', () => {
    // Only process TTS requests
    if (req.originalUrl.startsWith('/api/tts') && req.originalUrl.includes('text=')) {
      const duration = Date.now() - start;
      
      // We don't log anything here anymore - the TTS fetch log in app.js 
      // will include this information now
      
      // Add the duration to res.locals for app.js to use
      res.locals.ttsDuration = duration;
    }
  });
  
  // Replace the end method to collect the duration
  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;
    
    // Store the duration in a property that can be accessed by the TTS API endpoint
    if (!res.locals) res.locals = {};
    res.locals.ttsDuration = duration;
    
    // Call the original end method
    return originalEnd.call(this, chunk, encoding);
  };
  
  // Replace the send method (needed for Express)
  res.send = function(body) {
    const duration = Date.now() - start;
    
    // Store the duration in a property that can be accessed by the TTS API endpoint
    if (!res.locals) res.locals = {};
    res.locals.ttsDuration = duration;
    
    // Call the original send method
    return originalSend.call(this, body);
  };
  
  next();
};

export default performanceMiddleware;