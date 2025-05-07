/**
 * Central state manager for BambiSleep Chat
 * Manages feature state, dependencies, and interactions
 */
window.bambiSystem = (function() {
  // Private state storage
  const state = {
    triggers: [],
    collar: { enabled: false, text: '' },
    spirals: {
      enabled: false,
      spiral1Width: 5.0,
      spiral2Width: 3.0,
      spiral1Speed: 20,
      spiral2Speed: 15
    },
    xp: {
      level: 0,
      points: 0,
      lastAward: 0
    }
  };
  
  // Feature dependencies
  const featureDependencies = {
    spirals: { minLevel: 4 },
    collar: { minLevel: 2 },
    sessions: { minLevel: 3 }
  };
  
  // Initialization
  function init() {
    loadFromStorage();
    setupEventListeners();
    checkFeatureAvailability();
    
    // Listen for session load events
    document.addEventListener('session-loaded', handleSessionLoad);
    
    // Notify that system is initialized
    document.dispatchEvent(new CustomEvent('system-initialized'));
  }
  
  // Set up event listeners
  function setupEventListeners() {
    // Listen for XP updates
    document.addEventListener('xp-update', handleXpUpdate);
    
    // Set up tab navigation
    setupTabNavigation();
    
    // Listen for trigger controls loaded event
    document.addEventListener('trigger-controls-loaded', setupTriggers);
  }
  
  // Clean up event listeners
  function tearDown() {
    document.removeEventListener('session-loaded', handleSessionLoad);
    document.removeEventListener('xp-update', handleXpUpdate);
    document.removeEventListener('trigger-controls-loaded', setupTriggers);
    
    // Clean up control button listeners
    document.querySelectorAll('.control-btn').forEach(btn => {
      btn.removeEventListener('click', handleTabClick);
    });
  }
  
  // Load state from storage
  function loadFromStorage() {
    try {
      const saved = localStorage.getItem('bambiSystemState');
      if (saved) {
        const parsedState = JSON.parse(saved);
        Object.assign(state, parsedState);
      }
    } catch (e) {
      console.error('Error loading state:', e);
    }
  }
  
  // Set up tab navigation
  function setupTabNavigation() {
    const controlButtons = document.querySelectorAll('.control-btn:not(.disabled)');
    controlButtons.forEach(btn => {
      btn.addEventListener('click', handleTabClick);
    });
  }
  
  // Handle tab click
  function handleTabClick() {
    const targetId = this.getAttribute('data-target');
    if (!targetId) return;
    
    // Toggle active states
    document.querySelectorAll('.control-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelectorAll('.control-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    
    this.classList.add('active');
    
    // Show target panel
    const targetPanel = document.getElementById(targetId);
    if (targetPanel) targetPanel.classList.add('active');
  }
  
  // Check feature availability based on user level
  function checkFeatureAvailability() {
    // Get user level from DOM or state
    const userLevel = parseInt(document.body.getAttribute('data-level') || state.xp.level || 0);
    
    // Update control buttons based on level
    Object.keys(featureDependencies).forEach(feature => {
      const minLevel = featureDependencies[feature].minLevel;
      const btn = document.querySelector(`.control-btn[data-target="${feature}-panel"]`);
      
      if (btn) {
        if (userLevel < minLevel) {
          btn.classList.add('disabled');
          btn.setAttribute('title', `Reach Level ${minLevel} to unlock`);
          btn.textContent = btn.textContent.replace(' 🔒', '') + ' 🔒';
        } else {
          btn.classList.remove('disabled');
          btn.setAttribute('title', '');
          btn.textContent = btn.textContent.replace(' 🔒', '');
        }
      }
    });
  }
  
  // Handle XP update event
  function handleXpUpdate(event) {
    if (event.detail) {
      state.xp.points = event.detail.xp || state.xp.points;
      state.xp.level = event.detail.level || state.xp.level;
      state.xp.lastAward = Date.now();
      
      // Save to storage
      localStorage.setItem('bambiSystemState', JSON.stringify(state));
      
      // Update feature availability based on new level
      checkFeatureAvailability();
    }
  }
  
  // Handle session load event
  function handleSessionLoad(event) {
    if (event.detail && event.detail.session) {
      applySessionSettings(event.detail.session);
    }
  }
  
  // Apply settings from a loaded session
  function applySessionSettings(session) {
    // Update triggers if available
    if (session.activeTriggers || session.metadata?.triggers) {
      const triggers = session.activeTriggers || session.metadata?.triggers || [];
      updateTriggers(triggers);
    }
    
    // Update collar if available
    if (session.collarSettings || (session.metadata?.collarActive !== undefined)) {
      const collarActive = session.collarSettings?.enabled || session.metadata?.collarActive || false;
      const collarText = session.collarSettings?.text || session.metadata?.collarText || '';
      
      saveState('collar', {
        enabled: collarActive,
        text: collarText
      });
    }
    
    // Update spirals if available
    if (session.spiralSettings || session.metadata?.spiralSettings) {
      const spiralSettings = session.spiralSettings || session.metadata?.spiralSettings || {};
      saveState('spirals', spiralSettings);
    }
  }
  
  // Save state section
  function saveState(section, data) {
    if (!section) return;
    
    if (section === 'all') {
      // Full state replacement
      Object.assign(state, data);
    } else if (section === 'triggers') {
      // Special handling for triggers section
      if (data.triggers && Array.isArray(data.triggers)) {
        state.triggers = data.triggers;
      } else if (data.triggers) {
        // Convert single trigger object to array if needed
        state.triggers = [data.triggers];
      } else if (Array.isArray(data)) {
        state.triggers = data;
      }
    } else if (state[section]) {
      // Update section if it exists
      Object.assign(state[section], data);
    } else {
      // Create new section
      state[section] = data;
    }
    
    // Save to storage
    localStorage.setItem('bambiSystemState', JSON.stringify(state));
    
    // Notify components of state change
    document.dispatchEvent(new CustomEvent('system-update', {
      detail: { 
        section, 
        data: section === 'all' ? state : state[section]
      }
    }));
  }
  
  // Update triggers helper
  function updateTriggers(triggers) {
    // Normalize to always have an array of objects with name/description
    const normalizedTriggers = (Array.isArray(triggers) ? triggers : [triggers])
      .filter(t => t)
      .map(t => {
        if (typeof t === 'string') {
          return { name: t, description: 'Trigger effect' };
        } else if (typeof t === 'object' && t.name) {
          return {
            name: t.name,
            description: t.description || 'Trigger effect'
          };
        }
        return null;
      })
      .filter(t => t !== null);
    
    saveState('triggers', { triggers: normalizedTriggers });
  }
  
  // Set up trigger controls
  function setupTriggers() {
    // Connect individual toggles
    const toggles = document.querySelectorAll('.toggle-input');
    toggles.forEach(t => {
      const triggerName = t.getAttribute('data-trigger');
      if (triggerName) {
        t.addEventListener('change', saveTriggers);
      }
    });
  }
  
  // Save trigger state
  function saveTriggers() {
    // Get all checked trigger toggles
    const toggles = document.querySelectorAll('.toggle-input:checked');
    
    // Convert to array of objects with name and description
    const activeTriggers = Array.from(toggles)
      .map(toggle => {
        const name = toggle.getAttribute('data-trigger') || 
                    toggle.getAttribute('data-trigger-name') || 
                    toggle.value || 
                    toggle.id;
        
        const description = toggle.getAttribute('data-description') || 'Trigger effect';
        
        if (!name) return null;
        return { name, description };
      })
      .filter(t => t !== null);
    
    // Save to state
    saveState('triggers', { triggers: activeTriggers });
    
    // Send to server if socket is available
    if (window.socket && window.socket.connected) {
      const username = document.body.getAttribute('data-username') || window.username;
      
      if (username) {
        const triggerNames = activeTriggers.map(t => t.name);
        window.socket.emit('triggers', {
          triggerNames: triggerNames.join(','),
          triggerDetails: activeTriggers,
          username: username
        });
      }
    }
  }
  
  // Get state
  function getState(section) {
    if (section) {
      return state[section] ? { ...state[section] } : null;
    }
    
    return { ...state };
  }
  
  // Collect all settings for saving to session
  function collectSettings() {
    // Normalize triggers to always be an array of strings
    const triggerArray = Array.isArray(state.triggers)
      ? state.triggers
      : (state.triggers ? [state.triggers] : []);
    
    const triggerNames = triggerArray.map(t => {
      return typeof t === 'object' ? t.name : t;
    });
    
    // Format triggers for detailed use by worker
    const triggerDetails = triggerArray.map(t => {
      if (typeof t === 'string') {
        return { name: t, description: 'Trigger effect' };
      } else if (typeof t === 'object') {
        return {
          name: t.name || 'Unknown',
          description: t.description || 'Trigger effect'
        };
      }
      return { name: String(t), description: 'Trigger effect' };
    });
    
    // Return combined settings
    return {
      activeTriggers: triggerNames,
      triggerDetails: triggerDetails,
      collarSettings: state.collar,
      spiralSettings: state.spirals
    };
  }
  
  // Public API
  return {
    init,
    tearDown,
    saveState,
    getState,
    collectSettings,
    applySessionSettings
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.bambiSystem.init);