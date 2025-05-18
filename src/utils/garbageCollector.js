import Logger from './logger.js';

const logger = new Logger('GarbageCollector');

/**
 * Manages application memory through forced garbage collection
 * and cleanup of references
 */
class GarbageCollector {
  constructor() {
    this.lastCollectionTime = Date.now();
    this.collectionCooldown = 60000; // 1 minute between collections
    this.collectionsPerformed = 0;
    
    // Track if global.gc is available (--expose-gc flag)
    this.gcAvailable = typeof global.gc === 'function';
    
    if (!this.gcAvailable) {
      logger.warning('Manual garbage collection unavailable. Start Node.js with --expose-gc flag for better memory management.');
    } else {
      logger.info('Garbage collector initialized with manual collection capability');
    }
  }
  
  /**
   * Forces garbage collection if available and cleans up socket store
   * @param {Map} socketStore Optional socket store to clean
   * @returns {boolean} True if collection was performed
   */
  collect(socketStore = null) {
    const now = Date.now();
    const timeSinceLastCollection = now - this.lastCollectionTime;
    
    // Only collect if cooldown period has passed
    if (timeSinceLastCollection < this.collectionCooldown) {
      return false;
    }
    
    // Clean up socket store if provided
    if (socketStore instanceof Map) {
      this._cleanSocketStore(socketStore);
    }
    
    // Force garbage collection if available
    if (this.gcAvailable) {
      logger.info('Performing manual garbage collection');
      try {
        global.gc();
        this.collectionsPerformed++;
        this.lastCollectionTime = now;
        return true;
      } catch (error) {
        logger.error(`Error during garbage collection: ${error.message}`);
        return false;
      }
    }
    
    return false;
  }
  
  /**
   * Removes disconnected sockets from the socket store
   * @param {Map} socketStore Map of socket.id to socket objects
   * @private
   */
  _cleanSocketStore(socketStore) {
    if (!socketStore || !(socketStore instanceof Map)) {
      return;
    }
    
    let removed = 0;
    for (const [id, socket] of socketStore.entries()) {
      // Check if socket is disconnected
      if (socket && socket.connected === false) {
        socketStore.delete(id);
        removed++;
      }
    }
    
    if (removed > 0) {
      logger.info(`Cleaned up ${removed} disconnected sockets from socket store`);
    }
  }
}

export default GarbageCollector;
