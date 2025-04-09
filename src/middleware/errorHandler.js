export default function errorHandler(err, req, res, next) {
  // Set default status and message
  err.status = err.status || 500;
  const message = err.message || 'Something went wrong';
  
  // Log all errors (could connect to a proper logging service)
  console.error(`[ERROR] ${err.status} - ${message}`, { 
    path: req.path,
    method: req.method,
    stack: err.stack
  });

  // Handle API requests (return JSON)
  if (req.xhr || /application\/json/.test(req.get('Accept'))) {
    return res.status(err.status).json({
      error: {
        status: err.status,
        message: message,
        // Only include stack in development
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
  }

  // Add useful messages for common error codes
  let userMessage = message;
  switch (err.status) {
    case 401:
      userMessage = 'You need to be logged in to access this page';
      break;
    case 403:
      userMessage = 'You don\'t have permission to access this resource';
      break;
    case 404:
      userMessage = 'The page you were looking for could not be found';
      break;
  }

  // For HTML responses, render the error page
  res.status(err.status).render('error', {
    error: {
      ...err,
      // Only include stack in development
      stack: process.env.NODE_ENV === 'development' ? err.stack : ''
    },
    message: userMessage
  });
}