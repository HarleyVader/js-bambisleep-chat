import mongoose from 'mongoose';
import db from '../config/db.js';
import Logger from '../utils/logger.js';

const { withDbConnection } = db;

// Create a logger instance properly
const logger = new Logger('ChatMessage');

const chatMessageSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    default: 'anonymous'
  },
  data: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Enhanced message retrieval with better debugging
chatMessageSchema.statics.getRecentMessages = async function(limit = 50) {
  logger.info(`Attempting to retrieve ${limit} recent messages from database`);
  try {
    return withDbConnection(async () => {
      // Track performance of database query
      const startTime = Date.now();
      
      // Get the most recent messages by sorting in descending order (-1)
      const messages = await this.find({})
        .sort({ timestamp: -1 }) 
        .limit(limit)
        .lean();
      
      const queryTime = Date.now() - startTime;
      
      // Log detailed information about the retrieved messages
      logger.info(`Retrieved ${messages.length} messages in ${queryTime}ms`, {
        messageCount: messages.length,
        firstMessageId: messages.length > 0 ? messages[0]._id : null,
        lastMessageId: messages.length > 0 ? messages[messages.length-1]._id : null,
        oldestTimestamp: messages.length > 0 ? messages[messages.length-1].timestamp : null,
        newestTimestamp: messages.length > 0 ? messages[0].timestamp : null,
        performanceMs: queryTime
      });
      
      if (messages.length === 0) {
        logger.warning('No messages found in database, this could indicate a data issue');
      }
      
      // Return in chronological order (oldest first) for UI display
      return messages.reverse();
    });
  } catch (error) {
    logger.error(`Error retrieving recent messages: ${error.message}`, { 
      stack: error.stack,
      limit,
      errorName: error.name,
      code: error.code
    });
    // Return empty array instead of throwing to prevent UI failures
    return [];
  }
};

chatMessageSchema.statics.saveMessage = async function(messageData) {
  logger.info(`Attempting to save message from user: ${messageData.username}`);
  try {
    return withDbConnection(async () => {
      // Add validation check
      if (!messageData.data || typeof messageData.data !== 'string') {
        throw new Error('Invalid message data format');
      }
      
      const message = new this(messageData);
      const startTime = Date.now();
      const savedMessage = await message.save();
      const saveTime = Date.now() - startTime;
      
      logger.info(`Successfully saved message with ID: ${savedMessage._id} in ${saveTime}ms`, {
        messageId: savedMessage._id,
        username: savedMessage.username,
        timestampSaved: savedMessage.timestamp,
        performanceMs: saveTime
      });
      return savedMessage;
    });
  } catch (error) {
    logger.error(`Error saving chat message: ${error.message}`, { 
      stack: error.stack,
      username: messageData.username,
      dataType: typeof messageData.data,
      dataLength: messageData.data ? messageData.data.length : 0,
      errorName: error.name,
      code: error.code
    });
    throw error; // Re-throw to allow caller to handle
  }
};

// Add a new method to check database health
chatMessageSchema.statics.checkHealth = async function() {
  try {
    return withDbConnection(async () => {
      const startTime = Date.now();
      const count = await this.countDocuments({});
      const checkTime = Date.now() - startTime;
      
      logger.info(`Database health check: ${count} total chat messages, query took ${checkTime}ms`);
      return {
        status: 'healthy',
        messageCount: count,
        responseTimeMs: checkTime
      };
    });
  } catch (error) {
    logger.error(`Database health check failed: ${error.message}`, { stack: error.stack });
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

const ChatMessage = mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);

export default ChatMessage;