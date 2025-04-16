/**
 * Performance monitoring utility for client-side rendering
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      renders: {},
      interactions: {},
      resources: {},
      memory: {}
    };
    
    this.isRecording = false;
    this.startTime = 0;
    this.observers = new Set();
  }
  
  /**
   * Start recording performance metrics
   */
  startRecording() {
    if (this.isRecording) return;
    
    this.isRecording = true;
    this.startTime = performance.now();
    this.setupResourceObserver();
    this.setupInteractionObserver();
    this.setupMemoryMonitoring();
    
    console.log('Performance monitoring started');
  }
  
  /**
   * Stop recording performance metrics
   * 
   * @returns {Object} - Collected metrics
   */
  stopRecording() {
    if (!this.isRecording) return this.metrics;
    
    this.isRecording = false;
    const duration = performance.now() - this.startTime;
    this.metrics.duration = duration;
    
    // Clean up observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    
    console.log('Performance monitoring stopped', this.metrics);
    return this.metrics;
  }
  
  /**
   * Setup resource observer to monitor network requests
   */
  setupResourceObserver() {
    if (!PerformanceObserver) {
      console.warn('PerformanceObserver not supported in this browser');
      return;
    }
    
    try {
      const resourceObserver = new PerformanceObserver(list => {
        list.getEntries().forEach(entry => {
          if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
            const url = new URL(entry.name).pathname;
            if (!this.metrics.resources[url]) {
              this.metrics.resources[url] = [];
            }
            this.metrics.resources[url].push({
              duration: entry.duration,
              startTime: entry.startTime,
              transferSize: entry.transferSize
            });
          }
        });
      });
      
      resourceObserver.observe({ type: 'resource', buffered: true });
      this.observers.add(resourceObserver);
    } catch (err) {
      console.warn('Error setting up resource observer:', err);
    }
  }
  
  /**
   * Setup interaction observer to monitor user interactions
   */
  setupInteractionObserver() {
    if (!PerformanceObserver || !PerformanceObserver.supportedEntryTypes || 
        !PerformanceObserver.supportedEntryTypes.includes('event')) {
      console.warn('Event timing not supported in this browser');
      return;
    }
    
    try {
      const interactionObserver = new PerformanceObserver(list => {
        list.getEntries().forEach(entry => {
          const target = entry.target ? entry.target.localName : 'unknown';
          const type = entry.name;
          const key = `${target}:${type}`;
          
          if (!this.metrics.interactions[key]) {
            this.metrics.interactions[key] = [];
          }
          
          this.metrics.interactions[key].push({
            duration: entry.duration,
            startTime: entry.startTime
          });
        });
      });
      
      interactionObserver.observe({ type: 'event', buffered: true, durationThreshold: 16 });
      this.observers.add(interactionObserver);
    } catch (err) {
      console.warn('Error setting up interaction observer:', err);
    }
  }
  
  /**
   * Setup memory monitoring if available
   */
  setupMemoryMonitoring() {
    if (typeof performance.memory === 'undefined') {
      console.warn('Memory API not available in this browser');
      return;
    }
    
    // Sample memory usage every 5 seconds
    const memoryInterval = setInterval(() => {
      if (!this.isRecording) {
        clearInterval(memoryInterval);
        return;
      }
      
      const timestamp = performance.now() - this.startTime;
      this.metrics.memory[timestamp] = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }, 5000);
  }
  
  /**
   * Record a component render
   * 
   * @param {string} componentName - Name of the component
   * @param {number} startTime - Start time of the render
   */
  recordRender(componentName, startTime) {
    if (!this.isRecording) return;
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (!this.metrics.renders[componentName]) {
      this.metrics.renders[componentName] = [];
    }
    
    this.metrics.renders[componentName].push({
      duration,
      startTime: startTime - this.startTime
    });
  }
  
  /**
   * Get current performance metrics
   * 
   * @returns {Object} - Current metrics
   */
  getMetrics() {
    return this.metrics;
  }
  
  /**
   * Send metrics to server for analysis
   */
  sendMetricsToServer() {
    // Create a summary with the most important metrics
    const summary = {
      totalDuration: this.metrics.duration,
      averageRenderTimes: {},
      resourceCount: Object.keys(this.metrics.resources).length,
      interactionCount: Object.keys(this.metrics.interactions).length,
      timestamp: new Date().toISOString()
    };
    
    // Calculate average render times
    for (const [component, renders] of Object.entries(this.metrics.renders)) {
      const totalTime = renders.reduce((sum, render) => sum + render.duration, 0);
      summary.averageRenderTimes[component] = totalTime / renders.length;
    }
    
    fetch('/api/performance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        metrics: this.metrics,
        summary: summary
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log('Performance metrics sent to server', data);
    })
    .catch(err => {
      console.error('Error sending performance metrics', err);
    });
  }
}

// Initialize performance monitor
window.performanceMonitor = new PerformanceMonitor();

// Start recording on page load - with a small delay to ensure page is loaded
window.addEventListener('load', () => {
  setTimeout(() => {
    window.performanceMonitor.startRecording();
  }, 100);
});