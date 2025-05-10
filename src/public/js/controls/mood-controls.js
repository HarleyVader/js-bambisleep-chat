window.bambiMood = (function() {
  // Signal module loading
  if (window.bambiConsole) {
    window.bambiConsole.moduleLoading('bambiMood');
  }
  
  // Private variables
  let currentMood = 'neutral';
  const availableMoods = ['neutral', 'happy', 'angry', 'sad', 'excited'];
  
  // Initialize module
  function init() {
    try {
      if (window.bambiConsole) {
        window.bambiConsole.moduleInitializing('bambiMood');
      }
      
      // Check if system exists and has registerModule function
      if (window.bambiSystem) {
        if (typeof window.bambiSystem.registerModule === 'function') {
          // Register mood module with the system
          window.bambiSystem.registerModule('mood', {
            getCurrentMood: getCurrentMood,
            setMood: setMood,
            getAvailableMoods: getAvailableMoods
          });
          
          if (window.bambiConsole) {
            window.bambiConsole.log('bambiMood', 'Successfully registered with bambiSystem');
          }
        } else {
          if (window.bambiConsole) {
            window.bambiConsole.warn('bambiMood', 'bambiSystem.registerModule is not available. Implementation needed.');
          } else {
            console.warn('bambiSystem.registerModule is not available. Mood system will operate independently.');
          }
          
          // Implement missing registerModule function on bambiSystem
          if (!window.bambiSystem.registeredModules) {
            window.bambiSystem.registeredModules = {};
          }
          
          window.bambiSystem.registerModule = function(name, api) {
            window.bambiSystem.registeredModules[name] = api;
            return true;
          };
          
          // Now register our module
          window.bambiSystem.registerModule('mood', {
            getCurrentMood: getCurrentMood,
            setMood: setMood,
            getAvailableMoods: getAvailableMoods
          });
          
          if (window.bambiConsole) {
            window.bambiConsole.log('bambiMood', 'Created and registered with bambiSystem');
          }
        }
        
        // Try to load saved mood from system state
        if (window.bambiSystem.getState) {
          const savedState = window.bambiSystem.getState('mood');
          if (savedState && savedState.currentMood) {
            currentMood = savedState.currentMood;
            if (window.bambiConsole) {
              window.bambiConsole.log('bambiMood', `Loaded saved mood: ${currentMood}`);
            }
          }
        }
      }
      
      // Set up UI elements
      setupMoodControls();
      
      // Apply initial mood
      applyMood(currentMood);
      
      if (window.bambiConsole) {
        window.bambiConsole.moduleInitialized('bambiMood');
      } else {
        console.log('Mood system initialized successfully');
      }
    } catch (error) {
      if (window.bambiConsole) {
        window.bambiConsole.moduleFailed('bambiMood', error);
      } else {
        console.error('Error initializing mood system:', error);
      }
    }
  }
  
  // Set up UI controls for mood selection
  function setupMoodControls() {
    try {
      const moodSelector = document.getElementById('mood-selector');
      if (!moodSelector) {
        if (window.bambiConsole) {
          window.bambiConsole.warn('bambiMood', 'Mood selector element not found in DOM');
        }
        return;
      }
      
      // Create mood options if they don't exist
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
      
      // Add change event listener
      moodSelector.addEventListener('change', function() {
        setMood(this.value);
      });
      
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
        window.bambiSystem.saveState('mood', { 
          currentMood: mood 
        });
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

// Initialize on DOM content loaded or system-ready, whichever comes last
document.addEventListener('DOMContentLoaded', function() {
  if (window.bambiConsole) {
    window.bambiConsole.log('bambiMood', 'DOM content loaded, initializing mood system');
  }
  window.bambiMood.init();
});

// Also initialize on system-ready event as a fallback
document.addEventListener('system-ready', function() {
  if (window.bambiConsole) {
    window.bambiConsole.log('bambiMood', 'System ready event received');
  }
  
  // Only re-initialize if registerModule wasn't available before
  if (window.bambiSystem && 
      typeof window.bambiSystem.registerModule === 'function' && 
      (!window.bambiSystem.registeredModules || !window.bambiSystem.registeredModules.mood)) {
    if (window.bambiConsole) {
      window.bambiConsole.log('bambiMood', 'Re-initializing mood system after system ready');
    }
    window.bambiMood.init();
  }
});