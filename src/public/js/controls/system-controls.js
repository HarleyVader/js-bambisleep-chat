/**
 * Central state manager for BambiSleep Chat
 * Manages feature state, dependencies, and interactions
 */

// Feature level requirements - central definition
window.FEATURE_LEVELS = {
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
  
  // Use the centralized feature levels
  const featureRequirements = window.FEATURE_LEVELS;
  
  // Track registered modules
  const registeredModules = {};
  
  // Register a module with the system
  function registerModule(moduleName, moduleAPI) {
    if (!moduleName || typeof moduleName !== 'string') {
      if (window.bambiConsole) {
        window.bambiConsole.error('bambiSystem', 'Module registration failed: Invalid module name');
      } else {
        console.error('Module registration failed: Invalid module name');
      }
      return false;
    }
    
    if (!moduleAPI || typeof moduleAPI !== 'object') {
      if (window.bambiConsole) {
        window.bambiConsole.error('bambiSystem', `Module registration failed for "${moduleName}": Invalid module API`);
      } else {
        console.error(`Module registration failed for "${moduleName}": Invalid module API`);
      }
      return false;
    }
    
    // Register the module
    registeredModules[moduleName] = moduleAPI;
    
    // Dispatch event for module registration
    try {
      document.dispatchEvent(new CustomEvent('module-registered', {
        detail: { moduleName, moduleAPI }
      }));
      
      if (window.bambiConsole) {
        window.bambiConsole.log('bambiSystem', `Module registered: ${moduleName}`);
      } else {
        console.log(`Module registered: ${moduleName}`);
      }
    } catch (err) {
      if (window.bambiConsole) {
        window.bambiConsole.error('bambiSystem', `Error dispatching module registration event for "${moduleName}":`, err);
      } else {
        console.error(`Error dispatching module registration event for "${moduleName}":`, err);
      }
    }
    
    return true;
  }
  
  // Get a registered module by name
  function getModule(moduleName) {
    return registeredModules[moduleName] || null;
  }
  
  // Get all registered modules (for debugging)
  function getRegisteredModules() {
    return {...registeredModules};
  }
  
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
      if (!saved) return; // No saved state
      
      // Handle the case where saved is already an object
      if (typeof saved === 'object' && saved !== null) {
        // Already an object, use directly
        const savedState = saved;
        
        // Merge saved state with defaults
        Object.keys(savedState).forEach(key => {
          if (state[key] && typeof state[key] === 'object') {
            state[key] = { ...state[key], ...savedState[key] };
          } else {
            state[key] = savedState[key];
          }
        });
        return;
      }
      
      // Handle "[object Object]" string explicitly
      if (saved === "[object Object]") {
        console.warn('Found corrupted state string "[object Object]", resetting bambiSystemState');
        localStorage.removeItem('bambiSystemState');
        return;
      }
      
      // Try to parse the string
      const savedState = JSON.parse(saved);
      
      // Merge saved state with defaults
      Object.keys(savedState).forEach(key => {
        if (state[key] && typeof state[key] === 'object') {
          state[key] = { ...state[key], ...savedState[key] };
        } else {
          state[key] = savedState[key];
        }
      });
      
      // Set user level from DOM if available
      const userLevel = parseInt(document.body.getAttribute('data-level') || '0');
      if (!isNaN(userLevel)) {
        state.xp.level = userLevel;
      }
    } catch (e) {
      console.error('Error loading state:', e);
      
      // Attempt recovery by clearing the corrupted state
      localStorage.removeItem('bambiSystemState');
      
      // Log details to help debug
      try {
        const saved = localStorage.getItem('bambiSystemState');
        console.warn('Corrupted state value:', saved);
        console.warn('Type:', typeof saved);
      } catch (innerErr) {
        // Nothing more we can do
      }
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
      
      // Also update panel visibility
      const panel = document.getElementById(`${feature}-panel`);
      if (panel) {
        if (userLevel < requiredLevel) {
          panel.classList.add('hidden');
        } else {
          panel.classList.remove('hidden');
        }
      }
    });
    
    // Dispatch event for other components to update
    document.dispatchEvent(new CustomEvent('feature-availability-changed', {
      detail: { level: userLevel }
    }));
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
      // Check if state is valid before stringifying
      if (!state || typeof state !== 'object') {
        console.error('Invalid state object:', state);
        return;
      }
      
      // Create a clean copy without potential circular references
      const cleanState = JSON.parse(JSON.stringify(state));
      
      // Save to localStorage
      localStorage.setItem('bambiSystemState', JSON.stringify(cleanState));
      
      // Verify the save worked correctly
      const savedValue = localStorage.getItem('bambiSystemState');
      if (savedValue === "[object Object]") {
        throw new Error('State was saved as "[object Object]" string');
      }
    } catch (e) {
      console.error('Error saving state:', e);
      
      // More detailed error logging
      if (e.name === 'QuotaExceededError') {
        console.warn('LocalStorage quota exceeded. Try clearing some storage.');
      } else if (e.name === 'SecurityError') {
        console.warn('Security settings prevented saving to localStorage.');
      }
      
      try {
        // Try to save a minimal version of the state
        const minimalState = {
          xp: state.xp,
          settings: state.settings
        };
        localStorage.setItem('bambiSystemState', JSON.stringify(minimalState));
        console.log('Saved minimal state as fallback');
      } catch (innerErr) {
        // Last resort - clear the state to prevent further errors
        localStorage.removeItem('bambiSystemState');
        console.warn('Cleared state due to persistent errors');
      }
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
    applySessionSettings,
    checkFeatureAvailability,
    registerModule,
    getModule,
    getRegisteredModules
  };
})();

