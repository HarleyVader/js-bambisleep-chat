window.systemControlUI = (function() {
  // Private variables
  let initialized = false;
  let controlButtons = [];
  let activePanel = null;

  // Initialize the system controls UI
  function init() {
    try {
      // Get DOM elements
      const buttonsContainer = document.getElementById('buttons');
      const consoleContainer = document.getElementById('console');
      
      if (!buttonsContainer || !consoleContainer) {
        console.error('Required DOM elements not found');
        return;
      }
      
      // Set up control buttons
      setupControlButtons(buttonsContainer);
      
      // Set up control panels
      setupControlPanels(consoleContainer);
      
      // Set up event listeners
      setupEventListeners();
      
      // Mark as initialized
      initialized = true;
      console.log('System Control UI initialized');
    } catch (error) {
      console.error('Error initializing system control UI:', error);
    }
  }
  
  // Set up control buttons
  function setupControlButtons(container) {
    if (!container) return;
    
    const buttonData = [
      { id: 'triggers-btn', text: 'Triggers', panel: 'triggers-panel', default: true },
      { id: 'collar-btn', text: 'Collar', panel: 'collar-panel', levelRequired: 3 },
      { id: 'spiral-btn', text: 'Spirals', panel: 'spiral-panel', levelRequired: 4 },
      { id: 'session-btn', text: 'Sessions', panel: 'session-panel', levelRequired: 5 }
    ];
    
    // Get user level
    const userLevel = parseInt(document.querySelector('.system-controls')?.getAttribute('data-user-level') || '0');
    
    // Create buttons
    buttonData.forEach(button => {
      // Skip buttons that require higher level
      if (button.levelRequired && userLevel < button.levelRequired) {
        return;
      }
      
      const buttonEl = document.createElement('button');
      buttonEl.id = button.id;
      buttonEl.className = 'control-button';
      buttonEl.textContent = button.text;
      buttonEl.setAttribute('data-panel', button.panel);
      
      if (button.levelRequired) {
        buttonEl.setAttribute('data-level-required', button.levelRequired);
      }
      
      if (button.default) {
        buttonEl.classList.add('active');
      }
      
      container.appendChild(buttonEl);
      controlButtons.push(buttonEl);
    });
  }
  
  // Set up control panels
  function setupControlPanels(container) {
    if (!container) return;
    
    // Create triggers panel
    const triggersPanel = document.createElement('div');
    triggersPanel.id = 'triggers-panel';
    triggersPanel.className = 'control-panel active';
    triggersPanel.innerHTML = `
      <div class="panel-header">
        <h3>Triggers Control</h3>
      </div>
      <div class="panel-content">
        <div id="triggers-list" class="triggers-list">
          <!-- Triggers will be loaded dynamically -->
          <div class="loading-spinner">Loading triggers...</div>
        </div>
      </div>
    `;
    container.appendChild(triggersPanel);
    activePanel = triggersPanel;
    
    // Get user level
    const userLevel = parseInt(document.querySelector('.system-controls')?.getAttribute('data-user-level') || '0');
    
    // Create collar panel if level is sufficient
    if (userLevel >= 3) {
      const collarPanel = document.createElement('div');
      collarPanel.id = 'collar-panel';
      collarPanel.className = 'control-panel';
      collarPanel.innerHTML = `
        <div class="panel-header">
          <h3>Collar Control</h3>
        </div>
        <div class="panel-content">
          <div class="control-setting">
            <label for="collar-toggle">Show Collar:</label>
            <input type="checkbox" id="collar-toggle" class="toggle-switch">
          </div>
          <div class="control-setting">
            <label for="collar-text">Collar Text:</label>
            <input type="text" id="collar-text" placeholder="Enter collar text">
          </div>
        </div>
      `;
      container.appendChild(collarPanel);
    }
    
    // Create spiral panel if level is sufficient
    if (userLevel >= 4) {
      const spiralPanel = document.createElement('div');
      spiralPanel.id = 'spiral-panel';
      spiralPanel.className = 'control-panel';
      spiralPanel.innerHTML = `
        <div class="panel-header">
          <h3>Spiral Control</h3>
        </div>
        <div class="panel-content">
          <div class="control-setting">
            <label for="spiral-toggle">Show Spirals:</label>
            <input type="checkbox" id="spiral-toggle" class="toggle-switch">
          </div>
          <div class="control-setting">
            <label for="spiral1-width">Spiral 1 Width:</label>
            <input type="range" id="spiral1-width" min="1" max="10" step="0.1" value="5.0">
            <span id="spiral1-width-value">5.0</span>
          </div>
          <div class="control-setting">
            <label for="spiral2-width">Spiral 2 Width:</label>
            <input type="range" id="spiral2-width" min="1" max="10" step="0.1" value="3.0">
            <span id="spiral2-width-value">3.0</span>
          </div>
          <div class="control-setting">
            <label for="spiral1-speed">Spiral 1 Speed:</label>
            <input type="range" id="spiral1-speed" min="5" max="50" step="1" value="20">
            <span id="spiral1-speed-value">20</span>
          </div>
          <div class="control-setting">
            <label for="spiral2-speed">Spiral 2 Speed:</label>
            <input type="range" id="spiral2-speed" min="5" max="50" step="1" value="15">
            <span id="spiral2-speed-value">15</span>
          </div>
        </div>
      `;
      container.appendChild(spiralPanel);
    }
    
    // Create session panel if level is sufficient
    if (userLevel >= 5) {
      const sessionPanel = document.createElement('div');
      sessionPanel.id = 'session-panel';
      sessionPanel.className = 'control-panel';
      sessionPanel.innerHTML = `
        <div class="panel-header">
          <h3>Session Control</h3>
        </div>
        <div class="panel-content">
          <div class="control-actions">
            <button id="save-session-btn" class="control-action-btn">Save Session</button>
            <button id="load-session-btn" class="control-action-btn">Load Session</button>
            <button id="share-session-btn" class="control-action-btn">Share Session</button>
          </div>
          <div id="sessions-container" class="session-selector-container">
            <h4>Your Saved Sessions</h4>
            <div id="session-list" class="session-list">
              <div class="loading-spinner">Loading sessions...</div>
            </div>
          </div>
        </div>
      `;
      container.appendChild(sessionPanel);
    }
  }
  
  // Set up event listeners
  function setupEventListeners() {
    // Button click event listeners
    controlButtons.forEach(button => {
      button.addEventListener('click', handleControlButtonClick);
    });
    
    // Initialize inputs with localStorage values or defaults
    loadSavedSettings();
    
    // Set up control panel event listeners
    setupControlPanelEvents();
  }
  
  // Handle control button clicks
  function handleControlButtonClick(event) {
    const panelId = event.target.getAttribute('data-panel');
    if (!panelId) return;
    
    // Update button active state
    controlButtons.forEach(btn => {
      btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update panel active state
    if (activePanel) {
      activePanel.classList.remove('active');
    }
    activePanel = document.getElementById(panelId);
    if (activePanel) {
      activePanel.classList.add('active');
    }
  }
  
  // Load saved settings from localStorage
  function loadSavedSettings() {
    try {
      // Load collar settings
      const collarToggle = document.getElementById('collar-toggle');
      const collarText = document.getElementById('collar-text');
      
      if (collarToggle && collarText) {
        const savedCollar = localStorage.getItem('collarSettings');
        if (savedCollar) {
          const collarSettings = JSON.parse(savedCollar);
          collarToggle.checked = collarSettings.enabled || false;
          collarText.value = collarSettings.text || '';
        }
      }
      
      // Load spiral settings
      const spiralToggle = document.getElementById('spiral-toggle');
      const spiral1Width = document.getElementById('spiral1-width');
      const spiral2Width = document.getElementById('spiral2-width');
      const spiral1Speed = document.getElementById('spiral1-speed');
      const spiral2Speed = document.getElementById('spiral2-speed');
      
      if (spiralToggle && spiral1Width && spiral2Width && spiral1Speed && spiral2Speed) {
        const savedSpiral = localStorage.getItem('spiralSettings');
        if (savedSpiral) {
          const spiralSettings = JSON.parse(savedSpiral);
          spiralToggle.checked = spiralSettings.enabled || false;
          spiral1Width.value = spiralSettings.spiral1Width || 5.0;
          spiral2Width.value = spiralSettings.spiral2Width || 3.0;
          spiral1Speed.value = spiralSettings.spiral1Speed || 20;
          spiral2Speed.value = spiralSettings.spiral2Speed || 15;
          
          // Update display values
          document.getElementById('spiral1-width-value').textContent = spiral1Width.value;
          document.getElementById('spiral2-width-value').textContent = spiral2Width.value;
          document.getElementById('spiral1-speed-value').textContent = spiral1Speed.value;
          document.getElementById('spiral2-speed-value').textContent = spiral2Speed.value;
        }
      }
    } catch (error) {
      console.error('Error loading saved settings:', error);
    }
  }
  
  // Setup control panel event listeners
  function setupControlPanelEvents() {
    // Collar events
    const collarToggle = document.getElementById('collar-toggle');
    const collarText = document.getElementById('collar-text');
    
    if (collarToggle) {
      collarToggle.addEventListener('change', saveCollarSettings);
    }
    
    if (collarText) {
      collarText.addEventListener('input', saveCollarSettings);
    }
    
    // Spiral events
    const spiralToggle = document.getElementById('spiral-toggle');
    const spiral1Width = document.getElementById('spiral1-width');
    const spiral2Width = document.getElementById('spiral2-width');
    const spiral1Speed = document.getElementById('spiral1-speed');
    const spiral2Speed = document.getElementById('spiral2-speed');
    
    if (spiralToggle) {
      spiralToggle.addEventListener('change', saveSpiralSettings);
    }
    
    if (spiral1Width) {
      spiral1Width.addEventListener('input', function() {
        document.getElementById('spiral1-width-value').textContent = this.value;
        saveSpiralSettings();
      });
    }
    
    if (spiral2Width) {
      spiral2Width.addEventListener('input', function() {
        document.getElementById('spiral2-width-value').textContent = this.value;
        saveSpiralSettings();
      });
    }
    
    if (spiral1Speed) {
      spiral1Speed.addEventListener('input', function() {
        document.getElementById('spiral1-speed-value').textContent = this.value;
        saveSpiralSettings();
      });
    }
    
    if (spiral2Speed) {
      spiral2Speed.addEventListener('input', function() {
        document.getElementById('spiral2-speed-value').textContent = this.value;
        saveSpiralSettings();
      });
    }
    
    // Session events
    const saveSessionBtn = document.getElementById('save-session-btn');
    const loadSessionBtn = document.getElementById('load-session-btn');
    const shareSessionBtn = document.getElementById('share-session-btn');
    
    if (saveSessionBtn) {
      saveSessionBtn.addEventListener('click', saveSession);
    }
    
    if (loadSessionBtn) {
      loadSessionBtn.addEventListener('click', loadSession);
    }
    
    if (shareSessionBtn) {
      shareSessionBtn.addEventListener('click', shareSession);
    }
  }
  
  // Save collar settings
  function saveCollarSettings() {
    try {
      const collarToggle = document.getElementById('collar-toggle');
      const collarText = document.getElementById('collar-text');
      
      if (!collarToggle || !collarText) return;
      
      const collarSettings = {
        enabled: collarToggle.checked,
        text: collarText.value
      };
      
      // Save to localStorage
      localStorage.setItem('collarSettings', JSON.stringify(collarSettings));
      
      // Notify the system
      if (window.bambiSystem) {
        window.bambiSystem.updateCollarSettings(collarSettings);
      }
      
      // Dispatch event
      document.dispatchEvent(new CustomEvent('collar-settings-updated', {
        detail: collarSettings
      }));
    } catch (error) {
      console.error('Error saving collar settings:', error);
    }
  }
  
  // Save spiral settings
  function saveSpiralSettings() {
    try {
      const spiralToggle = document.getElementById('spiral-toggle');
      const spiral1Width = document.getElementById('spiral1-width');
      const spiral2Width = document.getElementById('spiral2-width');
      const spiral1Speed = document.getElementById('spiral1-speed');
      const spiral2Speed = document.getElementById('spiral2-speed');
      
      if (!spiralToggle || !spiral1Width || !spiral2Width || !spiral1Speed || !spiral2Speed) return;
      
      const spiralSettings = {
        enabled: spiralToggle.checked,
        spiral1Width: parseFloat(spiral1Width.value),
        spiral2Width: parseFloat(spiral2Width.value),
        spiral1Speed: parseInt(spiral1Speed.value),
        spiral2Speed: parseInt(spiral2Speed.value)
      };
      
      // Save to localStorage
      localStorage.setItem('spiralSettings', JSON.stringify(spiralSettings));
      
      // Notify the system
      if (window.bambiSystem) {
        window.bambiSystem.updateSpiralSettings(spiralSettings);
      }
      
      // Dispatch event
      document.dispatchEvent(new CustomEvent('spiral-settings-updated', {
        detail: spiralSettings
      }));
    } catch (error) {
      console.error('Error saving spiral settings:', error);
    }
  }
  
  // Save current session
  function saveSession() {
    try {
      if (!window.bambiSystem || !window.socket || !window.socket.connected) {
        console.error('Cannot save session: system or socket not available');
        return;
      }
      
      // Collect session settings
      const sessionSettings = window.bambiSystem.collectSettings();
      
      // Add username
      const username = document.body.getAttribute('data-username') || 'anonBambi';
      sessionSettings.username = username;
      
      // Save session to server
      window.socket.emit('client-save-session', sessionSettings, response => {
        if (response && response.success) {
          // Show success message
          alert('Session saved successfully!');
          
          // Refresh session list
          loadSessionList();
        } else {
          alert('Failed to save session. Please try again.');
        }
      });
    } catch (error) {
      console.error('Error saving session:', error);
      alert('An error occurred while saving the session.');
    }
  }
  
  // Load selected session
  function loadSession() {
    try {
      if (!window.bambiSystem || !window.socket || !window.socket.connected) {
        console.error('Cannot load session: system or socket not available');
        return;
      }
      
      // Get selected session
      const selectedSession = document.querySelector('input[name="session-select"]:checked');
      if (!selectedSession) {
        alert('Please select a session to load.');
        return;
      }
      
      const sessionId = selectedSession.value;
      
      // Get session data from server
      window.socket.emit('client-get-session', { sessionId }, response => {
        if (response && response.success && response.session) {
          // Apply session settings
          window.bambiSystem.applySessionSettings(response.session);
          
          // Show success message
          alert('Session loaded successfully!');
          
          // Update UI to reflect loaded settings
          loadSavedSettings();
        } else {
          alert('Failed to load session. Please try again.');
        }
      });
    } catch (error) {
      console.error('Error loading session:', error);
      alert('An error occurred while loading the session.');
    }
  }
  
  // Share session
  function shareSession() {
    try {
      if (!window.bambiSystem || !window.socket || !window.socket.connected) {
        console.error('Cannot share session: system or socket not available');
        return;
      }
      
      // Get selected session
      const selectedSession = document.querySelector('input[name="session-select"]:checked');
      if (!selectedSession) {
        alert('Please select a session to share.');
        return;
      }
      
      const sessionId = selectedSession.value;
      
      // Share session
      window.socket.emit('client-share-session', { sessionId }, response => {
        if (response && response.success && response.shareCode) {
          // Show share code
          const shareCode = response.shareCode;
          prompt('Your session share code (copy this to share):', shareCode);
          
          // Award XP for sharing if available
          if (window.socket) {
            window.socket.emit('client-award-xp', {
              action: 'share-session',
              amount: 50
            });
          }
        } else {
          alert('Failed to share session. Please try again.');
        }
      });
    } catch (error) {
      console.error('Error sharing session:', error);
      alert('An error occurred while sharing the session.');
    }
  }
  
  // Load session list
  function loadSessionList() {
    try {
      if (!window.socket || !window.socket.connected) {
        console.error('Cannot load sessions: socket not available');
        return;
      }
      
      const sessionListEl = document.getElementById('session-list');
      if (!sessionListEl) return;
      
      // Set loading state
      sessionListEl.innerHTML = '<div class="loading-spinner">Loading sessions...</div>';
      
      // Get username
      const username = document.body.getAttribute('data-username') || 'anonBambi';
      
      // Load sessions from server
      window.socket.emit('client-get-sessions', { username }, response => {
        if (response && response.success && Array.isArray(response.sessions)) {
          // Render sessions
          renderSessionList(sessionListEl, response.sessions);
        } else {
          sessionListEl.innerHTML = '<div class="no-sessions">No saved sessions found.</div>';
        }
      });
    } catch (error) {
      console.error('Error loading session list:', error);
    }
  }
  
  // Render session list
  function renderSessionList(container, sessions) {
    if (!container) return;
    
    if (!sessions || sessions.length === 0) {
      container.innerHTML = '<div class="no-sessions">No saved sessions found.</div>';
      return;
    }
    
    container.innerHTML = '';
    
    sessions.forEach(session => {
      const sessionItem = document.createElement('div');
      sessionItem.className = 'session-item';
      
      const sessionDate = new Date(session.createdAt).toLocaleString();
      
      sessionItem.innerHTML = `
        <label class="session-checkbox-label">
          <input type="radio" name="session-select" class="session-checkbox" value="${session._id}">
          <div class="session-info">
            <div class="session-date">${sessionDate}</div>
            <div class="session-msg-count">
              ${session.activeTriggers?.length || 0} active triggers
            </div>
          </div>
        </label>
      `;
      
      container.appendChild(sessionItem);
    });
  }
  
  // Load triggers list
  function loadTriggersList() {
    try {
      const triggersListEl = document.getElementById('triggers-list');
      if (!triggersListEl) return;
      
      // Set loading state
      triggersListEl.innerHTML = '<div class="loading-spinner">Loading triggers...</div>';
      
      if (window.socket && window.socket.connected) {
        // Load triggers from server
        window.socket.emit('client-get-triggers', {}, response => {
          if (response && response.success && Array.isArray(response.triggers)) {
            // Render triggers list
            renderTriggersList(triggersListEl, response.triggers);
          } else {
            triggersListEl.innerHTML = '<div class="error-message">Failed to load triggers.</div>';
          }
        });
      } else if (window.bambiSystem) {
        // Get triggers from bambiSystem
        const triggers = window.bambiSystem.getTriggers();
        renderTriggersList(triggersListEl, triggers);
      } else {
        triggersListEl.innerHTML = '<div class="error-message">Cannot load triggers: system not available</div>';
      }
    } catch (error) {
      console.error('Error loading triggers list:', error);
    }
  }
  
  // Render triggers list
  function renderTriggersList(container, triggers) {
    if (!container) return;
    
    if (!triggers || triggers.length === 0) {
      container.innerHTML = '<div class="no-triggers">No triggers available.</div>';
      return;
    }
    
    // Group triggers by category
    const categories = {};
    triggers.forEach(trigger => {
      const category = trigger.category || 'General';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(trigger);
    });
    
    container.innerHTML = '';
    
    // Create HTML for each category
    Object.entries(categories).forEach(([category, categoryTriggers]) => {
      const categoryEl = document.createElement('div');
      categoryEl.className = 'trigger-category';
      
      const categoryHeader = document.createElement('h4');
      categoryHeader.className = 'category-header';
      categoryHeader.textContent = category;
      
      const triggersList = document.createElement('div');
      triggersList.className = 'category-triggers';
      
      // Create toggle switches for each trigger
      categoryTriggers.forEach(trigger => {
        const triggerName = typeof trigger === 'string' ? trigger : trigger.name;
        
        const triggerItem = document.createElement('div');
        triggerItem.className = 'trigger-item';
        
        const triggerLabel = document.createElement('label');
        triggerLabel.className = 'trigger-label';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'trigger-toggle toggle-input';
        checkbox.setAttribute('data-trigger', triggerName);
        
        // Check if trigger is active
        if (window.bambiSystem) {
          const activeTriggers = window.bambiSystem.getActiveTriggers();
          checkbox.checked = activeTriggers.includes(triggerName);
        }
        
        // Add change event listener
        checkbox.addEventListener('change', function() {
          if (window.bambiSystem) {
            if (this.checked) {
              window.bambiSystem.activateTrigger(triggerName);
            } else {
              window.bambiSystem.deactivateTrigger(triggerName);
            }
          }
        });
        
        const labelText = document.createElement('span');
        labelText.className = 'trigger-name';
        labelText.textContent = triggerName;
        
        triggerLabel.appendChild(checkbox);
        triggerLabel.appendChild(labelText);
        triggerItem.appendChild(triggerLabel);
        triggersList.appendChild(triggerItem);
      });
      
      categoryEl.appendChild(categoryHeader);
      categoryEl.appendChild(triggersList);
      container.appendChild(categoryEl);
    });
  }
  
  // Initialize when the page is ready
  document.addEventListener('DOMContentLoaded', function() {
    // Initialize the UI
    init();
    
    // Load triggers list
    loadTriggersList();
    
    // Load session list if panel exists
    if (document.getElementById('session-panel')) {
      loadSessionList();
    }
  });
  
  // Event listener for system initialization
  document.addEventListener('system-initialized', function() {
    // Reload triggers list when system is initialized
    loadTriggersList();
    
    // Load session list if panel exists
    if (document.getElementById('session-panel')) {
      loadSessionList();
    }
  });
  
  // Public API
  return {
    init: init,
    loadTriggersList: loadTriggersList,
    loadSessionList: loadSessionList,
    renderTriggersList: renderTriggersList,
    renderSessionList: renderSessionList
  };
})();