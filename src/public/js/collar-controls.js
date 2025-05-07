/**
 * Collar controls module for BambiSleep Chat
 * Manages collar settings and XP rewards
 */
window.collarControls = (function() {
  // Private variables
  let collarEnabled = false;
  let collarText = '';
  let userXp = 0;
  
  // Init module
  function init() {
    setupEventListeners();
    loadInitialState();
  }
  
  // Set up event listeners
  function setupEventListeners() {
    // Collar save button
    const saveCollarBtn = document.getElementById('save-collar');
    if (saveCollarBtn) saveCollarBtn.addEventListener('click', saveCollarSettings);
    
    // Collar enable toggle
    const collarEnableToggle = document.getElementById('collar-enable');
    if (collarEnableToggle) collarEnableToggle.addEventListener('change', updateCollarToggle);
    
    // Listen for system state changes
    document.addEventListener('system-update', handleSystemUpdate);
  }
  
  // Clean up event listeners to prevent memory leaks
  function tearDown() {
    const saveCollarBtn = document.getElementById('save-collar');
    if (saveCollarBtn) saveCollarBtn.removeEventListener('click', saveCollarSettings);
    
    const collarEnableToggle = document.getElementById('collar-enable');
    if (collarEnableToggle) collarEnableToggle.removeEventListener('change', updateCollarToggle);
    
    document.removeEventListener('system-update', handleSystemUpdate);
  }
  
  // Load initial state from central system
  function loadInitialState() {
    if (window.bambiSystem && typeof window.bambiSystem.collectSettings === 'function') {
      const settings = window.bambiSystem.collectSettings();
      if (settings && settings.collarSettings) {
        collarEnabled = settings.collarSettings.enabled || false;
        collarText = settings.collarSettings.text || '';
        updateCollarUI();
      }
    }
  }
  
  // Handle system state updates
  function handleSystemUpdate(event) {
    // Only update if it's a collar update
    if (event.detail && (event.detail.section === 'collar' || event.detail.section === 'all')) {
      if (window.bambiSystem && typeof window.bambiSystem.collectSettings === 'function') {
        const settings = window.bambiSystem.collectSettings();
        if (settings && settings.collarSettings) {
          collarEnabled = settings.collarSettings.enabled || false;
          collarText = settings.collarSettings.text || '';
          updateCollarUI();
        }
      }
    }
  }
  
  // Update the collar toggle UI based on state
  function updateCollarToggle() {
    const toggle = document.getElementById('collar-enable');
    if (toggle) {
      collarEnabled = toggle.checked;
    }
  }
  
  // Save collar settings
  function saveCollarSettings() {
    try {
      const enable = document.getElementById('collar-enable');
      const textarea = document.getElementById('textarea-collar');
      
      collarEnabled = enable ? enable.checked : false;
      collarText = textarea ? textarea.value.trim() : '';
      
      // Use centralized state management
      if (window.bambiSystem && typeof window.bambiSystem.saveState === 'function') {
        window.bambiSystem.saveState('collar', { 
          enabled: collarEnabled, 
          text: collarText 
        });
        
        showCollarMessage('Collar settings saved!');
        
        // Update server for socket clients
        if (window.socket && window.socket.connected) {
          window.socket.emit('collar', { 
            data: collarText,
            enabled: collarEnabled 
          });
        }
        
        // Award XP for using the collar
        awardCollarXp();
      } else {
        // Fallback to direct socket emission
        const username = document.body.getAttribute('data-username') || window.username;
        
        if (window.socket && window.socket.connected) {
          window.socket.emit('update-system-controls', {
            username,
            collarEnabled,
            collarText
          });
          
          if (collarEnabled) {
            window.socket.emit('collar', { data: collarText });
          }
          
          showCollarMessage('Collar settings saved!');
          awardCollarXp();
        }
      }
    } catch (error) {
      console.error('Error saving collar settings:', error);
      showCollarMessage('Error saving collar settings', true);
    }
  }
  
  // Award XP for collar usage
  function awardCollarXp() {
    const username = document.body.getAttribute('data-username') || window.username;
    
    if (!username || username === 'anonBambi' || !window.socket) {
      return;
    }
    
    // Award different amounts based on action
    let amount = 5; // Base amount
    let action = 'collar_updated';
    
    if (collarEnabled) {
      // More XP for enabling the collar
      amount = 10;
      action = 'collar_enabled';
      
      // Bonus for custom text
      if (collarText && collarText.length > 10) {
        amount += 5;
      }
    }
    
    // Send XP award event
    window.socket.emit('award-xp', {
      username: username,
      amount: amount,
      action: action
    });
    
    // Show notification if function exists
    if (typeof showXPNotification === 'function') {
      showXPNotification(amount);
    }
  }
  
  // Update the collar UI elements
  function updateCollarUI() {
    const enable = document.getElementById('collar-enable');
    const textarea = document.getElementById('textarea-collar');
    
    if (enable) enable.checked = collarEnabled;
    if (textarea) textarea.value = collarText;
  }
  
  // Show collar status message
  function showCollarMessage(message, isError) {
    const container = document.querySelector('.collar-messages');
    if (!container) return;
    
    const element = document.createElement('div');
    element.className = 'collar-message' + (isError ? ' error' : '');
    element.textContent = message;
    container.prepend(element);
    
    // Remove message after 3s
    setTimeout(() => {
      try {
        if (element && element.parentNode) {
          element.parentNode.removeChild(element);
        }
      } catch (e) {
        console.error('Error removing message element', e);
      }
    }, 3000);
  }
  
  // Refresh collar state based on current DOM values
  function refreshCollar() {
    updateCollarToggle();
    
    const textarea = document.getElementById('textarea-collar');
    if (textarea) {
      collarText = textarea.value.trim();
    }
  }
  
  // Public API
  return {
    init,
    tearDown,
    saveCollarSettings,
    showCollarMessage,
    refreshCollar
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.collarControls.init);