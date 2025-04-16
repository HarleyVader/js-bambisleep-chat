/**
 * Memory management utilities for client-side code
 */
class MemoryManager {
  constructor() {
    this.gcPending = false;
    this.intervals = [];
    this.eventListeners = new Map();
    this.lastWarningTime = 0;
    this.isSupported = typeof performance !== 'undefined' && 
                       typeof performance.memory !== 'undefined';
  }
  
  /**
   * Initialize memory manager
   */
  init() {
    if (!this.isSupported) {
      console.log('Memory management not supported in this browser');
      return;
    }
    
    this.setupMemoryWatcher();
    this.setupEventListenerTracking();
    console.log('Memory manager initialized');
  }
  
  /**
   * Setup memory usage watcher
   */
  setupMemoryWatcher() {
    if (!this.isSupported) return;
    
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
  }
  
  /**
   * Check current memory usage and take action if needed
   */
  checkMemoryUsage() {
    if (!this.isSupported || !performance.memory) return;
    
    const memoryUsage = performance.memory;
    const usedRatio = memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit;
    
    // Log memory stats
    console.log(`Memory usage: ${Math.round(memoryUsage.usedJSHeapSize / 1024 / 1024)}MB / ${Math.round(memoryUsage.jsHeapSizeLimit / 1024 / 1024)}MB (${Math.round(usedRatio * 100)}%)`);
    
    // If memory usage is above 70%, suggest garbage collection
    if (usedRatio > 0.7 && !this.gcPending) {
      this.gcPending = true;
      
      // Don't spam warnings - limit to one every 2 minutes
      const now = Date.now();
      if (now - this.lastWarningTime > 120000) {
        this.lastWarningTime = now;
        console.warn('High memory usage detected. Attempting to free memory...');
        
        // Try to clean up memory
        this.attemptMemoryCleanup();
        
        setTimeout(() => {
          this.gcPending = false;
        }, 10000);
      }
    }
  }
  
  /**
   * Attempt to clean up memory
   */
  attemptMemoryCleanup() {
    // Clear any object caches
    if (window.clientRenderer && window.clientRenderer.componentCache) {
      window.clientRenderer.componentCache.clear();
    }
    
    // Force garbage collection if supported
    if (typeof window.gc === 'function') {
      try {
        window.gc();
        console.log('Forced garbage collection');
      } catch (e) {
        console.log('Failed to force garbage collection', e);
      }
    }
  }
  
  /**
   * Setup tracking of event listeners to detect leaks
   */
  setupEventListenerTracking() {
    try {
      // Override addEventListener
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        const element = this;
        const key = `${element.constructor.name}:${type}`;
        
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
        const key = `${element.constructor.name}:${type}`;
        
        if (window.memoryManager.eventListeners.has(key)) {
          window.memoryManager.eventListeners.get(key).delete(listener);
          if (window.memoryManager.eventListeners.get(key).size === 0) {
            window.memoryManager.eventListeners.delete(key);
          }
        }
        
        return originalRemoveEventListener.call(this, type, listener, options);
      };
    } catch (e) {
      console.warn('Failed to set up event listener tracking', e);
    }
  }
  
  /**
   * Get event listener statistics
   * 
   * @returns {Object} - Event listener stats
   */
  getEventListenerStats() {
    const stats = {};
    for (const [key, listeners] of this.eventListeners.entries()) {
      stats[key] = listeners.size;
    }
    return stats;
  }
  
  /**
   * Clean up memory manager
   */
  cleanup() {
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    this.eventListeners.clear();
    console.log('Memory manager cleaned up');
  }
}

// Initialize memory manager
window.memoryManager = new MemoryManager();
document.addEventListener('DOMContentLoaded', () => {
  window.memoryManager.init();
});