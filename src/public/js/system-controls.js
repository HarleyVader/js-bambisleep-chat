// Central state management for system controls
window.bambiSystem = (function() {
  // State storage - simple and focused
  const state = {
    triggers: [],
    collar: {
      enabled: false,
      text: ''
    },
    spirals: {
      enabled: false,
      width1: 5.0,
      width2: 3.0,
      speed1: 20,
      speed2: 15
    },
    session: null
  };

  // Initialize system
  function init() {
    loadFromStorage();
    setupEvents();
    document.dispatchEvent(new Event('system-ready'));
  }

  // Load state from localStorage
  function loadFromStorage() {
    try {
      const saved = localStorage.getItem('bambiSystemState');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(state, parsed);
      }
    } catch (e) {
      console.error('Error loading state:', e);
    }
  }

  // Save state
  function saveState(section, data) {
    // Update local state
    if (section && data) {
      state[section] = {...state[section], ...data};
    }

    // Save to localStorage
    localStorage.setItem('bambiSystemState', JSON.stringify(state));
    
    // Send to server if logged in
    const username = document.body.getAttribute('data-username');
    if (username && username !== 'anonBambi' && window.socket) {
      window.socket.emit('system-update', {
        username,
        section,
        data: section ? state[section] : state
      });
    }
    
    // Notify components
    document.dispatchEvent(new CustomEvent('system-update', {
      detail: { section, data: section ? state[section] : state }
    }));
  }

  // Set up basic event listeners
  function setupEvents() {
    // Handle system-wide events
    document.addEventListener('save-triggers', e => {
      if (e.detail && e.detail.triggers) {
        saveState('triggers', e.detail);
      }
    });
    
    document.addEventListener('save-collar', e => {
      if (e.detail) {
        saveState('collar', e.detail);
      }
    });
    
    document.addEventListener('save-spirals', e => {
      if (e.detail) {
        saveState('spirals', e.detail);
      }
    });
    
    document.addEventListener('save-session', e => {
      if (e.detail) {
        saveState('session', e.detail);
      }
    });
  }

  // Update trigger state
  function updateTriggers(triggers) {
    if (!Array.isArray(triggers)) return;
    
    // Store trigger names with descriptions
    state.triggers = triggers.map(trigger => {
      // Make sure we have proper objects with name and description
      if (typeof trigger === 'string') {
        return { name: trigger, description: 'Trigger effect' };
      } else if (typeof trigger === 'object' && trigger.name) {
        return {
          name: trigger.name,
          description: trigger.description || 'Trigger effect'
        };
      }
      return null;
    }).filter(Boolean); // Remove any null values
    
    saveState('triggers', { triggers: state.triggers });
  }

  // Get trigger details ready for the worker
  function getTriggerDetails() {
    // Format triggers correctly for LMStudio worker
    return state.triggers.map(trigger => ({
      name: trigger.name,
      description: trigger.description || 'Trigger effect'
    }));
  }

  // Collect all settings for worker
  function collectSettings() {
    return {
      activeTriggers: state.triggers.map(t => t.name),
      triggerDetails: getTriggerDetails(),
      collarSettings: state.collar,
      spiralSettings: state.spirals,
      sessionId: state.session
    };
  }

  // Public API - keep it minimal
  return {
    init,
    getState: () => ({...state}),
    saveState,
    updateTriggers,
    collectSettings
  };
})();

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
  window.bambiSystem.init();
});