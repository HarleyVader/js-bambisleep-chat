/**
 * Collar system module for BambiSleep Chat
 * Manages collar settings and effects
 */
window.collarSystem = (function() {
  // Private variables
  let collarEnabled = false;
  let collarText = '';
  
  // Initialize module
  function init() {
    setupEventListeners();
    loadInitialState();
  }
  
  // Set up event listeners
  function setupEventListeners() {
    // Save button
    const saveBtn = document.getElementById('save-collar');
    if (saveBtn) saveBtn.addEventListener('click', saveCollarSettings);
    
    // Toggle checkbox
    const collarToggle = document.getElementById('collar-enable');
    if (collarToggle) collarToggle.addEventListener('change', updateCollarToggle);
    
    // Listen for system updates
    document.addEventListener('system-update', handleSystemUpdate);
  }
  
  // Clean up event listeners
  function tearDown() {
    const saveBtn = document.getElementById('save-collar');
    if (saveBtn) saveBtn.removeEventListener('click', saveCollarSettings);
    
    const collarToggle = document.getElementById('collar-enable');
    if (collarToggle) collarToggle.removeEventListener('change', updateCollarToggle);
    
    document.removeEventListener('system-update', handleSystemUpdate);
  }
  
  // Load initial state
  function loadInitialState() {
    if (window.bambiSystem) {
      const collarState = window.bambiSystem.getState('collar');
      if (collarState) {
        collarEnabled = collarState.enabled || false;
        collarText = collarState.text || '';
        updateCollarUI();
      }
    }
  }
  
  // Handle system state update
  function handleSystemUpdate(event) {
    if (event.detail && (event.detail.section === 'collar' || event.detail.section === 'all')) {
      loadInitialState();
    }
  }
  
  // Update collar toggle state
  function updateCollarToggle() {
    const toggle = document.getElementById('collar-enable');
    if (toggle) {
      collarEnabled = toggle.checked;
    }
  }
  
  // Save collar settings
  function saveCollarSettings() {
    try {
      // Get values from UI
      const toggle = document.getElementById('collar-enable');
      const textarea = document.getElementById('textarea-collar');
      
      collarEnabled = toggle ? toggle.checked : false;
      collarText = textarea ? textarea.value.trim() : '';
      
      // Save to central state
      if (window.bambiSystem) {
        window.bambiSystem.saveState('collar', {
          enabled: collarEnabled,
          text: collarText
        });
      }
      
      // Send to server
      if (window.socket && window.socket.connected) {
        window.socket.emit('collar', {
          data: collarText,
          enabled: collarEnabled
        });
      }
      
      // Show success message
      showCollarMessage('Collar settings saved!');
      
      // Award XP
      awardCollarXp();
    } catch (error) {
      console.error('Error saving collar settings:', error);
      showCollarMessage('Error saving collar settings', true);
    }
  }
  
  // Award XP for collar usage
  function awardCollarXp() {
    if (!window.socket || !window.socket.connected) return;
    
    // Different XP based on collar state
    let amount = 5; // Base amount
    let action = 'collar_updated';
    
    if (collarEnabled) {
      // More XP for enabling
      amount = 10;
      action = 'collar_enabled';
      
      // Bonus for custom text
      if (collarText && collarText.length > 10) {
        amount += 5;
      }
    }
    
    // Use xpSystem if available
    if (window.xpSystem && typeof window.xpSystem.awardXp === 'function') {
      window.xpSystem.awardXp(action, amount);
    } else {
      // Fallback to direct socket emission
      window.socket.emit('client-award-xp', {
        action,
        amount,
        timestamp: Date.now()
      });
    }
  }
  
  // Update UI with current state
  function updateCollarUI() {
    const toggle = document.getElementById('collar-enable');
    const textarea = document.getElementById('textarea-collar');
    
    if (toggle) toggle.checked = collarEnabled;
    if (textarea) textarea.value = collarText;
  }
  
  // Show collar message
  function showCollarMessage(message, isError) {
    const container = document.querySelector('.collar-messages');
    if (!container) return;
    
    const element = document.createElement('div');
    element.className = 'collar-message' + (isError ? ' error' : '');
    element.textContent = message;
    container.prepend(element);
    
    // Remove message after 3s
    setTimeout(() => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }, 3000);
  }
  
  // Get current collar state
  function getCollarState() {
    return {
      enabled: collarEnabled,
      text: collarText
    };
  }
  
  // Public API
  return {
    init,
    tearDown,
    saveCollarSettings,
    getCollarState,
    showCollarMessage
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.collarSystem.init);

// For backward compatibility
window.collarControls = window.collarSystem;