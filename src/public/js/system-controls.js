// Simple central state management for BambiSleep
window.bambiSystem = (function() {
  // State storage
  const state = {
    triggers: [],
    collar: {
      enabled: false,
      text: ''
    },
    spirals: {
      enabled: false,
      spiral1Width: 5.0,
      spiral2Width: 3.0,
      spiral1Speed: 20,
      spiral2Speed: 15
    },
    session: null
  };

  // Initialize
  function init() {
    loadFromStorage();
    setupEvents();
    document.dispatchEvent(new Event('system-ready'));
  }

  // Load from localStorage
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

  // Basic event handlers
  function setupEvents() {
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
  }

  // Save state
  function saveState(section, data) {
    // Update state
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

  // Update triggers
  function updateTriggers(triggers) {
    if (!Array.isArray(triggers)) return;
    
    // Format triggers properly
    state.triggers = triggers.map(trigger => {
      if (typeof trigger === 'string') {
        return { name: trigger, description: 'Trigger effect' };
      } else if (typeof trigger === 'object' && trigger.name) {
        return {
          name: trigger.name,
          description: trigger.description || 'Trigger effect'
        };
      }
      return null;
    }).filter(Boolean);
    
    saveState('triggers', { triggers: state.triggers });
  }

  // Get all settings for worker
  function collectSettings() {
    // Format trigger details as proper objects with name and description
    const triggerDetails = state.triggers.map(t => ({
      name: t.name,
      description: t.description || 'Trigger effect'
    }));

    return {
      activeTriggers: state.triggers.map(t => t.name),
      triggerDetails: triggerDetails,
      collarSettings: state.collar,
      spiralSettings: state.spirals,
      sessionId: state.session
    };
  }

  // Public API
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