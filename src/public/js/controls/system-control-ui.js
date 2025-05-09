window.systemControlUI = (function() {
  // Private variables
  let initialized = false;
  let initAttempts = 0;
  const MAX_INIT_ATTEMPTS = 10;
  const RETRY_DELAY_MS = 500;
  
  // Required DOM elements
  let requiredElements = {
    controlPanel: null,
    toggleButtons: null,
    sliders: null
    // Add other required elements
  };
  
  // Check if all required DOM elements are available
  function checkRequiredElements() {
    try {
      requiredElements.controlPanel = document.getElementById('system-control-panel');
      requiredElements.toggleButtons = document.querySelectorAll('.system-toggle');
      requiredElements.sliders = document.querySelectorAll('.system-slider');
      
      // Check if all required elements exist
      return requiredElements.controlPanel && 
             requiredElements.toggleButtons.length > 0 && 
             requiredElements.sliders.length > 0;
    } catch (error) {
      console.error('Error checking required elements:', error);
      return false;
    }
  }
  
  // Setup event listeners
  function setupEventListeners() {
    try {
      // Setup toggle button listeners
      requiredElements.toggleButtons.forEach(button => {
        button.addEventListener('click', handleToggleClick);
      });
      
      // Setup slider listeners
      requiredElements.sliders.forEach(slider => {
        slider.addEventListener('input', handleSliderChange);
      });
      
      // Listen for system events
      document.addEventListener('system-state-change', handleSystemStateChange);
      
      // If using socket
      if (window.socket) {
        window.socket.on('server-system-update', handleServerUpdate);
      }
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  }
  
  // Event handlers
  function handleToggleClick(event) {
    const toggleId = event.currentTarget.getAttribute('data-control');
    const isActive = event.currentTarget.classList.contains('active');
    
    // Update UI
    event.currentTarget.classList.toggle('active');
    
    // Update system state
    if (window.bambiSystem) {
      window.bambiSystem.saveState('controls', {
        [toggleId]: !isActive
      });
    }
    
    // Emit socket event if needed
    if (window.socket && window.socket.connected) {
      window.socket.emit('client-system-control', {
        control: toggleId,
        value: !isActive,
        timestamp: Date.now()
      });
    }
  }
  
  function handleSliderChange(event) {
    const sliderId = event.currentTarget.getAttribute('data-control');
    const value = parseFloat(event.currentTarget.value);
    
    // Update system state
    if (window.bambiSystem) {
      window.bambiSystem.saveState('controls', {
        [sliderId]: value
      });
    }
    
    // Emit socket event if needed (debounced)
    if (window.debouncedEmit) {
      window.debouncedEmit('client-system-control', {
        control: sliderId,
        value: value,
        timestamp: Date.now()
      });
    }
  }
  
  function handleSystemStateChange(event) {
    const { detail } = event;
    if (detail && detail.controls) {
      updateControlsUI(detail.controls);
    }
  }
  
  function handleServerUpdate(data) {
    if (data && data.controls) {
      updateControlsUI(data.controls);
    }
  }
  
  // Update UI based on state
  function updateControlsUI(controlsState) {
    try {
      // Update toggles
      requiredElements.toggleButtons.forEach(button => {
        const controlId = button.getAttribute('data-control');
        if (controlsState.hasOwnProperty(controlId)) {
          if (controlsState[controlId]) {
            button.classList.add('active');
          } else {
            button.classList.remove('active');
          }
        }
      });
      
      // Update sliders
      requiredElements.sliders.forEach(slider => {
        const controlId = slider.getAttribute('data-control');
        if (controlsState.hasOwnProperty(controlId)) {
          slider.value = controlsState[controlId];
        }
      });
    } catch (error) {
      console.error('Error updating controls UI:', error);
    }
  }
  
  // Initialize the module with exponential backoff
  function init() {
    // Check if we've exceeded max attempts
    if (initAttempts >= MAX_INIT_ATTEMPTS) {
      console.warn('SystemControlUI initialization failed after maximum attempts');
      return;
    }
    
    initAttempts++;
    
    // Check if required elements exist
    if (!checkRequiredElements()) {
      console.log(`Required DOM elements not found for systemControlUI - attempt ${initAttempts}/${MAX_INIT_ATTEMPTS}`);
      
      // Exponential backoff with a maximum delay
      const delay = Math.min(RETRY_DELAY_MS * Math.pow(1.5, initAttempts - 1), 5000);
      
      // Schedule retry
      setTimeout(init, delay);
      return;
    }
    
    // Initialize module
    try {
      setupEventListeners();
      
      // Set initial state if available
      if (window.bambiSystem) {
        const systemState = window.bambiSystem.getState('controls');
        if (systemState) {
          updateControlsUI(systemState);
        }
      }
      
      initialized = true;
      console.log('SystemControlUI initialized successfully');
      
      // Dispatch initialization event
      document.dispatchEvent(new CustomEvent('system-control-ui-ready'));
    } catch (error) {
      console.error('Error initializing SystemControlUI:', error);
    }
  }
  
  // Clean up event listeners
  function tearDown() {
    if (!initialized) return;
    
    try {
      requiredElements.toggleButtons.forEach(button => {
        button.removeEventListener('click', handleToggleClick);
      });
      
      requiredElements.sliders.forEach(slider => {
        slider.removeEventListener('input', handleSliderChange);
      });
      
      document.removeEventListener('system-state-change', handleSystemStateChange);
      
      if (window.socket) {
        window.socket.off('server-system-update', handleServerUpdate);
      }
      
      initialized = false;
    } catch (error) {
      console.error('Error during SystemControlUI teardown:', error);
    }
  }
  
  // Utility function for debounced socket emission
  const debouncedEmit = (function() {
    let timeout = null;
    return function(event, data) {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (window.socket && window.socket.connected) {
          window.socket.emit(event, data);
        }
        timeout = null;
      }, 300);
    };
  })();
  
  // Expose the debounced emit utility
  window.debouncedEmit = debouncedEmit;
  
  // Public API
  return {
    init,
    tearDown,
    updateControlsUI
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Give other components time to initialize
  setTimeout(window.systemControlUI.init, 100);
});