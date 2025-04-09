export const performanceMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // When response is finished, log the time taken
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 500) {
      console.warn(`Slow request: ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });
  
  next();
};