// Central state manager for system controls
window.bambiSystem = (function () {
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
    },
    brainwaves: {
      enabled: false,
      mode: 'alpha',
      customFrequency: 10,
      carrierFrequency: 400,
      volume: 50
    }
  };

  // Init system
  function init() {
    loadFromStorage();
    setupEvents();

    // Listen for session load events
    document.addEventListener('session-loaded', function (e) {
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

        // Update brainwaves if available
        if (session.brainwaveSettings || session.metadata?.brainwaveSettings) {
          const brainwaveSettings = session.brainwaveSettings || session.metadata?.brainwaveSettings || {};
          saveState('brainwaves', brainwaveSettings);
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
    if (section && data) {
      // Special handling for triggers section
      if (section === 'triggers') {
        // Ensure triggers is always stored as an array
        if (data.triggers && Array.isArray(data.triggers)) {
          state.triggers = data.triggers;
        } else if (data.triggers) {
          // Convert single trigger object to array if needed
          state.triggers = [data.triggers];
        } else {
          state.triggers = [];
        }
      } else {
        // Normal handling for other sections
        state[section] = { ...state[section], ...data };
      }
    }

    localStorage.setItem('bambiSystemState', JSON.stringify(state));

    // Notify components
    document.dispatchEvent(new CustomEvent('system-update', {
      detail: { section, data: section ? state[section] : state }
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

  // Save trigger state
  function saveTriggers() {
    // Get all checked trigger toggles using both naming conventions
    const toggles = document.querySelectorAll('.toggle-input:checked');

    // Convert to array of objects with name and description
    const activeTriggers = Array.from(toggles)
      .map(toggle => {
        // Check all possible attribute names for trigger
        const name = toggle.getAttribute('data-trigger') || 
                     toggle.getAttribute('data-trigger-name') || 
                     toggle.value || 
                     toggle.id;
                     
        const description = toggle.getAttribute('data-description') || 'Trigger effect';
        return { name, description };
      })
      .filter(t => t.name); // Only keep triggers with a name

    // Save to state
    saveState('triggers', { triggers: activeTriggers });

    // Send to server if socket is available
    if (window.socket && window.socket.connected) {
      const username = document.body.getAttribute('data-username');
      
      if (username) {
        const triggerNames = activeTriggers.map(t => t.name);
        window.socket.emit('triggers', {
          triggerNames: triggerNames.join(','),
          triggerDetails: activeTriggers,
          username: username
        });
        
        // Log for debugging
        console.log('Sent active triggers to server:', triggerNames);
      }
    }
  }

  // Set up trigger controls
  function setupTriggers() {
    // Connect individual toggles
    const toggles = document.querySelectorAll('.toggle-input');
    toggles.forEach(t => t.addEventListener('change', saveTriggers));

    // Connect bulk buttons
    const activateAll = document.getElementById('activate-all');
    if (activateAll) {
      activateAll.addEventListener('click', function () {
        document.querySelectorAll('.toggle-input').forEach(t => {
          // Toggle the current state
          t.checked = !t.checked;
        });
        saveTriggers();
      });
    }

    const playTriggers = document.getElementById('play-triggers');
    if (playTriggers) {
      playTriggers.addEventListener('click', function () {
        if (window.bambiAudio && typeof window.bambiAudio.playRandomPlaylist === 'function') {
          window.bambiAudio.playRandomPlaylist();
        }
      });
    }
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
      spiralSettings: state.spirals,
      brainwaveSettings: state.brainwaves
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
    
    // Load brainwave settings
    if (profile.systemControls.brainwaveEnabled !== undefined) {
      state.brainwaves.enabled = profile.systemControls.brainwaveEnabled;
      state.brainwaves.mode = profile.systemControls.brainwaveMode || 'alpha';
      state.brainwaves.customFrequency = profile.systemControls.customFrequency || 10;
      state.brainwaves.carrierFrequency = profile.systemControls.carrierFrequency || 400;
      state.brainwaves.volume = profile.systemControls.brainwaveVolume || 50;
    }

    localStorage.setItem('bambiSystemState', JSON.stringify(state));
  }

  // Additional function to save brainwave settings
  function saveBrainwaveSettings(settings) {
    if (!settings) return;
    
    state.brainwaves = {
      enabled: settings.brainwaveEnabled,
      mode: settings.brainwaveMode || 'alpha',
      customFrequency: settings.customFrequency || 10,
      carrierFrequency: settings.carrierFrequency || 400,
      volume: settings.brainwaveVolume || 50
    };
    
    saveState('brainwaves', state.brainwaves);
  }

  // Public API
  return {
    init, saveState, collectSettings, loadFromProfile, saveBrainwaveSettings
  };
})();

document.addEventListener('DOMContentLoaded', function() {
  // Initialize core system
  window.bambiSystem.init();
  
  // Save system settings on page unload
  window.addEventListener('beforeunload', function() {
    // Save any last-minute state
    const lastActiveTab = document.querySelector('.control-btn.active');
    if (lastActiveTab) {
      const tabId = lastActiveTab.getAttribute('data-target');
      if (tabId) {
        localStorage.setItem('bambiLastActiveTab', tabId);
      }
    }
  });
  
  // Check if all essential components are loaded
  let triggersLoaded = false;
  document.addEventListener('trigger-controls-loaded', function() {
    triggersLoaded = true;
    document.dispatchEvent(new CustomEvent('system-controls-ready'));
  });
  
  // Set timeout to ensure we don't wait forever
  setTimeout(function() {
    if (!triggersLoaded) {
      console.warn('Not all components loaded, but continuing anyway');
      document.dispatchEvent(new CustomEvent('system-controls-ready'));
    }
  }, 5000);
});