// Fix for bambiSystemState JSON parsing issue in system-controls.js
(function() {
  // Patch the loadFromStorage function to handle already-parsed objects
  const originalLoadFromStorage = window.loadFromStorage;
  
  if (typeof originalLoadFromStorage === 'function') {
    window.loadFromStorage = function(key, defaultValue = {}) {
      try {
        const value = localStorage.getItem(key);
        
        // No value stored
        if (!value) return defaultValue;
        
        // If already an object (not a string), use directly
        if (typeof value === 'object' && value !== null) {
          return value;
        }
        
        // Try to parse if it's a string
        return JSON.parse(value);
      } catch (err) {
        console.warn(`Error loading ${key}, using default value`);
        return defaultValue;
      }
    };
  }
  
  // Fix saveToStorage to ensure proper JSON stringification
  const originalSaveToStorage = window.saveToStorage;
  
  if (typeof originalSaveToStorage === 'function') {
    window.saveToStorage = function(key, value) {
      try {
        // Make sure we stringify objects
        if (typeof value === 'object' && value !== null) {
          localStorage.setItem(key, JSON.stringify(value));
        } else {
          localStorage.setItem(key, value);
        }
      } catch (err) {
        console.warn(`Error saving ${key}`);
      }
    };
  }
  
  // Fix corrupted bambiSystemState if needed
  try {
    const rawState = localStorage.getItem('bambiSystemState');
    
    if (rawState && typeof rawState === 'object') {
      // It's already an object, we need to stringify it
      localStorage.setItem('bambiSystemState', JSON.stringify(rawState));
    } else if (rawState === '[object Object]') {
      // It's the string representation of toString() - create fresh state
      localStorage.removeItem('bambiSystemState');
    }
  } catch (err) {
    // Last resort - clear corrupted state
    localStorage.removeItem('bambiSystemState');
  }
})();

// Fix known corrupted localStorage items on load
document.addEventListener('DOMContentLoaded', function() {
  try {
    // Common keys that might be corrupted
    const keysToCheck = [
      'bambiSystemState', 
      'sessionSettings', 
      'triggerState', 
      'collarSettings', 
      'spiralSettings',
      'audioSettings',
      'xpData'
    ];
    
    // Check each key
    keysToCheck.forEach(key => {
      const value = localStorage.getItem(key);
      
      // Check for common corruption patterns
      if (value === "[object Object]" || value === "undefined" || value === "null") {
        console.warn(`Found corrupted state for ${key}, resetting`);
        localStorage.removeItem(key);
      } else if (value) {
        // Verify it's valid JSON if not null
        try {
          JSON.parse(value);
        } catch (parseErr) {
          console.warn(`Found invalid JSON for ${key}, resetting:`, value);
          localStorage.removeItem(key);
        }
      }
    });
  } catch (err) {
    console.error('Error fixing corrupted state:', err);
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.bambiSystem.init);