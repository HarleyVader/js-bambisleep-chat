import Logger from '../utils/logger.js';

const logger = new Logger('ErrorHandler');

/**
 * Error types and their default messages
 */
const ERROR_TYPES = {
  VALIDATION_ERROR: {
    statusCode: 400,
    defaultMessage: 'Invalid input data'
  },
  AUTHENTICATION_ERROR: {
    statusCode: 401,
    defaultMessage: 'Authentication required'
  },
  PERMISSION_ERROR: {
    statusCode: 403,
    defaultMessage: 'Permission denied'
  },
  NOT_FOUND_ERROR: {
    statusCode: 404,
    defaultMessage: 'Resource not found'
  },
  CONFLICT_ERROR: {
    statusCode: 409,
    defaultMessage: 'Resource conflict'
  },
  SERVER_ERROR: {
    statusCode: 500,
    defaultMessage: 'Internal server error'
  },
  SERVICE_UNAVAILABLE: {
    statusCode: 503,
    defaultMessage: 'Service temporarily unavailable'
  }
};

/**
 * Create a custom error with type information
 * 
 * @param {string} type - Error type from ERROR_TYPES
 * @param {string} message - Custom error message
 * @param {Object} details - Additional error details
 * @returns {Error} - Enhanced error object
 */
export function createError(type, message, details = {}) {
  const errorInfo = ERROR_TYPES[type] || ERROR_TYPES.SERVER_ERROR;
  const error = new Error(message || errorInfo.defaultMessage);
  
  error.statusCode = errorInfo.statusCode;
  error.type = type;
  error.details = details;
  
  return error;
}

/**
 * Centralized error handler middleware
 * 
 * @param {Error} err - Error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
export default function errorHandler(err, req, res, next) {
  // Get the status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Determine error type for logging
  const errorType = err.type || Object.keys(ERROR_TYPES).find(
    type => ERROR_TYPES[type].statusCode === statusCode
  ) || 'SERVER_ERROR';
  
  // Log the error
  if (statusCode >= 500) {
    logger.error(`[${statusCode}] ${err.message}`, err.stack);
  } else {
    logger.warn(`[${statusCode}] ${err.message}`);
  }
  
  // Helper to determine if request wants HTML or JSON response
  const wantsHtml = req.accepts(['html', 'json']) === 'html';
  
  // For HTML requests, render an error page
  if (wantsHtml) {
    return res.status(statusCode).render('error', {
      message: err.message,
      error: process.env.NODE_ENV === 'production' ? {} : err,
      title: `Error - ${statusCode}`
    });
  }
  
  // For JSON requests, return structured error data
  return res.status(statusCode).json({
    error: {
      type: errorType,
      message: process.env.NODE_ENV === 'production' && statusCode >= 500
        ? ERROR_TYPES.SERVER_ERROR.defaultMessage
        : err.message,
      details: process.env.NODE_ENV === 'production' ? undefined : err.details
    }
  });
}

export { errorHandler };