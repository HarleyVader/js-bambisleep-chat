import dbConnection from './index.js';
import { DatabaseError } from '../middleware/databaseErrorHandler.js';
import Logger from '../utils/logger.js';

const logger = new Logger('Transactions');

/**
 * Execute a function within a MongoDB transaction
 * @param {Function} operationFn - Function that receives session and performs operations
 * @param {Object} options - Transaction options (readConcern, writeConcern, etc)
 * @returns {Promise<any>} Result of the transaction
 */
export async function withTransaction(operationFn, options = {}) {
  // Default options for transactions
  const transactionOptions = {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
    maxTimeMS: 30000, // 30 seconds max transaction time
    ...options
  };
  
  const session = await dbConnection.startSession();
  let result;
  
  try {
    // Start transaction
    session.startTransaction(transactionOptions);
    logger.info('Transaction started');
    
    // Execute operations within transaction
    result = await operationFn(session);
    
    // Commit transaction
    await session.commitTransaction();
    logger.info('Transaction committed successfully');
    
    return result;
  } catch (error) {
    // Abort transaction on error
    try {
      await session.abortTransaction();
      logger.warn(`Transaction aborted: ${error.message}`);
    } catch (abortError) {
      logger.error(`Error aborting transaction: ${abortError.message}`);
    }
    
    // Re-throw with more context
    throw new DatabaseError(`Transaction failed: ${error.message}`);
  } finally {
    // End session regardless of outcome
    session.endSession();
  }
}