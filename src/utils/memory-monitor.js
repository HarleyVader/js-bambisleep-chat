import os from 'os';
import Logger from './logger.js';
import GarbageCollector from './garbageCollector.js';
import mongoose from 'mongoose';
import { Worker } from 'worker_threads';

// Create instance of garbage collector
const garbageCollector = new GarbageCollector();

const logger = new Logger('MemoryMonitor');

class MemoryMonitor {  constructor() {
    this.monitoringInterval = null;
    // Read thresholds from environment variables if available
    this.memoryThreshold = process.env.MEMORY_WARNING_THRESHOLD 
      ? parseFloat(process.env.MEMORY_WARNING_THRESHOLD) / 100 
      : 0.75; // 75% memory usage threshold
    this.criticalThreshold = process.env.MEMORY_CRITICAL_THRESHOLD 
      ? parseFloat(process.env.MEMORY_CRITICAL_THRESHOLD) / 100 
      : 0.90; // 90% critical threshold
    this.lastCollectionTime = Date.now();
    this.collectionCooldown = 120000; // 2 minutes between forced collections
    this.isRunning = false;
    this.memoryHistory = []; // Store last 10 memory readings
    this.memoryHistorySize = 10;
    this.previousHeapUsed = 0;
    this.leakDetectionThreshold = 50 * 1024 * 1024; // 50MB
    
    // Log configuration on startup
    logger.info(`Memory monitor initialized with warning threshold: ${Math.round(this.memoryThreshold * 100)}%, critical threshold: ${Math.round(this.criticalThreshold * 100)}%`);
  }
  // Start memory monitoring
  start(interval = 120000) { // Changed from 60s to 120s for 6GB RAM system
    if (this.isRunning) {
      logger.info('Memory monitor is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting memory monitor with ${interval}ms interval`);

    // Initial memory check
    this.checkMemory();

    // Set up interval for regular checks
    this.monitoringInterval = setInterval(() => {
      this.checkMemory();
    }, interval);

    // Set up less frequent checks when memory usage is high
    this.criticalMonitoringInterval = setInterval(() => {
      const memUsage = this.getMemoryUsage();
      
      // If memory usage is above threshold, check more frequently but not too often
      if (memUsage.heapUsedRatio > this.memoryThreshold) {
        this.checkMemory();
      }
    }, 30000); // Check every 30 seconds when memory is high (was 10s)
  }

  // Stop memory monitoring
  stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.criticalMonitoringInterval) {
      clearInterval(this.criticalMonitoringInterval);
      this.criticalMonitoringInterval = null;
    }

    this.isRunning = false;
    logger.info('Memory monitor stopped');
  }

  // Get current memory usage
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
        arrayBuffers: memoryUsage.arrayBuffers
      },
      rss: memoryUsage.rss,
      system: systemMemory,
      heapUsedRatio,
      systemUsedRatio
    };
  }

  // Check memory and take actions if needed
  checkMemory() {
    const memUsage = this.getMemoryUsage();
    
    // Add to history
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
    
    // Log memory usage
    const heapUsedMB = (memUsage.heap.used / 1024 / 1024).toFixed(2);
    const heapTotalMB = (memUsage.heap.total / 1024 / 1024).toFixed(2);
    const rssMB = (memUsage.rss / 1024 / 1024).toFixed(2);
    const systemUsedGB = (memUsage.system.used / 1024 / 1024 / 1024).toFixed(2);
    const systemTotalGB = (memUsage.system.total / 1024 / 1024 / 1024).toFixed(2);
    
    logger.debug(`Memory Usage - Heap: ${heapUsedMB}MB/${heapTotalMB}MB (${(memUsage.heapUsedRatio * 100).toFixed(1)}%), RSS: ${rssMB}MB, System: ${systemUsedGB}GB/${systemTotalGB}GB (${(memUsage.systemUsedRatio * 100).toFixed(1)}%)`);
    
    // Take action if memory usage is above threshold
    if (memUsage.heapUsedRatio > this.memoryThreshold) {
      // If we're within cooldown period, log but don't act
      if (Date.now() - this.lastCollectionTime < this.collectionCooldown) {
        logger.warning(`High memory usage detected (${(memUsage.heapUsedRatio * 100).toFixed(1)}%), but within cooldown period`);
        return;
      }
      
      logger.warning(`High memory usage detected: ${(memUsage.heapUsedRatio * 100).toFixed(1)}% of heap used. Taking action...`);
      this.takeAction(memUsage);
      this.lastCollectionTime = Date.now();
    }
    
    // CRITICAL: If system memory usage is critically high, take emergency action
    if (memUsage.systemUsedRatio > this.criticalThreshold) {
      logger.error(`CRITICAL: System memory usage at ${(memUsage.systemUsedRatio * 100).toFixed(1)}%. Taking emergency action!`);
      this.takeEmergencyAction(memUsage);
      this.lastCollectionTime = Date.now();
    }
  }

  // Detect potential memory leaks
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
    if (consistentIncrease && totalIncrease > this.leakDetectionThreshold) {
      logger.warning(`Potential memory leak detected! Heap increased by ${(totalIncrease / 1024 / 1024).toFixed(2)}MB consistently over last ${this.memoryHistory.length} checks`);
      return true;
    }
    
    return false;
  }

  // Take action when memory is high
  takeAction(memUsage) {
    try {
      // Run garbage collection on available socket stores
      if (global.socketStore) {
        logger.info('Collecting garbage from main socket store');
        garbageCollector.collect(global.socketStore);
      }
      
      // Force Node.js garbage collection if available
      if (global.gc) {
        logger.info('Forcing V8 garbage collection');
        global.gc();
      } else {
        logger.info('V8 garbage collection not available. Start node with --expose-gc flag to enable this feature.');
      }
      
      // Close database connections that aren't active
      if (mongoose.connection.readyState === 1) {
        logger.info('Closing inactive MongoDB connections');
        mongoose.connection.db.admin().ping();
      }
      
      // Log success
      logger.info('Memory cleanup actions completed');
    } catch (error) {
      logger.error(`Error during memory cleanup: ${error.message}`);
    }
  }

  // Emergency action when system memory is critically high
  takeEmergencyAction(memUsage) {
    try {
      // Take regular action first
      this.takeAction(memUsage);
      
      logger.error('EMERGENCY: Attempting to free memory to prevent OOM kill');
      
      // Clear all non-essential caches
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
      if (global.gc) {
        global.gc();
      }
      
      logger.error('Emergency memory cleanup completed');
    } catch (error) {
      logger.error(`Error during emergency memory cleanup: ${error.message}`);
    }
  }
}

// Singleton instance
const memoryMonitor = new MemoryMonitor();
export default memoryMonitor;
