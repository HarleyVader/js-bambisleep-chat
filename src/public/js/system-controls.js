// Central management for system controls
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
    hypnosis: {
      enabled: false
    },
    session: {
      id: null,
      active: false
    }
  };

  // Initialize system
  function init() {
    loadStateFromLocalStorage();
    setupEventListeners();
    
    // Dispatch ready event
    document.dispatchEvent(new CustomEvent('system-ready'));
  }

  // Save state to localStorage and server
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
        username: username,
        section: section,
        data: section ? state[section] : state
      });
    }
    
    // Notify components
    document.dispatchEvent(new CustomEvent('system-update', {
      detail: { section, data: section ? state[section] : state }
    }));
  }

  // Load state from localStorage
  function loadStateFromLocalStorage() {
    try {
      const savedState = localStorage.getItem('bambiSystemState');
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        Object.keys(parsedState).forEach(key => {
          if (state[key]) {
            state[key] = {...state[key], ...parsedState[key]};
          }
        });
      }
    } catch (e) {
      console.error('Error loading system state:', e);
    }
  }

  // Load state from server
  function loadStateFromServer() {
    const username = document.body.getAttribute('data-username');
    if (!username || username === 'anonBambi') return;
    
    if (window.socket && window.socket.connected) {
      window.socket.emit('system-load', { username });
    } else {
      fetch(`/api/system/${username}`)
        .then(res => res.json())
        .then(data => {
          if (data.systemControls) {
            // Map server format to our state format
            if (data.systemControls.activeTriggers) {
              state.triggers = data.systemControls.activeTriggers;
            }
            if (data.systemControls.collarEnabled !== undefined) {
              state.collar.enabled = data.systemControls.collarEnabled;
              state.collar.text = data.systemControls.collarText || '';
            }
            if (data.systemControls.spiralsEnabled !== undefined) {
              state.spirals.enabled = data.systemControls.spiralsEnabled;
              state.spirals.spiral1Width = data.systemControls.spiral1Width || 5.0;
              state.spirals.spiral2Width = data.systemControls.spiral2Width || 3.0;
              state.spirals.spiral1Speed = data.systemControls.spiral1Speed || 20;
              state.spirals.spiral2Speed = data.systemControls.spiral2Speed || 15;
            }
            
            // Notify components
            document.dispatchEvent(new CustomEvent('system-loaded', {
              detail: { state }
            }));
          }
        })
        .catch(err => console.error('Error loading system state:', err));
    }
  }

  // Setup event listeners
  function setupEventListeners() {
    // Listen for socket updates
    if (window.socket) {
      window.socket.on('system-update', function(data) {
        if (data) {
          if (data.section && state[data.section]) {
            state[data.section] = {...state[data.section], ...data.data};
          } else if (data.state) {
            Object.keys(data.state).forEach(key => {
              if (state[key]) {
                state[key] = {...state[key], ...data.state[key]};
              }
            });
          }
          
          // Notify components
          document.dispatchEvent(new CustomEvent('system-loaded', {
            detail: { state }
          }));
        }
      });
    }
    
    // Listen for save requests from components
    document.addEventListener('save-triggers', function(e) {
      if (e.detail && e.detail.triggers) {
        saveState('triggers', e.detail.triggers);
      }
    });
    
    document.addEventListener('save-collar', function(e) {
      if (e.detail) {
        saveState('collar', e.detail);
      }
    });
    
    document.addEventListener('save-spirals', function(e) {
      if (e.detail) {
        saveState('spirals', e.detail);
      }
    });
    
    document.addEventListener('save-session', function(e) {
      if (e.detail) {
        saveState('session', e.detail);
      }
    });
    
    // Listen for UI tab changes to load specific data
    document.addEventListener('tab-changed', function(e) {
      if (e.detail && e.detail.tab) {
        loadComponentData(e.detail.tab);
      }
    });
  }

  // Load component specific data when tab is selected
  function loadComponentData(component) {
    switch(component) {
      case 'trigger-panel':
        if (window.bambiTriggers && typeof window.bambiTriggers.init === 'function') {
          window.bambiTriggers.init();
        }
        break;
      case 'session-history-panel':
        if (window.bambiHistory && typeof window.bambiHistory.init === 'function') {
          window.bambiHistory.init();
        }
        break;
      case 'spirals-panel':
        updateSpiralUIFromState();
        break;
      case 'collar-panel':
        updateCollarUIFromState();
        break;
    }
  }

  // Update collar UI from state
  function updateCollarUIFromState() {
    const enableCheckbox = document.getElementById('collar-enable');
    const collarText = document.getElementById('textarea-collar');
    
    if (enableCheckbox) {
      enableCheckbox.checked = state.collar.enabled;
    }
    
    if (collarText) {
      collarText.value = state.collar.text || '';
    }
  }

  // Update spirals UI from state
  function updateSpiralUIFromState() {
    const enableCheckbox = document.getElementById('spirals-enable');
    
    if (enableCheckbox) {
      enableCheckbox.checked = state.spirals.enabled;
    }
    
    // Update slider values
    const controls = [
      { id: 'spiral1-width', value: state.spirals.spiral1Width, display: 'spiral1-width-value' },
      { id: 'spiral2-width', value: state.spirals.spiral2Width, display: 'spiral2-width-value' },
      { id: 'spiral1-speed', value: state.spirals.spiral1Speed, display: 'spiral1-speed-value' },
      { id: 'spiral2-speed', value: state.spirals.spiral2Speed, display: 'spiral2-speed-value' }
    ];
    
    controls.forEach(control => {
      const slider = document.getElementById(control.id);
      const display = document.getElementById(control.display);
      
      if (slider) {
        slider.value = control.value;
      }
      
      if (display) {
        display.textContent = control.value;
      }
    });
  }

  // Collect all settings for worker communication
  function collectAllSettings() {
    return {
      activeTriggers: state.triggers,
      collarSettings: {
        enabled: state.collar.enabled,
        text: state.collar.text
      },
      spiralSettings: {
        enabled: state.spirals.enabled,
        spiral1Width: state.spirals.spiral1Width,
        spiral2Width: state.spirals.spiral2Width,
        spiral1Speed: state.spirals.spiral1Speed,
        spiral2Speed: state.spirals.spiral2Speed
      },
      hypnosisSettings: {
        enabled: state.hypnosis.enabled
      },
      sessionId: state.session.id
    };
  }

  // Update specific section of state
  function updateState(section, data) {
    if (section && state[section]) {
      state[section] = {...state[section], ...data};
      
      // Notify components
      document.dispatchEvent(new CustomEvent('system-update', {
        detail: { section, data: state[section] }
      }));
    }
  }

  // Connect UI save buttons to state manager
  function connectSaveButtons() {
    // Connect collar save button
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
    
    // Connect spirals save button
    const saveSpiralsBtn = document.getElementById('save-spirals');
    if (saveSpiralsBtn) {
      saveSpiralsBtn.addEventListener('click', function() {
        const enableCheckbox = document.getElementById('spirals-enable');
        
        if (enableCheckbox) {
          const settings = {
            enabled: enableCheckbox.checked,
            spiral1Width: parseFloat(document.getElementById('spiral1-width').value),
            spiral2Width: parseFloat(document.getElementById('spiral2-width').value),
            spiral1Speed: parseInt(document.getElementById('spiral1-speed').value),
            spiral2Speed: parseInt(document.getElementById('spiral2-speed').value)
          };
          
          saveState('spirals', settings);
        }
      });
    }
  }

  // Add tab change handlers
  function setupTabHandlers() {
    const controlButtons = document.querySelectorAll('.control-btn:not(.disabled)');
    
    controlButtons.forEach(button => {
      button.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target');
        if (targetId) {
          document.dispatchEvent(new CustomEvent('tab-changed', {
            detail: { tab: targetId }
          }));
        }
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
    loadStateFromServer,
    connectSaveButtons,
    setupTabHandlers
  };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Initialize system
  window.bambiSystem.init();
  
  // Connect save buttons to state manager
  window.bambiSystem.connectSaveButtons();
  
  // Setup tab change handlers
  window.bambiSystem.setupTabHandlers();
  
  // Load state from server if user is logged in
  window.bambiSystem.loadStateFromServer();
  
  // On first load, make sure the active tab data is loaded
  const activeTab = document.querySelector('.control-btn.active');
  if (activeTab) {
    const targetId = activeTab.getAttribute('data-target');
    if (targetId) {
      document.dispatchEvent(new CustomEvent('tab-changed', {
        detail: { tab: targetId }
      }));
    }
  }
});