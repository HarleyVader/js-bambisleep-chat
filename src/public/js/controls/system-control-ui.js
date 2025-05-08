/**
 * System Controls UI module
 */
window.systemControlUI = (function() {
  // Control definitions
  const controls = [
    { id: 'triggers', label: 'Triggers', requiredLevel: 1 },
    { id: 'collar', label: 'Collar', requiredLevel: 2 },
    { id: 'sessions', label: 'Sessions', requiredLevel: 3 },
    { id: 'spirals', label: 'Spirals', requiredLevel: 4 },
    { id: 'hypnosis', label: 'Hypnosis', requiredLevel: 5 },
    { id: 'audio', label: 'Audio', requiredLevel: 6 },
    { id: 'binaurals', label: 'Binaurals', requiredLevel: 7 }
  ];
  
  // Simple state
  let activeTab = null;
  let userLevel = 0;
  let triggerCategories = {};
  
  // DOM references for cleanup
  const elements = [];
  
  // Initialize the module
  function init() {
    try {
      console.log('System Controls UI initialized');
      
      document.addEventListener('system-initialized', handleSystemInit);
      setupTabSwitching();
      updateUserLevel();
      
      // Listen for trigger events
      document.addEventListener('trigger-activated', handleTriggerActivated);
      document.addEventListener('trigger-list-updated', updateTriggersList);
      
      // Listen for XP changes
      if (window.socket) {
        window.socket.on('server-xp-awarded', handleXpUpdate);
      }
    } catch (error) {
      console.error('Error initializing system controls UI:', error);
    }
  }
  
  // Handle XP updates from server
  function handleXpUpdate(data) {
    try {
      if (data && data.level !== undefined) {
        // Update level if different
        if (data.level !== userLevel) {
          userLevel = data.level;
          updateControlAvailability();
        }
        
        // Update XP progress bar
        const progressFill = document.getElementById('xp-progress-fill');
        const progressLabel = document.getElementById('xp-progress-label');
        const levelIndicator = document.getElementById('level-indicator');
        
        if (progressFill && data.percentToNextLevel !== undefined) {
          progressFill.style.width = `${data.percentToNextLevel}%`;
        }
        
        if (progressLabel && data.currentXp !== undefined && data.xpForNextLevel !== undefined) {
          progressLabel.textContent = `${data.currentXp} / ${data.xpForNextLevel} XP`;
        }
        
        if (levelIndicator) {
          levelIndicator.textContent = `Level ${data.level}`;
        }
      }
    } catch (error) {
      console.error('Error handling XP update:', error);
    }
  }
  
  // Handle trigger activation
  function handleTriggerActivated(event) {
    try {
      const triggerName = event.detail?.triggerName;
      if (!triggerName) return;
      
      // Update trigger UI if visible
      const triggerEl = document.querySelector(`.trigger-item[data-trigger="${triggerName}"]`);
      if (triggerEl) {
        // Add active class temporarily
        triggerEl.classList.add('active');
        
        // Remove after animation completes
        setTimeout(() => {
          triggerEl.classList.remove('active');
        }, 2000);
      }
    } catch (error) {
      console.error('Error handling trigger activation:', error);
    }
  }
  
  // Update trigger list when triggers change
  function updateTriggersList(event) {
    try {
      const triggers = event.detail?.triggers || [];
      
      // Ensure triggers is an array
      const triggersArray = Array.isArray(triggers) ? triggers : [];
      
      const container = document.getElementById('triggers-container');
      if (!container) return;
      
      // Organize triggers by category
      triggerCategories = {};
      triggersArray.forEach(trigger => {
        const category = trigger.category || 'General';
        if (!triggerCategories[category]) {
          triggerCategories[category] = [];
        }
        triggerCategories[category].push(trigger);
      });
      
      renderTriggerCategories(container);
    } catch (error) {
      console.error('Error updating triggers list:', error);
    }
  }
  
  // Render trigger categories
  function renderTriggerCategories(container) {
    try {
      container.innerHTML = '';
      
      if (Object.keys(triggerCategories).length === 0) {
        container.innerHTML = '<div class="info-message">No triggers available</div>';
        return;
      }
      
      // Create fragment to batch DOM operations
      const fragment = document.createDocumentFragment();
      
      Object.entries(triggerCategories).forEach(([category, triggers]) => {
        // Create category container
        const categoryEl = document.createElement('div');
        categoryEl.className = 'trigger-category';
        
        // Create category header
        const header = document.createElement('h4');
        header.textContent = category;
        categoryEl.appendChild(header);
        
        // Create triggers list
        const triggerList = document.createElement('div');
        triggerList.className = 'trigger-list';
        
        // Add triggers to list
        triggers.forEach(trigger => {
          const triggerEl = document.createElement('div');
          triggerEl.className = 'trigger-item';
          triggerEl.setAttribute('data-trigger', trigger.name);
          triggerEl.textContent = trigger.name;
          
          triggerEl.addEventListener('click', () => {
            activateTrigger(trigger.name);
          });
          
          elements.push(triggerEl);
          triggerList.appendChild(triggerEl);
        });
        
        categoryEl.appendChild(triggerList);
        fragment.appendChild(categoryEl);
      });
      
      container.appendChild(fragment);
    } catch (error) {
      console.error('Error rendering trigger categories:', error);
    }
  }
  
  // Activate a trigger
  function activateTrigger(triggerName) {
    try {
      // Update state immediately for responsive feel
      const triggerEl = document.querySelector(`.trigger-item[data-trigger="${triggerName}"]`);
      if (triggerEl) {
        triggerEl.classList.add('active');
        
        // Remove after animation time
        setTimeout(() => {
          triggerEl.classList.remove('active');
        }, 2000);
      }
      
      // Emit event for other systems
      if (window.socket && window.socket.connected) {
        window.socket.emit('client-trigger-activate', {
          triggerName,
          timestamp: Date.now()
        });
      }
      
      // Award XP for using trigger
      awardXpForAction('trigger-used', 1);
    } catch (error) {
      console.error('Error activating trigger:', error);
    }
  }
  
  // Update user level from bambiSystem or data attribute
  function updateUserLevel() {
    try {
      if (window.bambiSystem) {
        userLevel = window.bambiSystem.getUserLevel();
      } else {
        userLevel = parseInt(document.body.getAttribute('data-level') || '0');
      }
      
      updateControlAvailability();
    } catch (error) {
      console.error('Error updating user level:', error);
    }
  }
  
  // Handle system initialization
  function handleSystemInit() {
    try {
      updateUserLevel();
      
      const buttonsContainer = document.getElementById('buttons');
      if (buttonsContainer && buttonsContainer.children.length === 0) {
        createControls();
      }
      
      // Load triggers from system state
      if (window.bambiSystem) {
        const triggers = window.bambiSystem.getState('triggers') || [];
        // Ensure we're passing an array of trigger objects
        const triggerObjects = Array.isArray(triggers) ? 
          triggers.map(t => typeof t === 'string' ? { name: t, category: 'General' } : t) : 
          [];
          
        updateTriggersList({
          detail: { triggers: triggerObjects }
        });
      }
      
      activateDefaultTab();
    } catch (error) {
      console.error('Error handling system initialization:', error);
    }
  }
  
  // Setup tab switching
  function setupTabSwitching() {
    try {
      const container = document.getElementById('system-controls-container');
      if (!container) return;
      
      container.addEventListener('click', function(event) {
        const button = event.target.closest('.control-btn');
        if (!button || button.classList.contains('disabled')) return;
        
        const targetId = button.getAttribute('data-target');
        if (targetId) {
          switchToTab(targetId);
          
          try {
            localStorage.setItem('bambiActiveTab', targetId);
          } catch (e) {
            console.error('Error saving tab state:', e);
          }
        }
      });
      
      elements.push(container);
    } catch (error) {
      console.error('Error setting up tab switching:', error);
    }
  }
  
  // Switch to a specific tab
  function switchToTab(tabId) {
    try {
      // Hide all panels
      document.querySelectorAll('.control-panel').forEach(panel => {
        panel.style.display = 'none';
      });
      
      // Remove active class from all buttons
      document.querySelectorAll('.control-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Show selected panel
      const panel = document.getElementById(tabId);
      if (panel) {
        panel.style.display = 'block';
      }
      
      // Add active class to button
      const button = document.querySelector(`.control-btn[data-target="${tabId}"]`);
      if (button) {
        button.classList.add('active');
      }
      
      activeTab = tabId;
    } catch (error) {
      console.error('Error switching tabs:', error);
    }
  }
  
  // Create control buttons and panels
  function createControls() {
    try {
      const buttonsContainer = document.getElementById('buttons');
      const panelsContainer = document.getElementById('console');
      
      if (!buttonsContainer || !panelsContainer) return;
      
      buttonsContainer.innerHTML = '';
      panelsContainer.innerHTML = '';
      
      const buttonFragment = document.createDocumentFragment();
      const panelFragment = document.createDocumentFragment();
      
      controls.forEach(control => {
        // Create button
        const button = document.createElement('button');
        button.id = `${control.id}-button`;
        button.className = 'control-btn';
        button.setAttribute('data-target', `${control.id}-panel`);
        button.setAttribute('data-level-required', control.requiredLevel);
        button.textContent = control.label;
        
        if (control.requiredLevel > userLevel) {
          button.classList.add('disabled');
          button.textContent += ' 🔒';
          button.title = `Unlock at Level ${control.requiredLevel}`;
        }
        
        // Create panel
        const panel = document.createElement('div');
        panel.id = `${control.id}-panel`;
        panel.className = 'control-panel';
        panel.style.display = 'none';
        
        // Add content based on panel type
        switch (control.id) {
          case 'triggers':
            panel.innerHTML = createTriggersPanel();
            break;
          case 'collar':
            panel.innerHTML = createCollarPanel();
            break;
          case 'sessions':
            panel.innerHTML = createSessionsPanel();
            break;
          case 'spirals':
            panel.innerHTML = createSpiralsPanel();
            break;
          case 'hypnosis':
            panel.innerHTML = createHypnosisPanel();
            break;
          case 'audio':
            panel.innerHTML = createAudioPanel();
            break;
          case 'binaurals':
            panel.innerHTML = createBinauralsPanel();
            break;
          default:
            panel.innerHTML = `<p>Content for ${control.label}</p>`;
        }
        
        buttonFragment.appendChild(button);
        panelFragment.appendChild(panel);
      });
      
      buttonsContainer.appendChild(buttonFragment);
      panelsContainer.appendChild(panelFragment);
      
      initializePanelFunctionality();
    } catch (error) {
      console.error('Error creating controls:', error);
    }
  }
  
  // Initialize panel-specific functionality
  function initializePanelFunctionality() {
    try {
      setupCollarPanel();
      setupSpiralsPanel();
      setupSessionsPanel();
      setupAudioPanel();
      setupTriggersPanel();
    } catch (error) {
      console.error('Error initializing panel functionality:', error);
    }
  }
  
  // Setup trigger panel functionality
  function setupTriggersPanel() {
    try {
      const loopToggle = document.getElementById('trigger-loop');
      const volumeSlider = document.getElementById('trigger-volume');
      
      if (loopToggle) {
        // Load setting
        if (window.bambiSystem) {
          const triggerSettings = window.bambiSystem.getState('triggerSettings') || {};
          loopToggle.checked = triggerSettings.loop || false;
        }
        
        // Save setting
        loopToggle.addEventListener('change', function() {
          if (window.bambiSystem) {
            window.bambiSystem.saveState('triggerSettings', {
              ...window.bambiSystem.getState('triggerSettings') || {},
              loop: loopToggle.checked
            });
          }
        });
        
        elements.push(loopToggle);
      }
      
      if (volumeSlider) {
        // Load setting
        if (window.bambiSystem) {
          const triggerSettings = window.bambiSystem.getState('triggerSettings') || {};
          volumeSlider.value = triggerSettings.volume || 70;
        }
        
        // Save setting
        volumeSlider.addEventListener('change', function() {
          if (window.bambiSystem) {
            window.bambiSystem.saveState('triggerSettings', {
              ...window.bambiSystem.getState('triggerSettings') || {},
              volume: parseInt(volumeSlider.value)
            });
          }
        });
        
        elements.push(volumeSlider);
      }
    } catch (error) {
      console.error('Error setting up triggers panel:', error);
    }
  }
  
  // Setup collar panel functionality
  function setupCollarPanel() {
    try {
      const collarEnable = document.getElementById('collar-enable');
      const collarText = document.getElementById('collar-text');
      const saveCollar = document.getElementById('save-collar');
      
      if (collarEnable && collarText && saveCollar) {
        // Load settings
        if (window.bambiSystem) {
          const collarSettings = window.bambiSystem.getState('collar') || {};
          collarEnable.checked = collarSettings.enabled || false;
          collarText.value = collarSettings.text || '';
        }
        
        // Save settings
        saveCollar.addEventListener('click', function() {
          const settings = {
            enabled: collarEnable.checked,
            text: collarText.value
          };
          
          if (window.bambiSystem) {
            window.bambiSystem.saveState('collar', settings);
          }
          
          // Update UI
          const collarContainer = document.getElementById('collar-container');
          const collarResponse = document.getElementById('textarea-collar-response');
          
          if (collarContainer && collarResponse) {
            collarContainer.style.display = settings.enabled ? 'block' : 'none';
            collarResponse.textContent = settings.text;
          }
          
          // Award XP for customization
          awardXpForAction('collar-customized', 5);
        });
        
        elements.push(saveCollar);
      }
    } catch (error) {
      console.error('Error setting up collar panel:', error);
    }
  }
  
  // Setup spirals panel functionality
  function setupSpiralsPanel() {
    try {
      const spiralEnable = document.getElementById('spiral-enable');
      const saveSpirals = document.getElementById('save-spirals');
      
      if (spiralEnable && saveSpirals) {
        // Load settings
        if (window.bambiSystem) {
          const spiralSettings = window.bambiSystem.getState('spirals') || {};
          spiralEnable.checked = spiralSettings.enabled || false;
          
          // Update range inputs
          const spiral1Width = document.getElementById('spiral1-width');
          const spiral2Width = document.getElementById('spiral2-width');
          const spiral1Speed = document.getElementById('spiral1-speed');
          const spiral2Speed = document.getElementById('spiral2-speed');
          
          if (spiral1Width) spiral1Width.value = spiralSettings.spiral1Width || 5;
          if (spiral2Width) spiral2Width.value = spiralSettings.spiral2Width || 3;
          if (spiral1Speed) spiral1Speed.value = spiralSettings.spiral1Speed || 20;
          if (spiral2Speed) spiral2Speed.value = spiralSettings.spiral2Speed || 15;
        }
        
        // Save settings
        saveSpirals.addEventListener('click', function() {
          const settings = {
            enabled: spiralEnable.checked,
            spiral1Width: parseFloat(document.getElementById('spiral1-width')?.value || 5),
            spiral2Width: parseFloat(document.getElementById('spiral2-width')?.value || 3),
            spiral1Speed: parseInt(document.getElementById('spiral1-speed')?.value || 20),
            spiral2Speed: parseInt(document.getElementById('spiral2-speed')?.value || 15)
          };
          
          if (window.bambiSystem) {
            window.bambiSystem.saveState('spirals', settings);
          }
          
          // Trigger spiral update event
          document.dispatchEvent(new CustomEvent('spiral-settings-updated', {
            detail: settings
          }));
          
          // Award XP for customization
          awardXpForAction('spiral-customized', 5);
        });
        
        elements.push(saveSpirals);
      }
    } catch (error) {
      console.error('Error setting up spirals panel:', error);
    }
  }
  
  // Setup sessions panel
  function setupSessionsPanel() {
    try {
      const saveSessionBtn = document.getElementById('save-session');
      const sessionNameInput = document.getElementById('session-name');
      
      if (saveSessionBtn && sessionNameInput) {
        saveSessionBtn.addEventListener('click', function() {
          const sessionName = sessionNameInput.value.trim();
          if (!sessionName) return;
          
          // Use bambiSessions if available
          if (window.bambiSessions) {
            window.bambiSessions.saveSession(sessionName);
          } else if (window.socket && window.socket.connected) {
            // Fallback to direct socket communication
            const sessionData = collectCurrentSettings();
            
            window.socket.emit('client-save-session', {
              name: sessionName,
              data: sessionData,
              timestamp: Date.now()
            });
          }
          
          // Clear input
          sessionNameInput.value = '';
          
          // Award XP
          awardXpForAction('session-saved', 10);
        });
        
        elements.push(saveSessionBtn);
        
        // Load sessions list
        loadSessions();
      }
    } catch (error) {
      console.error('Error setting up sessions panel:', error);
    }
  }
  
  // Load sessions
  function loadSessions() {
    try {
      const sessionList = document.getElementById('session-list');
      if (!sessionList) return;
      
      sessionList.innerHTML = '<div class="loading-message">Loading sessions...</div>';
      
      if (window.socket && window.socket.connected) {
        window.socket.emit('client-get-sessions', {}, function(response) {
          if (!response || !response.success || !response.sessions) {
            sessionList.innerHTML = '<div class="info-message">No saved sessions found</div>';
            return;
          }
          
          // Render sessions
          renderSessionsList(sessionList, response.sessions);
        });
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }
  
  // Render sessions list
  function renderSessionsList(container, sessions) {
    try {
      container.innerHTML = '';
      
      if (!sessions || sessions.length === 0) {
        container.innerHTML = '<div class="info-message">No saved sessions found</div>';
        return;
      }
      
      const fragment = document.createDocumentFragment();
      
      sessions.forEach(session => {
        const sessionEl = document.createElement('div');
        sessionEl.className = 'session-item';
        
        const nameEl = document.createElement('span');
        nameEl.className = 'session-name';
        nameEl.textContent = session.name;
        
        const loadBtn = document.createElement('button');
        loadBtn.className = 'load-session-btn';
        loadBtn.textContent = 'Load';
        loadBtn.addEventListener('click', function() {
          loadSession(session.id);
        });
        
        sessionEl.appendChild(nameEl);
        sessionEl.appendChild(loadBtn);
        fragment.appendChild(sessionEl);
        
        elements.push(loadBtn);
      });
      
      container.appendChild(fragment);
    } catch (error) {
      console.error('Error rendering sessions list:', error);
    }
  }
  
  // Load a session
  function loadSession(sessionId) {
    try {
      if (window.bambiSessions) {
        window.bambiSessions.loadSession(sessionId);
      } else if (window.socket && window.socket.connected) {
        window.socket.emit('client-load-session', { sessionId }, function(response) {
          if (response && response.success && response.sessionData) {
            applySessionSettings(response.sessionData);
          }
        });
      }
      
      // Award XP
      awardXpForAction('session-loaded', 3);
    } catch (error) {
      console.error('Error loading session:', error);
    }
  }
  
  // Apply session settings
  function applySessionSettings(settings) {
    try {
      // Update central state
      if (window.bambiSystem) {
        window.bambiSystem.applySessionSettings(settings);
      }
      
      // Notify components
      document.dispatchEvent(new CustomEvent('session-loaded', {
        detail: { settings }
      }));
    } catch (error) {
      console.error('Error applying session settings:', error);
    }
  }
  
  // Collect current settings
  function collectCurrentSettings() {
    try {
      // Use central state manager if available
      if (window.bambiSystem) {
        return {
          activeTriggers: window.bambiSystem.getState('triggers') || [],
          collarSettings: window.bambiSystem.getState('collar') || {},
          spiralSettings: window.bambiSystem.getState('spirals') || {}
        };
      }
      
      // Fallback to direct DOM access
      return {
        activeTriggers: [],
        collarSettings: {
          enabled: document.getElementById('collar-enable')?.checked || false,
          text: document.getElementById('collar-text')?.value || ''
        },
        spiralSettings: {
          enabled: document.getElementById('spiral-enable')?.checked || false,
          spiral1Width: parseFloat(document.getElementById('spiral1-width')?.value || 5),
          spiral2Width: parseFloat(document.getElementById('spiral2-width')?.value || 3),
          spiral1Speed: parseInt(document.getElementById('spiral1-speed')?.value || 20),
          spiral2Speed: parseInt(document.getElementById('spiral2-speed')?.value || 15)
        }
      };
    } catch (error) {
      console.error('Error collecting settings:', error);
      return {};
    }
  }
  
  // Setup audio panel
  function setupAudioPanel() {
    try {
      const masterVolume = document.getElementById('master-volume');
      const soundToggle = document.getElementById('sound-toggle');
      const voiceToggle = document.getElementById('voice-toggle');
      const saveAudio = document.getElementById('save-audio');
      
      if (masterVolume && soundToggle && voiceToggle && saveAudio) {
        // Load settings
        try {
          const audioSettings = JSON.parse(localStorage.getItem('audioSettings') || '{}');
          
          masterVolume.value = audioSettings.volume !== undefined ? audioSettings.volume : 70;
          soundToggle.checked = audioSettings.enableSound !== undefined ? audioSettings.enableSound : true;
          voiceToggle.checked = audioSettings.enableVoice !== undefined ? audioSettings.enableVoice : false;
          
          // Update display
          document.getElementById('master-volume-value').textContent = `${masterVolume.value}%`;
        } catch (e) {
          console.error('Error loading audio settings:', e);
        }
        
        // Volume slider change
        masterVolume.addEventListener('input', function() {
          document.getElementById('master-volume-value').textContent = `${masterVolume.value}%`;
        });
        
        // Save settings
        saveAudio.addEventListener('click', function() {
          const settings = {
            volume: parseInt(masterVolume.value),
            enableSound: soundToggle.checked,
            enableVoice: voiceToggle.checked
          };
          
          try {
            localStorage.setItem('audioSettings', JSON.stringify(settings));
          } catch (e) {
            console.error('Error saving audio settings:', e);
          }
          
          // Apply settings
          if (window.audioPlayer) {
            window.audioPlayer.setVolume(settings.volume / 100);
            window.audioPlayer.setEnabled(settings.enableSound);
          }
          
          // Set voice recognition
          if (window.voiceRecognition) {
            window.voiceRecognition.setEnabled(settings.enableVoice);
          }
          
          // Award XP
          awardXpForAction('audio-settings-changed', 2);
        });
        
        elements.push(saveAudio);
        elements.push(masterVolume);
      }
    } catch (error) {
      console.error('Error setting up audio panel:', error);
    }
  }
  
  // Create triggers panel content
  function createTriggersPanel() {
    return `
      <div class="panel-content">
        <h3>Bambi Triggers</h3>
        <div class="triggers-container" id="triggers-container">
          <div class="loading-message">Loading triggers...</div>
        </div>
        <div class="trigger-settings">
          <div class="setting-group">
            <label for="trigger-loop">Loop Triggers</label>
            <input type="checkbox" id="trigger-loop" class="toggle-input">
          </div>
          <div class="setting-group">
            <label for="trigger-volume">Volume</label>
            <input type="range" id="trigger-volume" min="0" max="100" value="70">
            <span id="volume-value">70%</span>
          </div>
        </div>
      </div>
    `;
  }
  
  // Create collar panel content
  function createCollarPanel() {
    return `
      <div class="panel-content">
        <h3>Bambi Collar</h3>
        <div class="collar-settings">
          <div class="setting-group">
            <label for="collar-enable">Enable Collar</label>
            <input type="checkbox" id="collar-enable" class="toggle-input">
          </div>
          <div class="setting-group">
            <label for="collar-text">Collar Text</label>
            <input type="text" id="collar-text" placeholder="Enter collar text">
          </div>
          <button id="save-collar" class="action-button">Save Collar Settings</button>
        </div>
      </div>
    `;
  }
  
  // Create sessions panel content
  function createSessionsPanel() {
    return `
      <div class="panel-content">
        <h3>Bambi Sessions</h3>
        <div class="sessions-container">
          <div class="session-save">
            <input type="text" id="session-name" placeholder="Session Name">
            <button id="save-session" class="action-button">Save Session</button>
          </div>
          <div class="session-list" id="session-list">
            <div class="loading-message">Loading sessions...</div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Create spirals panel content
  function createSpiralsPanel() {
    return `
      <div class="panel-content">
        <h3>Bambi Spirals</h3>
        <div class="spiral-settings">
          <div class="setting-group">
            <label for="spiral-enable">Enable Spirals</label>
            <input type="checkbox" id="spiral-enable" class="toggle-input">
          </div>
          <div class="spiral-controls">
            <div class="setting-group">
              <label for="spiral1-width">Spiral 1 Width</label>
              <input type="range" id="spiral1-width" min="1" max="10" value="5">
              <span class="value-display">5.0</span>
            </div>
            <div class="setting-group">
              <label for="spiral2-width">Spiral 2 Width</label>
              <input type="range" id="spiral2-width" min="1" max="10" value="3">
              <span class="value-display">3.0</span>
            </div>
            <div class="setting-group">
              <label for="spiral1-speed">Spiral 1 Speed</label>
              <input type="range" id="spiral1-speed" min="1" max="50" value="20">
              <span class="value-display">20</span>
            </div>
            <div class="setting-group">
              <label for="spiral2-speed">Spiral 2 Speed</label>
              <input type="range" id="spiral2-speed" min="1" max="50" value="15">
              <span class="value-display">15</span>
            </div>
          </div>
          <button id="save-spirals" class="action-button">Save Spiral Settings</button>
        </div>
      </div>
    `;
  }
  
  // Create hypnosis panel content
  function createHypnosisPanel() {
    return `
      <div class="panel-content">
        <h3>Hypnosis Files</h3>
        <div class="hypnosis-container">
          <p>Available at Level 5</p>
          <div class="file-list" id="hypnosis-files">
            <div class="file-item locked">
              <span class="file-name">Bambi Conditioning</span>
              <span class="file-lock">🔒</span>
            </div>
            <div class="file-item locked">
              <span class="file-name">Deep Trance</span>
              <span class="file-lock">🔒</span>
            </div>
            <div class="file-item locked">
              <span class="file-name">Mindless Mode</span>
              <span class="file-lock">🔒</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Create audio panel content
  function createAudioPanel() {
    return `
      <div class="panel-content">
        <h3>Audio Settings</h3>
        <div class="audio-settings">
          <div class="setting-group">
            <label for="master-volume">Master Volume</label>
            <input type="range" id="master-volume" min="0" max="100" value="70">
            <span id="master-volume-value">70%</span>
          </div>
          <div class="setting-group">
            <label for="sound-toggle">Sound Effects</label>
            <input type="checkbox" id="sound-toggle" class="toggle-input" checked>
          </div>
          <div class="setting-group">
            <label for="voice-toggle">Voice Recognition</label>
            <input type="checkbox" id="voice-toggle" class="toggle-input">
          </div>
          <button id="save-audio" class="action-button">Save Audio Settings</button>
        </div>
      </div>
    `;
  }
  
  // Create binaurals panel content
  function createBinauralsPanel() {
    return `
      <div class="panel-content">
        <h3>Binaural Beats</h3>
        <div class="binaural-container">
          <p>Available at Level 7</p>
          <div class="binaural-buttons">
            <button class="binaural-btn" data-wave="delta" disabled>Delta</button>
            <button class="binaural-btn" data-wave="theta" disabled>Theta</button>
            <button class="binaural-btn" data-wave="alpha" disabled>Alpha</button>
            <button class="binaural-btn" data-wave="beta" disabled>Beta</button>
            <button class="binaural-btn" data-wave="gamma" disabled>Gamma</button>
          </div>
          <div class="binaural-status">
            <p>Status: <span id="binaural-status">Inactive</span></p>
          </div>
        </div>
      </div>
    `;
  }
  
  // Update control availability based on user level
  function updateControlAvailability() {
    try {
      controls.forEach(control => {
        const button = document.getElementById(`${control.id}-button`);
        if (!button) return;
        
        if (userLevel < control.requiredLevel) {
          button.classList.add('disabled');
          if (!button.textContent.includes('🔒')) {
            button.textContent = button.textContent + ' 🔒';
          }
          button.title = `Unlock at Level ${control.requiredLevel}`;
        } else {
          button.classList.remove('disabled');
          button.textContent = button.textContent.replace(' 🔒', '');
          button.title = '';
        }
      });
    } catch (error) {
      console.error('Error updating control availability:', error);
    }
  }
  
  // Activate default tab
  function activateDefaultTab() {
    try {
      // Try to restore from localStorage first
      let savedTab = null;
      try {
        savedTab = localStorage.getItem('bambiActiveTab');
      } catch (e) {
        console.error('Error reading active tab from storage:', e);
      }
      
      // Filter available tabs based on user level
      const availableTabs = controls
        .filter(control => control.requiredLevel <= userLevel)
        .map(control => `${control.id}-panel`);
      
      // If saved tab exists and is available, use it
      if (savedTab && availableTabs.includes(savedTab)) {
        switchToTab(savedTab);
        return;
      }
      
      // Otherwise use the first available tab
      if (availableTabs.length > 0) {
        switchToTab(availableTabs[0]);
      }
    } catch (error) {
      console.error('Error activating default tab:', error);
    }
  }
  
  // Award XP for user actions
  function awardXpForAction(action, amount) {
    if (window.socket && window.socket.connected) {
      window.socket.emit('client-award-xp', {
        action,
        amount,
        timestamp: Date.now()
      });
    }
  }
  
  // Clean up
  function destroy() {
    try {
      // Remove event listeners
      document.removeEventListener('system-initialized', handleSystemInit);
      document.removeEventListener('trigger-activated', handleTriggerActivated);
      document.removeEventListener('trigger-list-updated', updateTriggersList);
      
      if (window.socket) {
        window.socket.off('server-xp-awarded', handleXpUpdate);
      }
      
      // Clean up other event listeners
      elements.forEach(el => {
        if (el.parentNode) {
          // Clone and replace to remove listeners
          el.parentNode.replaceChild(el.cloneNode(true), el);
        }
      });
      
      // Clear elements array
      elements.length = 0;
    } catch (error) {
      console.error('Error destroying system controls UI:', error);
    }
  }
  
  // Public API
  return {
    init,
    destroy,
    createControls,
    updateUserLevel
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.systemControlUI.init);