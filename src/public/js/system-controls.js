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
    },
    advancedBinaural: {
      enabled: false,
      pattern: 'descent',
      customPattern: [],
      patternDuration: 20,
      transitionTime: 30
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

  // Save advanced binaural settings
  function saveAdvancedBinaural(settings) {
    if (!settings) return;
    
    state.advancedBinaural = {
      enabled: settings.advancedBinauralEnabled,
      pattern: settings.binauralPattern || 'descent',
      customPattern: settings.customPattern || [],
      patternDuration: settings.patternDuration || 20,
      transitionTime: settings.transitionTime || 30
    };
    
    saveState('advancedBinaural', state.advancedBinaural);
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

    // Load advanced binaural settings
    if (profile.systemControls.advancedBinauralEnabled !== undefined) {
      state.advancedBinaural.enabled = profile.systemControls.advancedBinauralEnabled;
      state.advancedBinaural.pattern = profile.systemControls.binauralPattern || 'descent';
      state.advancedBinaural.patternDuration = profile.systemControls.patternDuration || 20;
      state.advancedBinaural.transitionTime = profile.systemControls.transitionTime || 30;
      
      if (profile.systemControls.customPattern) {
        state.advancedBinaural.customPattern = profile.systemControls.customPattern;
      }
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
    init, 
    saveState, 
    collectSettings, 
    loadFromProfile, 
    saveBrainwaveSettings,
    saveAdvancedBinaural
  };
})();

