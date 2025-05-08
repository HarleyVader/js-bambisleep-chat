/**
 * System Controls UI module
 * Responsible for dynamically creating control buttons and panels
 */
window.systemControlUI = (function() {
  // Control definitions - each entry will create a button and panel
  const controls = [
    { id: 'triggers', label: 'Triggers', requiredLevel: 1 },
    { id: 'collar', label: 'Collar', requiredLevel: 2 },
    { id: 'sessions', label: 'Sessions', requiredLevel: 3 },
    { id: 'spirals', label: 'Spirals', requiredLevel: 4 },
    { id: 'hypnosis', label: 'Hypnosis', requiredLevel: 5 },
    { id: 'audio', label: 'Audio', requiredLevel: 6 },
    { id: 'binaurals', label: 'Binaurals', requiredLevel: 7 }
  ];
  
  let activeTab = null;
  let userLevel = 0;
  
  // DOM references for cleanup
  const elements = [];
  
  // Initialize the module
  function init() {
    try {
      console.log('System Controls UI initialized');
      
      // Handle system initialization event
      document.addEventListener('system-initialized', handleSystemInit);
      
      // Set up tab switching
      setupTabSwitching();
      
      // Set initial user level
      updateUserLevel();
    } catch (error) {
      console.error('Error initializing system controls UI:', error);
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
      
      // Update UI based on level
      updateControlAvailability();
    } catch (error) {
      console.error('Error updating user level:', error);
    }
  }
  
  // Handle system initialization
  function handleSystemInit() {
    try {
      // Update user level
      updateUserLevel();
      
      // Create controls if they don't exist
      const buttonsContainer = document.getElementById('buttons');
      if (buttonsContainer && buttonsContainer.children.length === 0) {
        createControls();
      }
      
      // Activate default tab
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
      
      // Event delegation for tab switching
      container.addEventListener('click', function(event) {
        const button = event.target.closest('.control-btn');
        if (!button) return;
        
        // Skip if button is disabled
        if (button.classList.contains('disabled')) return;
        
        const targetId = button.getAttribute('data-target');
        if (targetId) {
          switchToTab(targetId);
          
          // Save active tab preference
          try {
            localStorage.setItem('bambiActiveTab', targetId);
          } catch (e) {
            console.error('Error saving active tab to storage:', e);
          }
        }
      });
      
      // Add to elements for cleanup
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
      
      // Update active tab
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
      
      // Clear existing content
      buttonsContainer.innerHTML = '';
      panelsContainer.innerHTML = '';
      
      // Create fragment to batch DOM operations
      const buttonFragment = document.createDocumentFragment();
      const panelFragment = document.createDocumentFragment();
      
      // Create buttons and panels for each control
      controls.forEach(control => {
        // Create button
        const button = document.createElement('button');
        button.id = `${control.id}-button`;
        button.className = 'control-btn';
        button.setAttribute('data-target', `${control.id}-panel`);
        button.setAttribute('data-level-required', control.requiredLevel);
        button.textContent = control.label;
        
        // Add lock icon if level-restricted
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
          default:
            panel.innerHTML = `<p>Content for ${control.label}</p>`;
        }
        
        // Add to fragments
        buttonFragment.appendChild(button);
        panelFragment.appendChild(panel);
      });
      
      // Append fragments to containers
      buttonsContainer.appendChild(buttonFragment);
      panelsContainer.appendChild(panelFragment);
      
      // Set up panel-specific functionality
      initializePanelFunctionality();
    } catch (error) {
      console.error('Error creating controls:', error);
    }
  }
  
  // Initialize panel-specific functionality
  function initializePanelFunctionality() {
    try {
      // Collar panel
      const collarEnable = document.getElementById('collar-enable');
      const collarText = document.getElementById('collar-text');
      const saveCollar = document.getElementById('save-collar');
      
      if (collarEnable && collarText && saveCollar) {
        // Load current settings
        if (window.bambiSystem) {
          const collarSettings = window.bambiSystem.getState('collar') || {};
          collarEnable.checked = collarSettings.enabled || false;
          collarText.value = collarSettings.text || '';
        }
        
        // Save settings handler
        saveCollar.addEventListener('click', function() {
          const settings = {
            enabled: collarEnable.checked,
            text: collarText.value
          };
          
          // Save to central state
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
        
        // Add to elements for cleanup
        elements.push(saveCollar);
      }
      
      // Spirals panel
      const spiralEnable = document.getElementById('spiral-enable');
      const saveSpirals = document.getElementById('save-spirals');
      
      if (spiralEnable && saveSpirals) {
        // Load current settings
        if (window.bambiSystem) {
          const spiralSettings = window.bambiSystem.getState('spirals') || {};
          spiralEnable.checked = spiralSettings.enabled || false;
          
          // Update range inputs
          document.getElementById('spiral1-width')?.setAttribute('value', spiralSettings.spiral1Width || 5);
          document.getElementById('spiral2-width')?.setAttribute('value', spiralSettings.spiral2Width || 3);
          document.getElementById('spiral1-speed')?.setAttribute('value', spiralSettings.spiral1Speed || 20);
          document.getElementById('spiral2-speed')?.setAttribute('value', spiralSettings.spiral2Speed || 15);
        }
        
        // Save settings handler
        saveSpirals.addEventListener('click', function() {
          const settings = {
            enabled: spiralEnable.checked,
            spiral1Width: parseFloat(document.getElementById('spiral1-width')?.value || 5),
            spiral2Width: parseFloat(document.getElementById('spiral2-width')?.value || 3),
            spiral1Speed: parseInt(document.getElementById('spiral1-speed')?.value || 20),
            spiral2Speed: parseInt(document.getElementById('spiral2-speed')?.value || 15)
          };
          
          // Save to central state
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
        
        // Add to elements for cleanup
        elements.push(saveSpirals);
      }
    } catch (error) {
      console.error('Error initializing panel functionality:', error);
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
            </div>
            <div class="setting-group">
              <label for="spiral2-width">Spiral 2 Width</label>
              <input type="range" id="spiral2-width" min="1" max="10" value="3">
            </div>
            <div class="setting-group">
              <label for="spiral1-speed">Spiral 1 Speed</label>
              <input type="range" id="spiral1-speed" min="1" max="50" value="20">
            </div>
            <div class="setting-group">
              <label for="spiral2-speed">Spiral 2 Speed</label>
              <input type="range" id="spiral2-speed" min="1" max="50" value="15">
            </div>
          </div>
          <button id="save-spirals" class="action-button">Save Spiral Settings</button>
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
          // Add lock icon if not present
          if (!button.textContent.includes('🔒')) {
            button.textContent = button.textContent + ' 🔒';
          }
          button.title = `Unlock at Level ${control.requiredLevel}`;
        } else {
          button.classList.remove('disabled');
          // Remove lock icon if present
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
      
      // Clean up other event listeners
      elements.forEach(el => {
        if (el.parentNode) {
          // This is a bit aggressive but ensures cleanup
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