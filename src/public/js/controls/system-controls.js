/**
 * Central state manager for BambiSleep Chat
 * Manages feature state, dependencies, and interactions
 */
window.bambiSystem = (function() {
  // Private state storage with defaults
  const state = {
    triggers: {
      activeTriggers: [],
      triggerData: []
    },
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
    audio: {
      volume: 0.7,
      speed: 5,
      speedFactor: 1.0
    },
    xp: {
      level: 0,
      points: 0,
      lastAward: 0
    },
    settings: {
      theme: 'dark',
      notifications: true
    }
  };
  
  // Feature level requirements
  const featureRequirements = {
    triggers: 1,
    collar: 2,
    sessions: 3,
    spirals: 4, 
    hypnosis: 5,
    audio: 6,
    binaurals: 7
  };
  
  // Initialization
  function init() {
    loadFromStorage();
    setupEventListeners();
    checkFeatureAvailability();
    setupTabNavigation();
    
    // Notify that system is initialized
    document.dispatchEvent(new CustomEvent('system-initialized'));
  }
  
  // Load state from localStorage
  function loadFromStorage() {
    try {
      const saved = localStorage.getItem('bambiSystemState');
      if (saved) {
        const savedState = JSON.parse(saved);
        
        // Merge saved state with defaults
        Object.keys(savedState).forEach(key => {
          if (state[key] && typeof state[key] === 'object') {
            state[key] = { ...state[key], ...savedState[key] };
          } else {
            state[key] = savedState[key];
          }
        });
      }
      
      // Set user level from DOM if available
      const userLevel = parseInt(document.body.getAttribute('data-level') || '0');
      if (!isNaN(userLevel)) {
        state.xp.level = userLevel;
      }
    } catch (e) {
      console.error('Error loading state:', e);
    }
  }
  
  // Set up event listeners
  function setupEventListeners() {
    // Listen for XP updates
    document.addEventListener('xp-update', handleXpUpdate);
    
    // Listen for session loaded event
    document.addEventListener('session-loaded', handleSessionLoad);
    
    // Listen for system setting changes
    document.addEventListener('setting-changed', handleSettingChange);
  }
  
  // Clean up event listeners
  function tearDown() {
    document.removeEventListener('xp-update', handleXpUpdate);
    document.removeEventListener('session-loaded', handleSessionLoad);
    document.removeEventListener('setting-changed', handleSettingChange);
    
    // Remove tab navigation listeners
    document.querySelectorAll('.control-btn').forEach(btn => {
      btn.removeEventListener('click', handleTabClick);
    });
  }
  
  // Set up tab navigation
  function setupTabNavigation() {
    const controlButtons = document.querySelectorAll('.control-btn:not(.disabled)');
    
    controlButtons.forEach(btn => {
      // Remove existing listener first to prevent duplicates
      btn.removeEventListener('click', handleTabClick);
      
      // Add click handler
      btn.addEventListener('click', handleTabClick);
    });
    
    // Restore active tab from localStorage
    try {
      const activeTab = localStorage.getItem('bambiActiveTab');
      if (activeTab) {
        const tabButton = document.querySelector(`.control-btn[data-target="${activeTab}"]`);
        if (tabButton && !tabButton.classList.contains('disabled')) {
          tabButton.click();
        }
      }
    } catch (error) {
      console.error('Error restoring active tab:', error);
    }
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
    
    // Store in localStorage
    try {
      localStorage.setItem('bambiActiveTab', targetId);
    } catch (error) {
      console.error('Error storing active tab:', error);
    }
  }
  
  // Check feature availability based on user level
  function checkFeatureAvailability() {
    const userLevel = state.xp.level || 0;
    
    // Update control buttons based on level
    Object.keys(featureRequirements).forEach(feature => {
      const requiredLevel = featureRequirements[feature];
      const btn = document.querySelector(`.control-btn[data-target="${feature}-panel"]`);
      
      if (btn) {
        if (userLevel < requiredLevel) {
          btn.classList.add('disabled');
          btn.setAttribute('title', `Reach Level ${requiredLevel} to unlock`);
          
          // Add lock icon if not present
          if (!btn.textContent.includes('🔒')) {
            btn.textContent = btn.textContent + ' 🔒';
          }
        } else {
          btn.classList.remove('disabled');
          btn.setAttribute('title', '');
          
          // Remove lock icon if present
          btn.textContent = btn.textContent.replace(' 🔒', '');
        }
      }
    });
  }
  
  // Handle XP update event
  function handleXpUpdate(event) {
    if (!event.detail) return;
    
    // Update XP state
    state.xp.points = event.detail.xp || state.xp.points;
    
    // Check if level changed
    const oldLevel = state.xp.level;
    state.xp.level = event.detail.level || state.xp.level;
    
    // Save timestamp
    state.xp.lastAward = Date.now();
    
    // Save to storage
    saveToStorage();
    
    // If level changed, check feature availability
    if (oldLevel !== state.xp.level) {
      checkFeatureAvailability();
      
      // Notify level change
      document.dispatchEvent(new CustomEvent('level-changed', {
        detail: { 
          level: state.xp.level,
          oldLevel: oldLevel
        }
      }));
    }
  }
  
  // Handle session load event
  function handleSessionLoad(event) {
    if (event.detail && event.detail.session) {
      applySessionSettings(event.detail.session);
    }
  }
  
  // Handle setting change
  function handleSettingChange(event) {
    if (!event.detail || !event.detail.key) return;
    
    const { key, value } = event.detail;
    
    // Update settings section
    if (!state.settings) state.settings = {};
    state.settings[key] = value;
    
    // Save to storage
    saveToStorage();
  }
  
  // Apply settings from loaded session
  function applySessionSettings(session) {
    // Update triggers if available
    if (session.activeTriggers || session.metadata?.triggers) {
      const triggers = session.activeTriggers || session.metadata?.triggers || [];
      state.triggers.activeTriggers = Array.isArray(triggers) ? triggers : [triggers];
    }
    
    // Update collar if available
    if (session.collarSettings || (session.metadata?.collarActive !== undefined)) {
      state.collar.enabled = session.collarSettings?.enabled || session.metadata?.collarActive || false;
      state.collar.text = session.collarSettings?.text || session.metadata?.collarText || '';
    }
    
    // Update spirals if available
    if (session.spiralSettings || session.metadata?.spiralSettings) {
      const spiralSettings = session.spiralSettings || session.metadata?.spiralSettings || {};
      Object.assign(state.spirals, spiralSettings);
    }
    
    // Save updated state
    saveToStorage();
    
    // Notify components of session load
    document.dispatchEvent(new CustomEvent('system-update', {
      detail: { section: 'all', data: state }
    }));
  }
  
  // Save a state section
  function saveState(section, data) {
    if (!section) return;
    
    if (section === 'all') {
      // Full state replacement
      Object.keys(data).forEach(key => {
        if (state[key]) {
          state[key] = data[key];
        }
      });
    } else if (section === 'triggers') {
      // Special handling for triggers section
      if (data.activeTriggers) {
        // Ensure it's an array
        state.triggers.activeTriggers = Array.isArray(data.activeTriggers) 
          ? data.activeTriggers 
          : [data.activeTriggers];
      }
      
      if (data.triggerData) {
        state.triggers.triggerData = data.triggerData;
      }
    } else if (state[section]) {
      // Update existing section
      Object.assign(state[section], data);
    } else {
      // Create new section
      state[section] = data;
    }
    
    // Save to storage
    saveToStorage();
    
    // Notify components of state change
    document.dispatchEvent(new CustomEvent('system-update', {
      detail: { 
        section, 
        data: section === 'all' ? state : state[section]
      }
    }));
  }
  
  // Save state to localStorage
  function saveToStorage() {
    try {
      localStorage.setItem('bambiSystemState', JSON.stringify(state));
    } catch (e) {
      console.error('Error saving state:', e);
    }
  }
  
  // Get state
  function getState(section) {
    if (section === 'all') return { ...state };
    
    if (section) {
      return state[section] ? { ...state[section] } : null;
    }
    
    return { ...state };
  }
  
  // Check if a feature is available at current level
  function isFeatureAvailable(feature) {
    const requiredLevel = featureRequirements[feature] || 0;
    return (state.xp.level || 0) >= requiredLevel;
  }
  
  // Collect settings for session saving
  function collectSettings() {
    return {
      activeTriggers: state.triggers.activeTriggers || [],
      collarSettings: state.collar,
      spiralSettings: state.spirals,
      audioSettings: state.audio
    };
  }
  
  // Get user level
  function getUserLevel() {
    return state.xp.level || 0;
  }
  
  // Public API
  return {
    init,
    tearDown,
    saveState,
    getState,
    isFeatureAvailable,
    collectSettings,
    getUserLevel,
    applySessionSettings
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.bambiSystem.init);