// System controls coordinator
document.addEventListener("DOMContentLoaded", function() {
  // Track loaded components
  const componentsState = {
    triggers: false,
    collar: false,
    sessions: false,
    spirals: false,
    hypnosis: false,
    audios: false,
    brainwaves: false,
    advancedBinaural: false
  };
  
  // Simple last-used tab persistence
  function loadLastTab() {
    const lastTab = localStorage.getItem('bambiLastTab');
    if (lastTab) {
      const tabButton = document.querySelector(`.control-btn[data-target="${lastTab}"]`);
      if (tabButton && !tabButton.classList.contains('disabled')) {
        tabButton.click();
      }
    }
  }
  
  // Save last active tab
  const controlButtons = document.querySelectorAll('.control-btn:not(.disabled)');
  controlButtons.forEach(button => {
    button.addEventListener('click', function() {
      const targetId = this.getAttribute('data-target');
      if (targetId) {
        localStorage.setItem('bambiLastTab', targetId);
      }
    });
  });
  
  // Listen for component load events
  document.addEventListener('triggers-loaded', () => componentsState.triggers = true);
  document.addEventListener('collar-loaded', () => componentsState.collar = true);
  document.addEventListener('sessions-loaded', () => componentsState.sessions = true);
  document.addEventListener('spirals-loaded', () => componentsState.spirals = true);
  document.addEventListener('hypnosis-loaded', () => componentsState.hypnosis = true);
  document.addEventListener('audios-loaded', () => componentsState.audios = true);
  document.addEventListener('brainwaves-loaded', () => {
    componentsState.brainwaves = true;
    
    // Apply initial state to brainwave controls
    const state = JSON.parse(localStorage.getItem('bambiSystemState') || '{}');
    if (state.brainwaves) {
      const brainwaveToggle = document.getElementById('brainwave-enable');
      const brainwaveMode = document.getElementById('brainwave-mode');
      const customFrequency = document.getElementById('custom-frequency');
      const carrierFrequency = document.getElementById('carrier-frequency');
      const brainwaveVolume = document.getElementById('brainwave-volume');
      
      if (brainwaveToggle) brainwaveToggle.checked = state.brainwaves.enabled;
      if (brainwaveMode) brainwaveMode.value = state.brainwaves.mode || 'alpha';
      if (customFrequency) customFrequency.value = state.brainwaves.customFrequency || 10;
      if (carrierFrequency) carrierFrequency.value = state.brainwaves.carrierFrequency || 200;
      if (brainwaveVolume) brainwaveVolume.value = state.brainwaves.volume || 50;
      
      // Update any value displays
      if (customFrequency) {
        const display = document.getElementById('custom-frequency-value');
        if (display) display.textContent = (state.brainwaves.customFrequency || 10) + ' Hz';
      }
      
      if (carrierFrequency) {
        const display = document.getElementById('carrier-frequency-value');
        if (display) display.textContent = (state.brainwaves.carrierFrequency || 200) + ' Hz';
      }
      
      if (brainwaveVolume) {
        const display = document.getElementById('brainwave-volume-value');
        if (display) display.textContent = (state.brainwaves.volume || 50) + '%';
      }
      
      // Update mode description
      if (brainwaveMode) {
        const descriptions = {
          alpha: "Alpha waves (8-14Hz) promote relaxed focus and are ideal for gentle trance states.",
          theta: "Theta waves (4-8Hz) induce deep trance and meditation states, enhancing suggestibility.",
          delta: "Delta waves (1-4Hz) are associated with deep sleep and unconscious mind programming.",
          beta: "Beta waves (14-30Hz) create an alert, focused state and can help with mental clarity.",
          custom: "Custom frequency allows precise tuning of brainwave entrainment effects."
        };
        
        const description = document.getElementById('frequency-description');
        if (description) {
          description.textContent = descriptions[state.brainwaves.mode] || descriptions.alpha;
        }
        
        // Show/hide custom frequency based on mode
        const customFreqContainer = document.getElementById('custom-freq-container');
        if (customFreqContainer) {
          customFreqContainer.style.display = state.brainwaves.mode === 'custom' ? '' : 'none';
        }
      }
    }
  });

  document.addEventListener('advanced-binaural-loaded', () => {
    componentsState.advancedBinaural = true;
    
    // Apply initial state to advanced binaural controls
    const state = JSON.parse(localStorage.getItem('bambiSystemState') || '{}');
    if (state.advancedBinaural) {
      const advancedBinauralToggle = document.getElementById('advanced-binaural-enable');
      const patternSelect = document.getElementById('pattern-select');
      const patternDuration = document.getElementById('pattern-duration');
      const transitionTime = document.getElementById('transition-time');
      
      if (advancedBinauralToggle) advancedBinauralToggle.checked = state.advancedBinaural.enabled;
      if (patternSelect) patternSelect.value = state.advancedBinaural.pattern || 'descent';
      if (patternDuration) patternDuration.value = state.advancedBinaural.patternDuration || 20;
      if (transitionTime) transitionTime.value = state.advancedBinaural.transitionTime || 30;
      
      // Update any value displays
      if (patternDuration) {
        const display = document.getElementById('pattern-duration-value');
        if (display) display.textContent = (state.advancedBinaural.patternDuration || 20) + ' minutes';
      }
      
      if (transitionTime) {
        const display = document.getElementById('transition-time-value');
        if (display) display.textContent = (state.advancedBinaural.transitionTime || 30) + ' seconds';
      }
      
      // Update pattern description
      if (patternSelect) {
        const descriptions = {
          descent: "Descent pattern gradually moves from alert Alpha waves down through Theta into deep Delta, creating a natural descent into trance.",
          ascent: "Ascent pattern guides you from deep Delta through Theta up to Alpha, perfect for waking from trance.",
          focus: "Focus cycle alternates between relaxed Alpha and alert Beta states to enhance concentration and mental clarity.",
          trance: "Deep trance loop cycles between Alpha and Theta waves to maintain a sustained hypnotic state.",
          custom: "Custom pattern allows you to design your own sequence of brainwave states."
        };
        
        const description = document.getElementById('pattern-description');
        if (description) {
          description.textContent = descriptions[state.advancedBinaural.pattern] || descriptions.descent;
        }
        
        // Show/hide custom pattern based on selection
        const customPatternContainer = document.getElementById('custom-pattern-container');
        if (customPatternContainer) {
          customPatternContainer.style.display = state.advancedBinaural.pattern === 'custom' ? '' : 'none';
        }
        
        // Load custom pattern segments if available
        if (state.advancedBinaural.pattern === 'custom' && state.advancedBinaural.customPattern?.length > 0) {
          const segmentsContainer = document.querySelector('.pattern-segments');
          if (segmentsContainer) {
            // Clear existing segments
            segmentsContainer.innerHTML = '';
            
            // Add saved segments
            state.advancedBinaural.customPattern.forEach(segment => {
              const newSegment = document.createElement('div');
              newSegment.className = 'pattern-segment';
              newSegment.innerHTML = `
                <select class="segment-wave">
                  <option value="alpha" ${segment.wave === 'alpha' ? 'selected' : ''}>Alpha</option>
                  <option value="theta" ${segment.wave === 'theta' ? 'selected' : ''}>Theta</option>
                  <option value="delta" ${segment.wave === 'delta' ? 'selected' : ''}>Delta</option>
                  <option value="beta" ${segment.wave === 'beta' ? 'selected' : ''}>Beta</option>
                </select>
                <input type="number" class="segment-duration" min="1" max="60" value="${segment.duration}"> mins
                <button class="remove-segment">×</button>
              `;
              
              segmentsContainer.appendChild(newSegment);
              
              // Add remove button event listener
              const removeButton = newSegment.querySelector('.remove-segment');
              removeButton.addEventListener('click', function() {
                segmentsContainer.removeChild(newSegment);
                
                // Update visualization if available
                const canvas = document.getElementById('pattern-visualization');
                if (canvas) {
                  const ctx = canvas.getContext('2d');
                  if (ctx && typeof drawVisualization === 'function') {
                    drawVisualization();
                  }
                }
              });
            });
          }
        }
        
        // Initialize visualization if canvas exists
        const canvas = document.getElementById('pattern-visualization');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx && typeof drawVisualization === 'function') {
            drawVisualization();
          }
        }
      }
    }
  });
});

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