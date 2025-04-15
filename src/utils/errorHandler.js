/**
 * Formats error for consistent client-side display
 * @param {Error} error - The error object
 * @param {boolean} includeDetails - Whether to include detailed error info
 * @returns {Object} Formatted error response
 */
export function formatError(error, includeDetails = false) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Base error object
  const errorResponse = {
    success: false,
    message: error.message || 'An unexpected error occurred'
  };
  
  // Include stack trace and details only in development mode
  if (!isProduction && includeDetails) {
    errorResponse.details = error.stack;
    
    // Include response data for API errors
    if (error.response) {
      errorResponse.responseData = error.response.data;
      errorResponse.status = error.response.status;
    }
  }
  
  return errorResponse;
}

/**
 * Express middleware for handling errors
 * @param {Error} err - Error object
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
export default function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Something went wrong';
  
  // Log the error
  console.error(`[${status}] ${err.message}`);
  
  // Render error page for HTML requests
  if (req.accepts('html')) {
    res.status(status).render('error', {
      message,
      error: process.env.NODE_ENV === 'production' ? {} : err,
      validConstantsCount: 5,
      title: `Error - ${status}`
    });
  } else {
    // JSON response for API requests
    res.status(status).json(formatError(err, process.env.NODE_ENV !== 'production'));
  }
}