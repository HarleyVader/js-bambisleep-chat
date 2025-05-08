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

  // Initialize the module
  function init() {
    try {
      // Create control buttons and panels
      createControls();
      
      // Listen for system initialization
      document.addEventListener('system-initialized', handleSystemInit);
      
      console.log('System Controls UI initialized');
    } catch (error) {
      console.error('Error initializing System Controls UI:', error);
    }
  }
  
  // Handle system initialization
  function handleSystemInit() {
    try {
      // Get user level
      let userLevel = 0;
      if (window.bambiSystem) {
        userLevel = window.bambiSystem.getUserLevel();
      } else {
        userLevel = parseInt(document.body.getAttribute('data-level') || '0');
      }
      
      // Update control availability based on user level
      updateControlAvailability(userLevel);
      
      // Activate default tab
      activateDefaultTab();
    } catch (error) {
      console.error('Error handling system initialization:', error);
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
      
      // Create buttons and panels for each control
      controls.forEach(control => {
        // Create button
        const button = createControlButton(control);
        buttonsContainer.appendChild(button);
        
        // Create panel
        const panel = createControlPanel(control);
        panelsContainer.appendChild(panel);
      });
    } catch (error) {
      console.error('Error creating controls:', error);
    }
  }
  
  // Create a control button
  function createControlButton(control) {
    const button = document.createElement('button');
    button.id = `${control.id}-button`;
    button.className = 'control-btn';
    button.setAttribute('data-target', `${control.id}-panel`);
    button.textContent = control.label;
    
    // Add lock icon if feature is level-restricted
    if (control.requiredLevel > 0) {
      button.setAttribute('data-level-required', control.requiredLevel);
      button.setAttribute('title', `Reach Level ${control.requiredLevel} to unlock`);
    }
    
    return button;
  }
  
  // Create a control panel
  function createControlPanel(control) {
    const panel = document.createElement('div');
    panel.id = `${control.id}-panel`;
    panel.className = 'control-panel';
    
    // Add default content based on control type
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
        panel.innerHTML = `<div class="panel-content"><p>Content for ${control.label} panel</p></div>`;
    }
    
    return panel;
  }
  
  // Create triggers panel content
  function createTriggersPanel() {
    return `
      <div class="panel-content">
        <h3>Bambi Triggers</h3>
        <div class="triggers-container" id="triggers-container">
          <div class="loading-indicators">Loading triggers...</div>
        </div>
        <div class="trigger-settings">
          <div class="setting-group">
            <label for="trigger-loop">Loop Triggers:</label>
            <input type="checkbox" id="trigger-loop" class="toggle-input">
          </div>
          <div class="setting-group">
            <label for="trigger-volume">Volume:</label>
            <input type="range" id="trigger-volume" min="0" max="10" value="7">
            <span id="volume-value">70%</span>
          </div>
          <div class="setting-group">
            <label for="trigger-speed">Playback Speed:</label>
            <input type="range" id="trigger-speed" min="1" max="10" value="5">
            <span id="speed-value">Normal</span>
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
            <label for="collar-enable">Enable Collar:</label>
            <input type="checkbox" id="collar-enable" class="toggle-input">
          </div>
          <div class="setting-group">
            <label for="collar-text">Collar Text:</label>
            <input type="text" id="collar-text" placeholder="Enter text to display on collar">
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
            <input type="text" id="session-name-input" placeholder="Session Name">
            <button id="save-session-btn" class="action-button">Save Current Session</button>
          </div>
          <div class="session-load">
            <button id="load-session-btn" class="action-button">Load Session</button>
          </div>
          <div id="sessions-list" class="sessions-list"></div>
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
            <label for="spiral-enable">Enable Spirals:</label>
            <input type="checkbox" id="spiral-enable" class="toggle-input">
          </div>
          <div class="spiral-controls">
            <div class="setting-group">
              <label for="spiral1-width">Spiral 1 Width:</label>
              <input type="range" id="spiral1-width" min="1" max="10" value="5">
              <span id="spiral1-width-value">5.0</span>
            </div>
            <div class="setting-group">
              <label for="spiral2-width">Spiral 2 Width:</label>
              <input type="range" id="spiral2-width" min="1" max="10" value="3">
              <span id="spiral2-width-value">3.0</span>
            </div>
            <div class="setting-group">
              <label for="spiral1-speed">Spiral 1 Speed:</label>
              <input type="range" id="spiral1-speed" min="1" max="50" value="20">
              <span id="spiral1-speed-value">20</span>
            </div>
            <div class="setting-group">
              <label for="spiral2-speed">Spiral 2 Speed:</label>
              <input type="range" id="spiral2-speed" min="1" max="50" value="15">
              <span id="spiral2-speed-value">15</span>
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
        <div class="hypnosis-files">
          <p>Hypnosis features will unlock at higher levels.</p>
          <div class="file-list" id="hypnosis-file-list">
            <div class="loading-indicators">Loading hypnosis files...</div>
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
            <label for="master-volume">Master Volume:</label>
            <input type="range" id="master-volume" min="0" max="100" value="70">
            <span id="master-volume-value">70%</span>
          </div>
          <div class="setting-group">
            <label for="sound-toggle">Sound Effects:</label>
            <input type="checkbox" id="sound-toggle" class="toggle-input" checked>
          </div>
          <div class="setting-group">
            <label for="voice-toggle">Voice Recognition:</label>
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
        <div class="binaural-controls">
          <div class="binaural-buttons">
            <button class="binaural-btn" data-wave="delta">Delta (0.5-4Hz)</button>
            <button class="binaural-btn" data-wave="theta">Theta (4-8Hz)</button>
            <button class="binaural-btn" data-wave="alpha">Alpha (8-13Hz)</button>
            <button class="binaural-btn" data-wave="beta">Beta (13-30Hz)</button>
            <button class="binaural-btn" data-wave="gamma">Gamma (30-100Hz)</button>
            <button class="binaural-btn" data-wave="stop">Stop</button>
          </div>
          <div class="binaural-status">
            <p>Active wave: <span id="active-wave-display">None</span></p>
          </div>
          <div class="setting-group">
            <label for="binaurals-volume">Volume:</label>
            <input type="range" id="binaurals-volume" min="0" max="100" value="50">
            <span id="binaurals-volume-value">50%</span>
          </div>
        </div>
      </div>
    `;
  }
  
  // Update control availability based on user level
  function updateControlAvailability(userLevel) {
    controls.forEach(control => {
      const button = document.getElementById(`${control.id}-button`);
      if (!button) return;
      
      if (userLevel < control.requiredLevel) {
        button.classList.add('disabled');
        // Add lock icon if not present
        if (!button.textContent.includes('🔒')) {
          button.textContent = button.textContent + ' 🔒';
        }
      } else {
        button.classList.remove('disabled');
        // Remove lock icon if present
        button.textContent = button.textContent.replace(' 🔒', '');
      }
    });
  }
  
  // Activate default tab
  function activateDefaultTab() {
    try {
      // Try to restore from localStorage first
      let activeTab = null;
      try {
        activeTab = localStorage.getItem('bambiActiveTab');
      } catch (e) {
        console.error('Error reading active tab from storage:', e);
      }
      
      // Get user level to determine default tab
      let userLevel = 0;
      if (window.bambiSystem) {
        userLevel = window.bambiSystem.getUserLevel();
      } else {
        userLevel = parseInt(document.body.getAttribute('data-level') || '0');
      }
      
      // Find available buttons based on level
      const availableButtons = controls
        .filter(control => control.requiredLevel <= userLevel)
        .map(control => document.getElementById(`${control.id}-button`))
        .filter(button => button && !button.classList.contains('disabled'));
      
      // If active tab exists and is available, click it
      if (activeTab) {
        const button = document.querySelector(`.control-btn[data-target="${activeTab}"]`);
        if (button && !button.classList.contains('disabled')) {
          button.click();
          return;
        }
      }
      
      // Otherwise click first available button
      if (availableButtons.length > 0) {
        availableButtons[0].click();
      }
    } catch (error) {
      console.error('Error activating default tab:', error);
    }
  }
  
  // Clean up
  function destroy() {
    document.removeEventListener('system-initialized', handleSystemInit);
  }
  
  // Public API
  return {
    init,
    destroy,
    createControls
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.systemControlUI.init);