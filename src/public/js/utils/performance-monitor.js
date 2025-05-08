window.performanceMonitor = (function() {
  // Private variables
  let isEnabled = true;
  let metricsHistory = [];
  let lastReportTime = 0;
  let checkInterval = null;
  const REPORT_INTERVAL = 60000; // Report every minute
  const MAX_HISTORY_LENGTH = 10; // Keep last 10 reports
  
  // Performance metrics to track
  let metrics = {
    fps: 0,
    memory: null,
    responseTime: {},
    loadTime: performance.now(),
    errors: 0,
    longTasks: []
  };
  
  // FPS tracking
  let frameCount = 0;
  let lastFrameTime = performance.now();
  
  // Initialize the performance monitor
  function init() {
    try {
      // Check if browser supports Performance API
      if (!window.performance) {
        console.error('Performance API not supported');
        return;
      }
      
      // Set up event listeners
      setupEventListeners();
      
      // Set up periodic checks
      checkInterval = setInterval(periodicCheck, 5000);
      
      // Report initial load time
      metrics.loadTime = Math.round(performance.now());
      
      // Track FPS
      requestAnimationFrame(trackFPS);
      
      // Observe long tasks if available
      observeLongTasks();
      
      console.log('Performance monitor initialized');
    } catch (error) {
      console.error('Error initializing performance monitor:', error);
    }
  }
  
  // Set up event listeners
  function setupEventListeners() {
    // Listen for errors
    window.addEventListener('error', handleError);
    
    // Listen for socket events to track response times
    if (window.socket) {
      const originalEmit = window.socket.emit;
      window.socket.emit = function() {
        const eventName = arguments[0];
        const startTime = performance.now();
        
        // Only track certain events
        if (['message', 'triggers', 'collar', 'system-settings'].includes(eventName)) {
          if (!metrics.responseTime[eventName]) {
            metrics.responseTime[eventName] = { count: 0, total: 0, average: 0 };
          }
          
          // Set up response handler
          const responseHandler = function() {
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Update metrics
            metrics.responseTime[eventName].count++;
            metrics.responseTime[eventName].total += duration;
            metrics.responseTime[eventName].average = 
              metrics.responseTime[eventName].total / metrics.responseTime[eventName].count;
            
            // Remove this listener after first response
            window.socket.off('response', responseHandler);
          };
          
          // Listen for response
          window.socket.on('response', responseHandler);
        }
        
        return originalEmit.apply(this, arguments);
      };
    }
    
    // Track memory usage periodically if available
    if (window.performance && window.performance.memory) {
      metrics.memory = {
        jsHeapSizeLimit: 0,
        totalJSHeapSize: 0,
        usedJSHeapSize: 0
      };
    }
    
    // Listen for visibility changes to pause/resume monitoring
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        pauseMonitoring();
      } else {
        resumeMonitoring();
      }
    });
  }
  
  // Handle errors
  function handleError(event) {
    metrics.errors++;
    
    // If we're collecting too many errors, disable monitoring
    if (metrics.errors > 100) {
      tearDown();
    }
  }
  
  // Track FPS
  function trackFPS(timestamp) {
    if (!isEnabled) return;
    
    frameCount++;
    
    const elapsed = timestamp - lastFrameTime;
    
    // Calculate FPS every second
    if (elapsed >= 1000) {
      metrics.fps = Math.round((frameCount * 1000) / elapsed);
      frameCount = 0;
      lastFrameTime = timestamp;
    }
    
    requestAnimationFrame(trackFPS);
  }
  
  // Observe long tasks API if available
  function observeLongTasks() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // Only track tasks longer than 100ms
            if (entry.duration > 100) {
              metrics.longTasks.push({
                duration: Math.round(entry.duration),
                timestamp: Date.now()
              });
              
              // Keep only last 10 long tasks
              if (metrics.longTasks.length > 10) {
                metrics.longTasks.shift();
              }
            }
          }
        });
        
        observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        console.log('Long Tasks API not supported');
      }
    }
  }
  
  // Periodic check to update metrics
  function periodicCheck() {
    try {
      // Update memory metrics if available
      if (window.performance && window.performance.memory) {
        const memory = window.performance.memory;
        metrics.memory = {
          jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / 1048576),
          totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1048576),
          usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1048576)
        };
      }
      
      // Send report if it's time
      const now = Date.now();
      if (now - lastReportTime > REPORT_INTERVAL) {
        reportMetrics();
        lastReportTime = now;
      }
    } catch (error) {
      console.error('Error in periodic check:', error);
    }
  }
  
  // Report metrics to server
  function reportMetrics() {
    try {
      // Clone current metrics
      const currentMetrics = JSON.parse(JSON.stringify(metrics));
      
      // Add timestamp
      currentMetrics.timestamp = Date.now();
      
      // Calculate uptime
      currentMetrics.uptime = Math.round((performance.now() - metrics.loadTime) / 1000);
      
      // Create summary for logging
      const summary = {
        fps: currentMetrics.fps,
        memoryUsed: currentMetrics.memory?.usedJSHeapSize || 'N/A',
        errors: currentMetrics.errors,
        uptime: currentMetrics.uptime,
        longTasks: currentMetrics.longTasks.length
      };
      
      // Store in history
      metricsHistory.push(currentMetrics);
      
      // Keep history to limited size
      if (metricsHistory.length > MAX_HISTORY_LENGTH) {
        metricsHistory.shift();
      }
      
      // Send to server if socket is connected
      if (window.socket && window.socket.connected) {
        fetch('/api/performance', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            metrics: currentMetrics,
            summary: summary
          })
        }).catch(err => console.error('Error sending metrics:', err));
      }
      
      console.log('Performance report:', summary);
    } catch (error) {
      console.error('Error reporting metrics:', error);
    }
  }
  
  // Pause monitoring
  function pauseMonitoring() {
    isEnabled = false;
  }
  
  // Resume monitoring
  function resumeMonitoring() {
    isEnabled = true;
    lastFrameTime = performance.now();
    requestAnimationFrame(trackFPS);
  }
  
  // Clean up resources
  function tearDown() {
    try {
      // Clear interval
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
      
      // Remove event listeners
      window.removeEventListener('error', handleError);
      document.removeEventListener('visibilitychange', handleVisiblityChange);
      
      // Disable monitoring
      isEnabled = false;
      
      console.log('Performance monitor terminated');
    } catch (error) {
      console.error('Error in tearDown:', error);
    }
  }
  
  // Get current metrics
  function getMetrics() {
    return JSON.parse(JSON.stringify(metrics));
  }
  
  // Get metrics history
  function getHistory() {
    return metricsHistory;
  }
  
  // Public API
  return {
    init,
    tearDown,
    getMetrics,
    getHistory,
    pauseMonitoring,
    resumeMonitoring,
    reportMetrics
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.performanceMonitor.init);

// Global access for debugging
window.tearDownPerformanceMonitor = window.performanceMonitor.tearDown;