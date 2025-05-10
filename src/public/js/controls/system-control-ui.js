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
  };
  
  // Check if all required DOM elements are available
  function checkRequiredElements() {
    try {
      requiredElements.controlPanel = document.getElementById('system-control-panel');
      
      // Only proceed with the other selectors if we have the parent container
      if (requiredElements.controlPanel) {
        requiredElements.toggleButtons = requiredElements.controlPanel.querySelectorAll('.system-toggle');
        requiredElements.sliders = requiredElements.controlPanel.querySelectorAll('.system-slider');
        
        // Only require the control panel to exist - buttons and sliders might be added dynamically
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking required elements:', error);
      return false;
    }
  }
  
  // Setup event listeners using event delegation
  function setupEventListeners() {
    try {
      // Use event delegation for toggle buttons
      if (requiredElements.controlPanel) {
        requiredElements.controlPanel.addEventListener('click', function(event) {
          const toggleButton = event.target.closest('.system-toggle');
          if (toggleButton) {
            handleToggleClick(event, toggleButton);
          }
        });
        
        // Use event delegation for sliders
        requiredElements.controlPanel.addEventListener('input', function(event) {
          const slider = event.target.closest('.system-slider');
          if (slider) {
            handleSliderChange(event, slider);
          }
        });
      }
      
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
  
  // Set up level-based visibility
  function setupLevelBasedUI() {
    // Add level-changed event listener
    document.addEventListener('level-changed', handleLevelChange);
    
    // Initial check
    if (window.bambiSystem) {
      const userLevel = window.bambiSystem.getUserLevel();
      updateUIForLevel(userLevel);
    }
  }
  
  // Handle level change event
  function handleLevelChange(event) {
    if (event.detail && event.detail.level !== undefined) {
      updateUIForLevel(event.detail.level);
    }
  }
  
  // Update UI based on level
  function updateUIForLevel(level) {
    try {
      if (!requiredElements.controlPanel) return;
      
      // Get all control elements with level requirements
      const levelElements = requiredElements.controlPanel.querySelectorAll('[data-level]');
      
      levelElements.forEach(el => {
        const requiredLevel = parseInt(el.getAttribute('data-level'));
        
        if (isNaN(requiredLevel)) return;
        
        if (level >= requiredLevel) {
          el.classList.remove('locked');
          el.removeAttribute('disabled');
        } else {
          el.classList.add('locked');
          el.setAttribute('disabled', 'disabled');
        }
      });
      
      // Also handle control panel visibility
      document.querySelectorAll('.control-panel[data-level]').forEach(panel => {
        const requiredLevel = parseInt(panel.getAttribute('data-level'));
        if (isNaN(requiredLevel)) return;
        
        if (level >= requiredLevel) {
          panel.classList.remove('hidden');
        } else {
          panel.classList.add('hidden');
        }
      });
    } catch (error) {
      console.error('Error updating UI for level:', error);
    }
  }
  
  // Event handlers
  function handleToggleClick(event, toggleButton) {
    const toggleId = toggleButton.getAttribute('data-control');
    const isActive = toggleButton.classList.contains('active');
    
    // Update UI
    toggleButton.classList.toggle('active');
    
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
  
  function handleSliderChange(event, slider) {
    const sliderId = slider.getAttribute('data-control');
    const value = parseFloat(slider.value);
    
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
      if (!requiredElements.controlPanel) return;
      
      // Update toggles
      const toggleButtons = requiredElements.controlPanel.querySelectorAll('.system-toggle');
      toggleButtons.forEach(button => {
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
      const sliders = requiredElements.controlPanel.querySelectorAll('.system-slider');
      sliders.forEach(slider => {
        const controlId = slider.getAttribute('data-control');
        if (controlsState.hasOwnProperty(controlId)) {
          slider.value = controlsState[controlId];
        }
      });
    } catch (error) {
      console.error('Error updating controls UI:', error);
    }
  }
  
  // Ensure controls visibility
  function ensureControlsVisibility() {
    try {
      // Get user level
      const userLevel = window.xpSystem ? window.xpSystem.getUserLevel() : 0;
      
      // Find all control panels
      const controlPanels = document.querySelectorAll('.control-panel');
      
      if (controlPanels.length === 0) {
        console.warn('No control panels found in the DOM');
        // Try to create panels if missing
        if (typeof createControlPanel === 'function') {
          createControlPanel();
        }
        return;
      }
      
      // Check if any panels are visible
      let visiblePanels = 0;
      
      controlPanels.forEach(panel => {
        // Get feature name from data attribute
        const feature = panel.getAttribute('data-feature');
        
        // If no specific feature level requirement or meets the requirement
        if (!feature || isFeatureAvailable(feature, userLevel)) {
          panel.classList.remove('hidden');
          visiblePanels++;
        }
      });
      
      // Force main container to be visible
      const controlContainer = document.querySelector('.system-controls-container');
      if (controlContainer) {
        controlContainer.style.display = 'block';
      }
      
      console.log(`Ensured visibility: ${visiblePanels}/${controlPanels.length} panels visible`);
    } catch (error) {
      console.error('Error ensuring control visibility:', error);
    }
  }
  
  // Helper function to check if a feature is available
  function isFeatureAvailable(feature, level) {
    // Use window.FEATURE_LEVELS if available, otherwise fallback to defaults
    const requirements = window.FEATURE_LEVELS || {
      'triggers': 1,
      'trigger-categories': 2,
      'collar': 3,
      'sessions': 3,
      'spiral': 4,
      'spirals': 4,
      'hypnosis': 5,
      'session-sharing': 5,
      'audio': 6,
      'binaurals': 7
    };
    
    return level >= (requirements[feature] || 0);
  }
  
  // Initialize the module with exponential backoff
  function init() {
    // Check if we've exceeded max attempts
    if (initAttempts >= MAX_INIT_ATTEMPTS) {
      console.warn('SystemControlUI initialization failed after maximum attempts');
      // Continue to check if the control panel gets added later
      document.addEventListener('system-control-panel-added', function() {
        console.log('Control panel was added to DOM, reinitializing systemControlUI');
        initAttempts = 0;
        init();
      });
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
      setupLevelBasedUI();
      
      // Ensure controls are visible
      ensureControlsVisibility();
      
      // Also make sure to call this when level changes
      document.addEventListener('level-changed', () => {
        setTimeout(ensureControlsVisibility, 100);
      });
      
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
    if (!initialized || !requiredElements.controlPanel) return;
    
    try {
      // Remove delegated event listeners
      requiredElements.controlPanel.removeEventListener('click', handleToggleClick);
      requiredElements.controlPanel.removeEventListener('input', handleSliderChange);
      
      document.removeEventListener('system-state-change', handleSystemStateChange);
      
      if (window.socket) {
        window.socket.off('server-system-update', handleServerUpdate);
      }
      
      initialized = false;
    } catch (error) {
      console.error('Error during SystemControlUI teardown:', error);
    }
  }
  
  // Helper function to create the control panel if it doesn't exist
  function createControlPanel() {
    if (document.getElementById('system-control-panel')) return;
    
    try {
      const panel = document.createElement('div');
      panel.id = 'system-control-panel';
      panel.className = 'system-control-panel';
      
      // Add the panel to the appropriate container
      const container = document.querySelector('.controls-container') || document.body;
      container.appendChild(panel);
      
      console.log('Created system control panel');
      
      // Notify that the panel was added
      document.dispatchEvent(new CustomEvent('system-control-panel-added'));
    } catch (error) {
      console.error('Error creating control panel:', error);
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
    updateControlsUI,
    createControlPanel,
    ensureControlsVisibility // Add this
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Create the control panel if needed
  window.systemControlUI.createControlPanel();
  
  // Give other components time to initialize
  setTimeout(window.systemControlUI.init, 100);
});