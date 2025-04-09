import { Logger } from '../utils/logger.js';

const logger = new Logger('DatabaseErrors');

/**
 * Error types specifically for database operations
 */
export class DatabaseError extends Error {
  constructor(message, code = 'DB_ERROR') {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
  }
}

export class ConnectionError extends DatabaseError {
  constructor(message) {
    super(message, 'DB_CONNECTION_ERROR');
    this.name = 'ConnectionError';
  }
}

export class QueryTimeoutError extends DatabaseError {
  constructor(message) {
    super(message, 'DB_QUERY_TIMEOUT');
    this.name = 'QueryTimeoutError';
  }
}

export class ValidationError extends DatabaseError {
  constructor(message) {
    super(message, 'DB_VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Middleware to handle database errors in Express routes
 */
export const databaseErrorHandler = (err, req, res, next) => {
  // Handle mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = {};
    
    // Extract validation errors
    for (const field in err.errors) {
      errors[field] = err.errors[field].message;
    }
    
    logger.warn(`Validation error: ${JSON.stringify(errors)}`);
    return res.status(400).json({
      success: false,
      errors,
      message: 'Validation failed'
    });
  }

  // Handle duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    logger.warn(`Duplicate key error: ${field}`);
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  // Handle custom database errors
  if (err instanceof DatabaseError) {
    logger.error(`Database error (${err.code}): ${err.message}`);
    
    // Return appropriate status based on error type
    let status = 500;
    if (err instanceof ConnectionError) status = 503;
    if (err instanceof QueryTimeoutError) status = 504;
    if (err instanceof ValidationError) status = 400;
    
    return res.status(status).json({
      success: false,
      message: err.message
    });
  }

  // Pass other errors to next error handler
  next(err);
};

/**
 * Wrap a database operation with timeout and error handling
 * @param {Function} dbOperation - Database operation to perform
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} operationName - Name of the operation for logging
 * @returns {Promise<any>} Result of the database operation
 */
export const withDatabaseTimeout = async (dbOperation, timeout = 5000, operationName = 'database operation') => {
  return new Promise(async (resolve, reject) => {
    // Create timeout that rejects the promise
    const timeoutId = setTimeout(() => {
      reject(new QueryTimeoutError(`${operationName} timed out after ${timeout}ms`));
    }, timeout);
    
    try {
      // Execute the database operation
      const result = await dbOperation();
      
      // Clear the timeout and resolve with the result
      clearTimeout(timeoutId);
      resolve(result);
    } catch (error) {
      // Clear the timeout
      clearTimeout(timeoutId);
      
      // Convert mongoose errors to our custom error types
      if (error.name === 'ValidationError') {
        reject(new ValidationError(error.message));
      } else if (error.name === 'MongooseServerSelectionError') {
        reject(new ConnectionError(error.message));
      } else {
        // Wrap other errors
        reject(new DatabaseError(error.message));
      }
    }
  });
};