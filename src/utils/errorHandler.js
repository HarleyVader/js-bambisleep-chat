import Logger from '../utils/logger.js';

const logger = new Logger('ErrorHandler');

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
 * Express error handler middleware
 */
export default function errorHandler(err, req, res, next) {
  // Log the error
  logger.error(`API Error: ${err.message}`);
  
  // Determine status code (default to 500)
  const statusCode = err.statusCode || 500;
  
  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production' 
        ? 'Server error occurred'
        : err.message
    }
  });
}