// Central state manager for system controls
window.bambiSystem = (function() {
  // State storage
  const state = {
    triggers: [],
    collar: { enabled: false, text: '' },
    spirals: {
      enabled: false,
      spiral1Width: 5.0,
      spiral2Width: 3.0,
      spiral1Speed: 20, 
      spiral2Speed: 15
    }
  };

  // Init system
  function init() {
    loadFromStorage();
    setupEvents();

    // Listen for session load events
    document.addEventListener('session-loaded', function(e) {
      if (e.detail && e.detail.session) {
        // Update state with session data
        const session = e.detail.session;
        
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
    });
  }

  // Load saved state
  function loadFromStorage() {
    try {
      const saved = localStorage.getItem('bambiSystemState');
      if (saved) Object.assign(state, JSON.parse(saved));
    } catch (e) {
      console.error('Error loading state:', e);
    }
  }

  // Save state
  function saveState(section, data) {
    if (section && data) state[section] = {...state[section], ...data};
    localStorage.setItem('bambiSystemState', JSON.stringify(state));
    
    // Notify components
    document.dispatchEvent(new CustomEvent('system-update', {
      detail: { section, data: section ? state[section] : state }
    }));
  }

  // Setup events
  function setupEvents() {
    // Collar save button
    const collarBtn = document.getElementById('save-collar');
    if (collarBtn) collarBtn.addEventListener('click', saveCollar);
    
    // Spirals save button
    const spiralsBtn = document.getElementById('save-spirals');
    if (spiralsBtn) spiralsBtn.addEventListener('click', saveSpirals);
    
    // Connect triggers when UI is ready
    document.addEventListener('trigger-controls-loaded', setupTriggers);
  }

  // Set up trigger controls
  function setupTriggers() {
    // Connect individual toggles
    const toggles = document.querySelectorAll('.toggle-input');
    toggles.forEach(t => t.addEventListener('change', saveTriggers));
    
    // Connect bulk buttons
    const selectAll = document.getElementById('select-all-triggers');
    if (selectAll) {
      selectAll.addEventListener('click', function() {
        toggles.forEach(t => t.checked = true);
        saveTriggers();
      });
    }
    
    const clearAll = document.getElementById('clear-all-triggers');
    if (clearAll) {
      clearAll.addEventListener('click', function() {
        toggles.forEach(t => t.checked = false);
        saveTriggers();
      });
    }
  }

  // Save triggers
  function saveTriggers() {
    const triggers = [];
    document.querySelectorAll('.toggle-input:checked').forEach(t => {
      const name = t.getAttribute('data-trigger');
      if (name) triggers.push({ 
        name, 
        description: t.getAttribute('data-description') || 'Trigger effect' 
      });
    });
    
    saveState('triggers', { triggers });
  }

  // Save collar
  function saveCollar() {
    const enable = document.getElementById('collar-enable');
    const text = document.getElementById('textarea-collar');
    
    if (enable && text) {
      saveState('collar', {
        enabled: enable.checked,
        text: text.value.trim()
      });
    }
  }

  // Save spirals
  function saveSpirals() {
    const enable = document.getElementById('spirals-enable');
    if (enable) {
      saveState('spirals', {
        enabled: enable.checked,
        spiral1Width: parseFloat(document.getElementById('spiral1-width')?.value || 5.0),
        spiral2Width: parseFloat(document.getElementById('spiral2-width')?.value || 3.0),
        spiral1Speed: parseInt(document.getElementById('spiral1-speed')?.value || 20),
        spiral2Speed: parseInt(document.getElementById('spiral2-speed')?.value || 15)
      });
    }
  }

    // Format for worker
    function collectSettings() {
      // Ensure triggers is always an array
      const triggersArray = Array.isArray(state.triggers) 
        ? state.triggers 
        : (state.triggers ? [state.triggers] : []);
      
      return {
        activeTriggers: triggersArray.map(t => typeof t === 'object' ? t.name : t),
        triggerDetails: triggersArray.map(t => {
          if (typeof t === 'string') {
            return { name: t, description: 'Trigger effect' };
          } else if (typeof t === 'object') {
            return {
              name: t.name || 'Unknown',
              description: t.description || 'Trigger effect'
            };
          }
          return { name: String(t), description: 'Trigger effect' };
        }),
        collarSettings: state.collar,
        spiralSettings: state.spirals
      };
    }

  // Load from profile
  function loadFromProfile(profile) {
    if (!profile?.systemControls) return;
    
    // Load triggers
    if (profile.systemControls.activeTriggers) {
      state.triggers = profile.systemControls.activeTriggers.map(name => ({
        name, description: 'Trigger effect'
      }));
    }
    
    // Load collar
    if (profile.systemControls.collarEnabled !== undefined) {
      state.collar.enabled = profile.systemControls.collarEnabled;
      state.collar.text = profile.systemControls.collarText || '';
    }
    
    // Load spirals
    if (profile.systemControls.spiralsEnabled !== undefined) {
      state.spirals.enabled = profile.systemControls.spiralsEnabled;
      if (profile.systemControls.spiral1Width) state.spirals.spiral1Width = profile.systemControls.spiral1Width;
      if (profile.systemControls.spiral2Width) state.spirals.spiral2Width = profile.systemControls.spiral2Width;
      if (profile.systemControls.spiral1Speed) state.spirals.spiral1Speed = profile.systemControls.spiral1Speed;
      if (profile.systemControls.spiral2Speed) state.spirals.spiral2Speed = profile.systemControls.spiral2Speed;
    }
    
    localStorage.setItem('bambiSystemState', JSON.stringify(state));
  }

  // Public API
  return {
    init, saveState, collectSettings, loadFromProfile
  };
})();

document.addEventListener('DOMContentLoaded', window.bambiSystem.init);