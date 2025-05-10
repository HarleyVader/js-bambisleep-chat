window.bambiMood = (function() {
  // Signal module loading
  if (window.bambiConsole) {
    window.bambiConsole.moduleLoading('bambiMood');
  }
  
  // Private variables
  let currentMood = 'neutral';
  const availableMoods = ['neutral', 'happy', 'angry', 'sad', 'excited'];
  let initialized = false;
  let moodControlsCreated = false;
  
  // Initialize module
  function init() {
    try {
      // Prevent multiple initializations
      if (initialized) {
        if (window.bambiConsole) {
          window.bambiConsole.log('bambiMood', 'Already initialized, skipping');
        }
        return;
      }
      
      if (window.bambiConsole) {
        window.bambiConsole.moduleInitializing('bambiMood');
      }
      
      // Register with system
      registerWithSystem();
      
      // Load saved mood if available
      loadSavedMood();
      
      // Set up UI elements
      setupMoodControls();
      
      // Apply initial mood
      applyMood(currentMood);
      
      // Mark as initialized
      initialized = true;
      
      if (window.bambiConsole) {
        window.bambiConsole.moduleInitialized('bambiMood');
      }
    } catch (error) {
      if (window.bambiConsole) {
        window.bambiConsole.moduleFailed('bambiMood', error);
      } else {
        console.error('Error initializing mood system:', error);
      }
    }
  }
  
  // Register with bambiSystem
  function registerWithSystem() {
    if (window.bambiSystem) {
      const moodAPI = {
        getCurrentMood,
        setMood,
        getAvailableMoods
      };
      
      if (typeof window.bambiSystem.registerModule === 'function') {
        window.bambiSystem.registerModule('mood', moodAPI);
        
        if (window.bambiConsole) {
          window.bambiConsole.log('bambiMood', 'Successfully registered with bambiSystem');
        }
      } else {
        if (window.bambiConsole) {
          window.bambiConsole.warn('bambiMood', 'bambiSystem.registerModule is not available');
        }
        
        // Simple implementation if needed
        if (!window.bambiSystem.registeredModules) {
          window.bambiSystem.registeredModules = {};
        }
        
        window.bambiSystem.registerModule = function(name, api) {
          window.bambiSystem.registeredModules[name] = api;
          return true;
        };
        
        window.bambiSystem.registerModule('mood', moodAPI);
      }
    }
  }
  
  // Load saved mood from system state
  function loadSavedMood() {
    if (window.bambiSystem && window.bambiSystem.getState) {
      const savedState = window.bambiSystem.getState('mood');
      if (savedState && savedState.currentMood) {
        currentMood = savedState.currentMood;
        if (window.bambiConsole) {
          window.bambiConsole.log('bambiMood', `Loaded saved mood: ${currentMood}`);
        }
      }
    }
  }
  
  // Set up UI controls for mood selection
  function setupMoodControls() {
    try {
      // Avoid duplicate setup
      if (moodControlsCreated) {
        return;
      }
      
      // First try to find existing mood selector
      let moodSelector = document.getElementById('mood-selector');
      
      // If not found, create it
      if (!moodSelector) {
        if (window.bambiConsole) {
          window.bambiConsole.warn('bambiMood', 'Mood selector element not found in DOM, creating it');
        }
        
        // Find system control panel
        let container = document.getElementById('system-control-panel');
        
        // If system panel doesn't exist, create it
        if (!container) {
          container = document.createElement('div');
          container.id = 'system-control-panel';
          container.className = 'system-control-panel';
          document.body.appendChild(container);
        }
        
        // Create mood control panel
        const moodPanel = document.createElement('div');
        moodPanel.className = 'control-panel mood-control-panel';
        moodPanel.id = 'mood-control-panel';
        moodPanel.innerHTML = `
          <h3>Mood Controls</h3>
          <div class="control-group">
            <label for="mood-selector">Current Mood:</label>
            <select id="mood-selector" class="form-control">
              <!-- Options added dynamically -->
            </select>
          </div>
        `;
        
        container.appendChild(moodPanel);
        moodSelector = document.getElementById('mood-selector');
        
        if (window.bambiConsole) {
          window.bambiConsole.log('bambiMood', 'Created mood selector element');
        }
      }
      
      // Check if selector was successfully created
      if (!moodSelector) {
        if (window.bambiConsole) {
          window.bambiConsole.error('bambiMood', 'Failed to create mood selector');
        }
        return;
      }
      
      // Create mood options
      if (moodSelector.children.length === 0) {
        availableMoods.forEach(mood => {
          const option = document.createElement('option');
          option.value = mood;
          option.textContent = mood.charAt(0).toUpperCase() + mood.slice(1);
          moodSelector.appendChild(option);
        });
      }
      
      // Set initial selection
      moodSelector.value = currentMood;
      
      // Remove existing listeners to prevent duplicates
      const newMoodSelector = moodSelector.cloneNode(true);
      moodSelector.parentNode.replaceChild(newMoodSelector, moodSelector);
      moodSelector = newMoodSelector;
      
      // Add change event listener
      moodSelector.addEventListener('change', function() {
        setMood(this.value);
      });
      
      // Notify system about control panel
      document.dispatchEvent(new CustomEvent('control-panel-added', {
        detail: { panelId: 'mood-control-panel' }
      }));
      
      moodControlsCreated = true;
      
      if (window.bambiConsole) {
        window.bambiConsole.log('bambiMood', 'Mood controls set up successfully');
      }
    } catch (error) {
      if (window.bambiConsole) {
        window.bambiConsole.error('bambiMood', 'Error setting up mood controls', error);
      } else {
        console.error('Error setting up mood controls:', error);
      }
    }
  }
  
  // Apply visual changes based on mood
  function applyMood(mood) {
    try {
      // Update body class for CSS styling
      document.body.classList.remove(...availableMoods.map(m => `mood-${m}`));
      document.body.classList.add(`mood-${mood}`);
      
      // Update current mood state
      currentMood = mood;
      
      // Save mood state if system is available
      if (window.bambiSystem && window.bambiSystem.saveState) {
        window.bambiSystem.saveState('mood', { currentMood: mood });
      }
      
      // Update selector if it exists
      const moodSelector = document.getElementById('mood-selector');
      if (moodSelector) {
        moodSelector.value = mood;
      }
      
      // Dispatch event for other modules
      document.dispatchEvent(new CustomEvent('mood-changed', {
        detail: { mood }
      }));
      
      if (window.bambiConsole) {
        window.bambiConsole.log('bambiMood', `Applied mood: ${mood}`);
      }
    } catch (error) {
      if (window.bambiConsole) {
        window.bambiConsole.error('bambiMood', 'Error applying mood', error);
      } else {
        console.error('Error applying mood:', error);
      }
    }
  }
  
  // Public API
  function getCurrentMood() {
    return currentMood;
  }
  
  function setMood(mood) {
    if (availableMoods.includes(mood)) {
      applyMood(mood);
      return true;
    }
    return false;
  }
  
  function getAvailableMoods() {
    return [...availableMoods];
  }
  
  // Public API
  const api = {
    init,
    getCurrentMood,
    setMood,
    getAvailableMoods
  };
  
  // Signal module loaded
  if (window.bambiConsole) {
    window.bambiConsole.moduleLoaded('bambiMood');
  }
  
  return api;
})();

// Initialization approach - fix timing issues
let systemInitialized = false;

// Initialize at DOMContentLoaded if system is already initialized
document.addEventListener('DOMContentLoaded', function() {
  if (window.bambiConsole) {
    window.bambiConsole.log('bambiMood', 'DOM content loaded, initializing mood system');
  }
  
  // Only initialize immediately if system is ready or not present
  if (systemInitialized || !window.bambiSystem) {
    window.bambiMood.init();
  }
});

// Initialize when system is ready
document.addEventListener('system-ready', function() {
  if (window.bambiConsole) {
    window.bambiConsole.log('bambiMood', 'System ready event received');
  }
  
  systemInitialized = true;
  window.bambiMood.init();
});

// Fallback initialization for reliability
setTimeout(function() {
  if (!document.getElementById('mood-selector')) {
    if (window.bambiConsole) {
      window.bambiConsole.warn('bambiMood', 'Fallback initialization - mood controls not found');
    }
    window.bambiMood.init();
  }
}, 1000);