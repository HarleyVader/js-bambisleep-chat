import os from 'os';
import mongoose from 'mongoose';
import Logger from './logger.js';

const logger = new Logger('MemoryMonitor');

// Unified memory management system for BambiSleep Chat
class MemoryMonitor {  
  constructor() {
    // Configuration
    this.memoryThreshold = process.env.MEMORY_WARNING_THRESHOLD 
      ? parseFloat(process.env.MEMORY_WARNING_THRESHOLD) / 100 
      : 0.75; // 75% memory usage threshold
    this.criticalThreshold = process.env.MEMORY_CRITICAL_THRESHOLD 
      ? parseFloat(process.env.MEMORY_CRITICAL_THRESHOLD) / 100 
      : 0.90; // 90% critical threshold
    this.gcCooldown = 120000; // 2 minutes between forced collections
    this.leakThreshold = 50 * 1024 * 1024; // 50MB increase to detect leak
    
    // State
    this.monitoringInterval = null;
    this.connectionInterval = null;
    this.lastGcTime = Date.now();
    this.isRunning = false;
    this.memoryHistory = []; // Store last 10 memory readings
    this.memoryHistorySize = 10;
    this.intervals = [];
    this.gcAvailable = typeof global.gc === 'function';
    
    // Log config
    logger.info(`Memory monitor initialized with ${Math.round(this.memoryThreshold * 100)}% warning threshold`);
    if (!this.gcAvailable) {
      logger.warning('Manual GC unavailable. Use --expose-gc flag for better memory management.');
    }
  }
      start(interval = 120000) {
    if (this.isRunning) {
      logger.info('Memory monitor already running');
      return this;
    }
    
    this.isRunning = true;
    logger.info(`Starting memory monitor (interval: ${interval}ms)`);
    
    // Initial check
    this.checkMemory();
    
    // Regular checks
    this.monitoringInterval = setInterval(() => {
      this.checkMemory();
    }, interval);
    this.intervals.push(this.monitoringInterval);
    
    // Start database connection monitoring
    this.startConnectionMonitoring();
    
    return this;
  }
  
  startConnectionMonitoring(interval = 60000) {
    // Check MongoDB connection regularly
    this.connectionInterval = setInterval(() => {
      const dbState = mongoose.connection.readyState;
      
      if (dbState !== 1) {
        const stateName = this.getDbStateName(dbState);
        logger.warning(`Database connection issue detected: ${stateName}`);
      }
    }, interval);
    
    this.intervals.push(this.connectionInterval);
  }
  
  getDbStateName(state) {
    switch (state) {
      case 0: return 'disconnected';
      case 1: return 'connected';
      case 2: return 'connecting';
      case 3: return 'disconnecting';
      default: return 'unknown';
    }
  }  stop() {
    if (!this.isRunning) return;
    
    // Clean up all intervals
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    
    // Reset monitoring state
    this.monitoringInterval = null;
    this.connectionInterval = null;
    this.isRunning = false;
    
    logger.info('Memory monitor stopped');
  }
  
  getMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };
    
    // Calculate ratios
    const heapUsedRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
    const systemUsedRatio = systemMemory.used / systemMemory.total;
    
    return {
      heap: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
        ratio: heapUsedRatio
      },
      rss: memoryUsage.rss,
      system: systemMemory,
      heapUsedRatio,
      systemUsedRatio
    };
  }  checkMemory(urgent = false) {
    const memUsage = this.getMemoryUsage();
    
    // Add to history for leak detection
    this.memoryHistory.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heap.used,
      heapTotal: memUsage.heap.total,
      rss: memUsage.rss
    });
    
    // Keep history at fixed size
    if (this.memoryHistory.length > this.memoryHistorySize) {
      this.memoryHistory.shift();
    }
    
    // Check for memory leaks
    this.detectMemoryLeaks();
    
    // For logging - calculate all values
    const heapUsedMB = (memUsage.heap.used / 1024 / 1024).toFixed(1);
    const heapTotalMB = (memUsage.heap.total / 1024 / 1024).toFixed(1);
    const rssMB = (memUsage.rss / 1024 / 1024).toFixed(1);
    
    // Only log detailed memory info occasionally to reduce log spam
    if (!this.checkCount) this.checkCount = 0;
    this.checkCount++;
    
    if (urgent || this.checkCount % 5 === 0) {
      logger.info(`Memory: ${heapUsedMB}MB / ${heapTotalMB}MB (${(memUsage.heap.ratio * 100).toFixed(1)}%) - RSS: ${rssMB}MB`);
    }
    
    // Take action if memory usage is above threshold
    if (memUsage.heapUsedRatio > this.memoryThreshold) {
      // If we're within cooldown period, log but don't act
      if (!urgent && Date.now() - this.lastGcTime < this.gcCooldown) {
        logger.warning(`High memory usage detected (${(memUsage.heapUsedRatio * 100).toFixed(1)}%), but within cooldown period`);
        return;
      }
      
      logger.warning(`High memory usage detected: ${(memUsage.heapUsedRatio * 100).toFixed(1)}% of heap used. Taking action...`);
      this.collectGarbage(memUsage);
      this.lastGcTime = Date.now();
    }
    
    // CRITICAL: If system memory usage is critically high, take emergency action
    if (memUsage.systemUsedRatio > this.criticalThreshold) {
      logger.error(`CRITICAL: System memory usage at ${(memUsage.systemUsedRatio * 100).toFixed(1)}%. Taking emergency action!`);
      this.handleMemoryEmergency(memUsage);
      this.lastGcTime = Date.now();
    }
  }
  detectMemoryLeaks() {
    if (this.memoryHistory.length < 2) {
      return false;
    }
    
    // Check for consistent increase in memory usage
    let consistentIncrease = true;
    let totalIncrease = 0;
    
    for (let i = 1; i < this.memoryHistory.length; i++) {
      const current = this.memoryHistory[i].heapUsed;
      const previous = this.memoryHistory[i-1].heapUsed;
      const increase = current - previous;
      
      totalIncrease += increase;
      
      // If any decrease, it's not a consistent increase
      if (increase <= 0) {
        consistentIncrease = false;
      }
    }
    
    // If we have a consistent increase that exceeds our threshold
    if (consistentIncrease && totalIncrease > this.leakThreshold) {
      logger.warning(`Potential memory leak detected! Heap increased by ${(totalIncrease / 1024 / 1024).toFixed(2)}MB consistently over last ${this.memoryHistory.length} checks`);
      return true;
    }
    
    return false;
  }  collectGarbage(memUsage) {
    try {
      // Clean up socket stores
      if (global.socketStore) {
        logger.info('Cleaning disconnected sockets');
        this.cleanSocketStore(global.socketStore);
      }
      
      // Force V8 garbage collection if available
      if (this.gcAvailable) {
        logger.info('Forcing V8 garbage collection');
        global.gc();
      } else {
        logger.info('V8 garbage collection not available. Start node with --expose-gc flag for better memory management.');
      }
      
      // Refresh MongoDB connection to clear stale connections
      this.refreshDatabaseConnection();
      
      logger.info('Memory cleanup completed');
    } catch (error) {
      logger.error(`Error during garbage collection: ${error.message}`);
    }
  }
  
  // Add a new method to refresh database connections
  async refreshDatabaseConnection() {
    try {
      if (mongoose.connection.readyState === 1) {
        logger.info('Refreshing MongoDB connection');
        
        // Try to use the connection pool monitor if available
        try {
          const connectionPoolMonitor = await import('./connectionPoolMonitor.js');
          const refreshConnectionPool = connectionPoolMonitor.default?.refreshConnectionPool;
          
          if (typeof refreshConnectionPool === 'function') {
            await refreshConnectionPool();
            return;
          }
        } catch (importError) {
          // If import fails, use a simpler approach
        }
        
        // Fall back to a simple ping
        await mongoose.connection.db.command({ ping: 1 });
      }
    } catch (error) {
      logger.debug(`Database refresh error: ${error.message}`);
    }
  }
  
  cleanSocketStore(socketStore) {
    if (!socketStore || !(socketStore instanceof Map)) return 0;
    
    let removed = 0;
    const now = Date.now();
    
    for (const [id, socket] of socketStore.entries()) {
      // Remove disconnected sockets
      if (socket && socket.connected === false) {
        socketStore.delete(id);
        removed++;
      }
      
      // Also clean very old idle sockets
      if (socket && socket.lastActivity) {
        const idleTime = now - socket.lastActivity;
        if (idleTime > 1800000) { // 30 minutes
          logger.info(`Cleaning idle socket ${id} (idle for ${Math.round(idleTime/1000/60)}m)`);
          socketStore.delete(id);
          removed++;
        }
      }
    }
    
    if (removed > 0) {
      logger.info(`Cleaned ${removed} sockets from socket store`);
    }
    
    return removed;
  }
    handleMemoryEmergency(memUsage) {
    try {
      // First try regular garbage collection
      this.collectGarbage(memUsage);
      
      logger.error('EMERGENCY: Attempting to free memory to prevent OOM kill');
      
      // Clear session histories
      if (global.sessionHistories) {
        const sessionCount = Object.keys(global.sessionHistories).length;
        logger.warning(`Emergency clearing ${Math.floor(sessionCount * 0.5)} oldest sessions`);
        
        // Get sessions sorted by last activity
        const sessions = Object.entries(global.sessionHistories)
          .map(([id, data]) => ({ 
            id, 
            lastActivity: data.metadata?.lastActivity || 0 
          }))
          .sort((a, b) => a.lastActivity - b.lastActivity);
        
        // Remove half of them
        const toRemove = sessions.slice(0, Math.floor(sessions.length * 0.5));
        toRemove.forEach(session => {
          delete global.sessionHistories[session.id];
        });
        
        logger.warning(`Emergency cleared ${toRemove.length} sessions`);
      }
      
      // Force garbage collection again
      if (this.gcAvailable) {
        global.gc();
      }
      
      logger.error('Emergency memory cleanup completed');
    } catch (error) {
      logger.error(`Error during emergency cleanup: ${error.message}`);
    }
  }  getClientScript() {
    return `
// Memory management for client-side
window.memoryManager = {
  gcPending: false,
  intervals: [],
  eventListeners: new Map(),
  lastWarningTime: 0,
  
  init() {
    if (typeof performance === 'undefined' || !performance.memory) {
      console.log('Memory management not supported in this browser');
      return;
    }
    
    this.setupMemoryWatcher();
    this.setupEventListenerTracking();
    console.log('Memory manager initialized');
  },
  
  setupMemoryWatcher() {
    // Check memory usage every 30 seconds
    const interval = setInterval(() => {
      this.checkMemoryUsage();
    }, 30000);
    
    this.intervals.push(interval);
    
    // Also check on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkMemoryUsage();
      }
    });
  },
  
  checkMemoryUsage() {
    if (!performance.memory) return;
    
    const memoryUsage = performance.memory;
    const usedRatio = memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit;
    
    // Log memory stats
    console.log(\`Memory: \${Math.round(memoryUsage.usedJSHeapSize / 1024 / 1024)}MB / \${Math.round(memoryUsage.jsHeapSizeLimit / 1024 / 1024)}MB (\${Math.round(usedRatio * 100)}%)\`);
    
    // If memory usage is high, clean up
    if (usedRatio > 0.7 && !this.gcPending) {
      this.gcPending = true;
      
      // Don't spam warnings
      const now = Date.now();
      if (now - this.lastWarningTime > 120000) {
        this.lastWarningTime = now;
        console.warn('High memory usage detected. Cleaning up...');
        this.cleanupMemory();
        
        setTimeout(() => {
          this.gcPending = false;
        }, 10000);
      }
    }
  },
  
  cleanupMemory() {
    // Clear component cache
    if (window.clientRenderer && window.clientRenderer.componentCache) {
      window.clientRenderer.componentCache.clear();
    }
    
    // Clean DOM - limit chat messages
    const chatList = document.getElementById('chat-response');
    if (chatList && chatList.children.length > 50) {
      while (chatList.children.length > 50) {
        chatList.removeChild(chatList.firstChild);
      }
    }
    
    // Force GC if available
    if (typeof window.gc === 'function') {
      try {
        window.gc();
        console.log('Forced garbage collection');
      } catch (e) {
        console.log('Failed to force GC:', e);
      }
    }
  },
  
  setupEventListenerTracking() {
    try {
      // Override addEventListener
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        const element = this;
        const key = \`\${element.constructor.name}:\${type}\`;
        
        if (!window.memoryManager.eventListeners.has(key)) {
          window.memoryManager.eventListeners.set(key, new Set());
        }
        
        window.memoryManager.eventListeners.get(key).add(listener);
        
        return originalAddEventListener.call(this, type, listener, options);
      };
      
      // Override removeEventListener
      const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
      EventTarget.prototype.removeEventListener = function(type, listener, options) {
        const element = this;
        const key = \`\${element.constructor.name}:\${type}\`;
        
        if (window.memoryManager.eventListeners.has(key)) {
          window.memoryManager.eventListeners.get(key).delete(listener);
          if (window.memoryManager.eventListeners.get(key).size === 0) {
            window.memoryManager.eventListeners.delete(key);
          }
        }
        
        return originalRemoveEventListener.call(this, type, listener, options);
      };
    } catch (e) {
      console.warn('Failed to set up event listener tracking:', e);
    }
  },
  
  getEventListenerStats() {
    const stats = {};
    for (const [key, listeners] of this.eventListeners.entries()) {
      stats[key] = listeners.size;
    }
    return stats;
  },
  
  cleanup() {
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    this.eventListeners.clear();
    console.log('Memory manager cleaned up');
  }
};

// Initialize memory manager
document.addEventListener('DOMContentLoaded', () => {
  window.memoryManager.init();
});
`;
  }
}

// Create singleton instance
const memoryMonitor = new MemoryMonitor();
export default memoryMonitor;
