// messageQueue.js - Reliable message delivery system
import Logger from './logger.js';

const logger = new Logger('MessageQueue');

// Map of message queues by socketId
const messageQueues = new Map();

// Maximum queue size per socket
const MAX_QUEUE_SIZE = 20;

/**
 * Queue a message for reliable delivery
 * @param {string} socketId - The socket ID to queue for
 * @param {Object} message - The message to queue
 * @param {string} messageType - Type of message (response, xp:update, etc)
 * @returns {boolean} - Whether the message was queued
 */
export function queueMessage(socketId, message, messageType) {
  if (!socketId) {
    logger.error('Cannot queue message: No socketId provided');
    return false;
  }

  // Create queue if it doesn't exist
  if (!messageQueues.has(socketId)) {
    messageQueues.set(socketId, []);
  }

  const queue = messageQueues.get(socketId);
  
  // Check if queue is full
  if (queue.length >= MAX_QUEUE_SIZE) {
    logger.warning(`Message queue full for socket ${socketId}, dropping oldest message`);
    queue.shift(); // Remove oldest message
  }

  // Add message to queue with timestamp
  queue.push({
    message,
    type: messageType,
    timestamp: Date.now(),
    attempts: 0
  });

  logger.debug(`Queued ${messageType} message for ${socketId}. Queue size: ${queue.length}`);
  return true;
}

/**
 * Get all queued messages for a socket
 * @param {string} socketId - The socket ID
 * @returns {Array} - Array of queued messages
 */
export function getQueuedMessages(socketId) {
  if (!socketId || !messageQueues.has(socketId)) {
    return [];
  }
  return [...messageQueues.get(socketId)];
}

/**
 * Clear a message from the queue after successful delivery
 * @param {string} socketId - The socket ID
 * @param {number} timestamp - Timestamp of the message to clear
 * @returns {boolean} - Whether a message was cleared
 */
export function clearMessage(socketId, timestamp) {
  if (!socketId || !messageQueues.has(socketId)) {
    return false;
  }

  const queue = messageQueues.get(socketId);
  const initialLength = queue.length;
  
  // Remove message with matching timestamp
  const newQueue = queue.filter(item => item.timestamp !== timestamp);
  messageQueues.set(socketId, newQueue);

  const removed = initialLength > newQueue.length;
  if (removed) {
    logger.debug(`Cleared delivered message for ${socketId}. Queue size: ${newQueue.length}`);
  }
  
  return removed;
}

/**
 * Process queued messages for a socket
 * @param {Socket} socket - The connected socket
 * @returns {number} - Number of messages processed
 */
export function processQueue(socket) {
  if (!socket || !socket.id || !socket.connected) {
    return 0;
  }

  const socketId = socket.id;
  if (!messageQueues.has(socketId)) {
    return 0;
  }

  const queue = messageQueues.get(socketId);
  if (queue.length === 0) {
    return 0;
  }

  logger.info(`Processing message queue for ${socketId}. ${queue.length} messages pending.`);
  
  let processed = 0;
  
  // Process each message in queue
  queue.forEach((item) => {
    try {
      // Emit the message to the socket
      socket.emit(item.type, item.message);
      
      // Mark for removal
      item.delivered = true;
      processed++;
      
      logger.debug(`Delivered queued ${item.type} message to ${socketId}`);
    } catch (error) {
      logger.error(`Failed to deliver queued message to ${socketId}: ${error.message}`);
      item.attempts++;
    }
  });
  
  // Clear delivered messages
  const newQueue = queue.filter(item => !item.delivered);
  messageQueues.set(socketId, newQueue);
  
  logger.info(`Delivered ${processed} queued messages to ${socketId}. ${newQueue.length} remaining.`);
  return processed;
}

/**
 * Clear queue for a socket when it's no longer needed
 * @param {string} socketId - The socket ID
 */
export function clearQueue(socketId) {
  if (messageQueues.has(socketId)) {
    const queueSize = messageQueues.get(socketId).length;
    messageQueues.delete(socketId);
    logger.info(`Cleared message queue for ${socketId}. ${queueSize} messages dropped.`);
  }
}

// Clean up old queues periodically
setInterval(() => {
  const now = Date.now();
  const MAX_AGE = 30 * 60 * 1000; // 30 minutes
  
  messageQueues.forEach((queue, socketId) => {
    // Remove messages older than MAX_AGE
    const newQueue = queue.filter(item => (now - item.timestamp) < MAX_AGE);
    
    if (newQueue.length < queue.length) {
      logger.info(`Cleaned up ${queue.length - newQueue.length} old messages for ${socketId}`);
      messageQueues.set(socketId, newQueue);
    }
    
    // Remove empty queues
    if (newQueue.length === 0) {
      messageQueues.delete(socketId);
      logger.debug(`Removed empty message queue for ${socketId}`);
    }
  });
}, 10 * 60 * 1000); // Run every 10 minutes

export default {
  queueMessage,
  getQueuedMessages,
  clearMessage,
  processQueue,
  clearQueue
};
