// Memory management utilities
window.memoryManager = (function() {
  const state = {
    gcPending: false,
    intervals: [],
    cachedData: {},
    lastCleanup: Date.now()
  };
  
  // Initialize memory manager
  function init() {
    setupCleanupInterval();
    monitorMemoryUsage();
  }
  
  // Setup periodic cleanup
  function setupCleanupInterval() {
    const interval = setInterval(performCleanup, 60000);
    state.intervals.push(interval);
  }
  
  // Monitor memory usage
  function monitorMemoryUsage() {
    if (!performance || !performance.memory) return;
    
    const interval = setInterval(() => {
      const memoryUsage = performance.memory.usedJSHeapSize;
      if (memoryUsage > 100000000) { // 100MB
        performCleanup();
      }
    }, 30000);
    
    state.intervals.push(interval);
  }
  
  // Perform memory cleanup
  function performCleanup() {
    if (state.gcPending) return;
    
    state.gcPending = true;
    state.cachedData = {};
    
    if (window.bambiSystem) {
      // Preserve essential state only
      const essentialState = window.bambiSystem.getState();
      localStorage.setItem('essentialState', JSON.stringify(essentialState));
    }
    
    // Clean DOM elements that aren't needed
    cleanupDOM();
    
    state.lastCleanup = Date.now();
    state.gcPending = false;
  }
  
  // Clean unused DOM elements
  function cleanupDOM() {
    // Remove old messages (keep last 50)
    const chatList = document.getElementById('chat-response');
    if (chatList && chatList.children.length > 50) {
      while (chatList.children.length > 50) {
        chatList.removeChild(chatList.firstChild);
      }
    }
    
    // Remove temporary elements
    document.querySelectorAll('.temp-element').forEach(el => el.remove());
  }
  
  // Stop all intervals on shutdown
  function shutdown() {
    state.intervals.forEach(interval => clearInterval(interval));
    state.intervals = [];
  }
  
  return {
    init,
    cleanup: performCleanup,
    shutdown
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.memoryManager.init);