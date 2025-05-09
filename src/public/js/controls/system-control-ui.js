window.systemControlUI = (function() {
  // Private variables
  let initialized = false;
  let connectionStatus = 'disconnected';
  let reconnectAttempts = 0;
  
  function init() {
    try {
      // Check if required elements exist before initializing
      const controlPanel = document.getElementById('system-control-panel');
      
      if (!controlPanel) {
        console.warn('Required DOM elements not found for systemControlUI - will retry later');
        // Retry initialization after a short delay
        setTimeout(init, 1000);
        return;
      }
      
      // Continue with initialization if elements are found
      setupEventListeners();
      updateUIFromState();
      
      initialized = true;
      console.log('SystemControlUI initialized successfully');
      
      // Notify other modules
      document.dispatchEvent(new CustomEvent('system-ui-ready'));
    } catch (error) {
      console.error('Error initializing system control UI:', error);
    }
  }
  
  function setupEventListeners() {
    // Add event listeners for control panel elements
    const toggles = document.querySelectorAll('.system-toggle');
    if (toggles.length) {
      toggles.forEach(toggle => {
        toggle.addEventListener('change', handleToggleChange);
      });
    }
    
    // Listen for socket connection events
    document.addEventListener('socket-connected', handleSocketConnected);
    document.addEventListener('socket-disconnected', handleSocketDisconnected);
    
    // Listen for state changes
    if (window.bambiSystem) {
      document.addEventListener('bambi-state-changed', updateUIFromState);
    }
  }
  
  function handleToggleChange(event) {
    const toggle = event.target;
    const controlName = toggle.getAttribute('data-control');
    const isEnabled = toggle.checked;
    
    if (!controlName) return;
    
    // Update system state
    if (window.bambiSystem) {
      window.bambiSystem.saveState(controlName, { enabled: isEnabled });
    }
    
    // Send to server if socket is connected
    if (window.socketHandler && window.socketHandler.isConnected()) {
      window.socket.emit('client-system-control', {
        control: controlName,
        enabled: isEnabled,
        timestamp: Date.now()
      });
    }
  }
  
  function updateUIFromState() {
    if (!window.bambiSystem) return;
    
    // Get all controls that have a data-control attribute
    const controlElements = document.querySelectorAll('[data-control]');
    
    controlElements.forEach(element => {
      const controlName = element.getAttribute('data-control');
      const controlState = window.bambiSystem.getState(controlName);
      
      if (controlState) {
        // Handle different element types
        if (element.type === 'checkbox') {
          element.checked = controlState.enabled === true;
        } else if (element.tagName === 'SELECT') {
          element.value = controlState.value || '';
        } else if (element.type === 'range') {
          element.value = controlState.value || 0;
        }
      }
    });
  }
  
  function handleSocketConnected() {
    // Enable all control elements
    document.querySelectorAll('.system-control').forEach(control => {
      control.disabled = false;
    });
    
    // Add connected class to container
    const container = document.getElementById('system-control-panel');
    if (container) {
      container.classList.remove('disconnected');
      container.classList.add('connected');
    }
    
    // Update connection status
    updateConnectionStatus('connected');
  }
  
  function handleSocketDisconnected() {
    // Disable all control elements that require server connection
    document.querySelectorAll('.system-control[data-requires-connection="true"]').forEach(control => {
      control.disabled = true;
    });
    
    // Add disconnected class to container
    const container = document.getElementById('system-control-panel');
    if (container) {
      container.classList.remove('connected');
      container.classList.add('disconnected');
    }
    
    // Update connection status
    updateConnectionStatus('disconnected');
  }
  
  /**
   * Update connection status in UI
   */
  function updateConnectionStatus(status) {
    connectionStatus = status;
    
    // Update UI connection indicator
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      // Remove all status classes
      statusEl.classList.remove('connected', 'connecting', 'reconnecting', 'disconnected', 'failed');
      // Add current status class
      statusEl.classList.add(status);
      
      // Update status text
      const statusTextEl = statusEl.querySelector('.status-text');
      if (statusTextEl) {
        statusTextEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      }
    }
    
    // Show connection status notification
    showConnectionToast(status);
    
    // Dispatch status change event
    document.dispatchEvent(new CustomEvent('socket-status-change', {
      detail: { status, reconnectAttempt: reconnectAttempts }
    }));
  }
  
  // Public API
  return {
    init,
    isInitialized: function() {
      return initialized;
    },
    refresh: updateUIFromState
  };
})();

// Initialize on page load, with a delay to ensure DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Try first initialization
  setTimeout(window.systemControlUI.init, 100);
  
  // Ensure initialization even if first attempt fails
  setTimeout(function() {
    if (!window.systemControlUI.isInitialized()) {
      console.log('Retrying systemControlUI initialization...');
      window.systemControlUI.init();
    }
  }, 2000);
});