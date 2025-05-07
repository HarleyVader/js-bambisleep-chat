// Central state management for all system controls
window.bambiSystem = (function() {
  // Central state storage
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
    session: {
      id: null
    }
  };

  // Initialize system
  function init() {
    loadFromLocalStorage();
    setupEventListeners();
    document.dispatchEvent(new Event('system-ready'));
  }

  // Save state to local storage and server
  function saveState(section, data) {
    // Update local state
    if (section) {
      state[section] = {...state[section], ...data};
    }

    // Save to localStorage
    localStorage.setItem('bambiSystemState', JSON.stringify(state));
    
    // Send to server if logged in
    const username = document.body.getAttribute('data-username');
    if (username && username !== 'anonBambi' && window.socket && window.socket.connected) {
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

  // Load from local storage
  function loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('bambiSystemState');
      if (saved) {
        const parsedState = JSON.parse(saved);
        Object.keys(parsedState).forEach(key => {
          if (state[key]) {
            state[key] = {...state[key], ...parsedState[key]};
          }
        });
      }
    } catch (e) {
      console.error('Error loading state:', e);
    }
  }

  // Load from server
  function loadFromServer() {
    const username = document.body.getAttribute('data-username');
    if (!username || username === 'anonBambi') return;
    
    if (window.socket && window.socket.connected) {
      window.socket.emit('get-profile-data', { username }, function(response) {
        if (response && response.success && response.profile) {
          updateFromProfile(response.profile);
        }
      });
    }
  }
  
  // Update state from profile data
  function updateFromProfile(profile) {
    if (profile.systemControls) {
      // Update triggers
      if (profile.systemControls.activeTriggers) {
        state.triggers = profile.systemControls.activeTriggers;
      }
      
      // Update collar
      if (profile.systemControls.collarEnabled !== undefined) {
        state.collar.enabled = profile.systemControls.collarEnabled;
        state.collar.text = profile.systemControls.collarText || '';
      }
      
      // Update spirals
      if (profile.systemControls.spiralsEnabled !== undefined) {
        state.spirals.enabled = profile.systemControls.spiralsEnabled;
        state.spirals.spiral1Width = profile.systemControls.spiral1Width || 5.0;
        state.spirals.spiral2Width = profile.systemControls.spiral2Width || 3.0;
        state.spirals.spiral1Speed = profile.systemControls.spiral1Speed || 20;
        state.spirals.spiral2Speed = profile.systemControls.spiral2Speed || 15;
      }
      
      // Notify components
      document.dispatchEvent(new CustomEvent('system-loaded', {
        detail: { state }
      }));
    }
  }

  // Set up event listeners
  function setupEventListeners() {
    // Listen for UI events from components
    document.addEventListener('save-triggers', e => {
      if (e.detail && e.detail.triggers) {
        saveState('triggers', { triggers: e.detail.triggers });
      }
    });
    
    document.addEventListener('save-collar', e => {
      if (e.detail) {
        saveState('collar', e.detail);
        // Fire collar-update event for compatibility
        document.dispatchEvent(new CustomEvent('collar-update', {
          detail: { text: e.detail.text }
        }));
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
    
    // Listen for tab changes
    document.addEventListener('tab-changed', e => {
      if (e.detail && e.detail.tab) {
        loadComponentData(e.detail.tab);
      }
    });
  }

  // Load data for specific component
  function loadComponentData(component) {
    switch(component) {
      case 'trigger-panel':
        updateTriggerUI();
        break;
      case 'collar-panel':
        updateCollarUI();
        break;
      case 'spirals-panel':
        updateSpiralsUI();
        break;
      case 'session-history-panel':
        // Let the session history component handle its own loading
        break;
    }
  }

  // Update UI for triggers
  function updateTriggerUI() {
    const toggles = document.querySelectorAll('.toggle-input');
    toggles.forEach(toggle => {
      const trigger = toggle.getAttribute('data-trigger');
      if (trigger) {
        toggle.checked = state.triggers.includes(trigger);
      }
    });
  }

  // Update UI for collar
  function updateCollarUI() {
    const enableCheckbox = document.getElementById('collar-enable');
    const collarText = document.getElementById('textarea-collar');
    
    if (enableCheckbox) {
      enableCheckbox.checked = state.collar.enabled;
    }
    
    if (collarText) {
      collarText.value = state.collar.text || '';
    }
  }

  // Update UI for spirals
  function updateSpiralsUI() {
    const enableCheckbox = document.getElementById('spirals-enable');
    
    if (enableCheckbox) {
      enableCheckbox.checked = state.spirals.enabled;
    }
    
    const sliders = [
      { id: 'spiral1-width', value: state.spirals.spiral1Width },
      { id: 'spiral2-width', value: state.spirals.spiral2Width },
      { id: 'spiral1-speed', value: state.spirals.spiral1Speed },
      { id: 'spiral2-speed', value: state.spirals.spiral2Speed }
    ];
    
    sliders.forEach(slider => {
      const el = document.getElementById(slider.id);
      if (el) {
        el.value = slider.value;
      }
    });
  }

  // Collect all settings for worker
  function collectAllSettings() {
    return {
      activeTriggers: state.triggers,
      collarSettings: {
        enabled: state.collar.enabled,
        text: state.collar.text
      },
      spiralSettings: state.spirals,
      sessionId: state.session.id
    };
  }

  // Update state section
  function updateState(section, data) {
    if (section && state[section]) {
      state[section] = {...state[section], ...data};
      
      // Notify components
      document.dispatchEvent(new CustomEvent('system-update', {
        detail: { section, data: state[section] }
      }));
    }
  }

  // Connect save buttons to state
  function connectSaveButtons() {
    // Collar save button
    const saveCollarBtn = document.getElementById('save-collar');
    if (saveCollarBtn) {
      saveCollarBtn.addEventListener('click', function() {
        const enableCheckbox = document.getElementById('collar-enable');
        const collarText = document.getElementById('textarea-collar');
        
        if (enableCheckbox && collarText) {
          saveState('collar', {
            enabled: enableCheckbox.checked,
            text: collarText.value
          });
        }
      });
    }
    
    // Spirals save button
    const saveSpiralsBtn = document.getElementById('save-spirals');
    if (saveSpiralsBtn) {
      saveSpiralsBtn.addEventListener('click', function() {
        const enableCheckbox = document.getElementById('spirals-enable');
        
        if (enableCheckbox) {
          saveState('spirals', {
            enabled: enableCheckbox.checked,
            spiral1Width: parseFloat(document.getElementById('spiral1-width').value),
            spiral2Width: parseFloat(document.getElementById('spiral2-width').value),
            spiral1Speed: parseInt(document.getElementById('spiral1-speed').value),
            spiral2Speed: parseInt(document.getElementById('spiral2-speed').value)
          });
        }
      });
    }
    
    // Connect trigger toggles
    const triggerToggles = document.querySelectorAll('.toggle-input');
    triggerToggles.forEach(toggle => {
      toggle.addEventListener('change', function() {
        const triggers = [];
        document.querySelectorAll('.toggle-input:checked').forEach(input => {
          const trigger = input.getAttribute('data-trigger');
          if (trigger) {
            triggers.push(trigger);
          }
        });
        saveState('triggers', { triggers });
      });
    });
  }

  // Public API
  return {
    init,
    getState: () => ({...state}),
    saveState,
    updateState,
    collectAllSettings,
    loadFromServer,
    connectSaveButtons
  };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  window.bambiSystem.init();
  window.bambiSystem.connectSaveButtons();
  window.bambiSystem.loadFromServer();
});