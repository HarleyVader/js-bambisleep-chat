import dbConnection from './dbConnection.js';
import { DatabaseError } from './databaseErrorHandler.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('Transactions');

/**
 * Execute a function within a MongoDB transaction
 * @param {Function} operationFn - Function that receives session and performs operations
 * @param {Object} options - Transaction options (readConcern, writeConcern, etc)
 * @returns {Promise<any>} Result of the transaction
 */
export async function withTransaction(operationFn, options = {}) {
  const session = await dbConnection.startSession();
  
  try {
    let result;
    
    // Set default transaction options
    const defaultOptions = {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' }
    };
    
    // Merge with user provided options
    const transactionOptions = { ...defaultOptions, ...options };
    
    // Start the transaction
    session.startTransaction(transactionOptions);
    
    try {
      // Execute the operations
      result = await operationFn(session);
      
      // Commit the transaction
      await session.commitTransaction();
      logger.success('Transaction committed successfully');
    } catch (error) {
      // Abort the transaction on error
      await session.abortTransaction();
      logger.error(`Transaction aborted: ${error.message}`);
      throw error;
    }
    
    return result;
  } catch (error) {
    // Wrap errors
    if (error instanceof DatabaseError) {
      throw error;
    } else {
      throw new DatabaseError(`Transaction failed: ${error.message}`);
    }
  } finally {
    // End the session
    session.endSession();
  }
}