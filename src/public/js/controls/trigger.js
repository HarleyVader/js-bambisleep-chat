// Simple trigger control system
document.addEventListener('DOMContentLoaded', function() {
  // Core elements
  const triggerList = document.getElementById('trigger-list');
  const selectAll = document.getElementById('select-all-triggers');
  const clearAll = document.getElementById('clear-all-triggers');
  
  // Skip if no trigger list exists
  if (!triggerList) return;
  
  // Initialize
  function init() {
    setupToggleListeners();
    setupActionButtons();
    loadSavedTriggers();
    
    // Notify system when ready
    document.dispatchEvent(new Event('trigger-controls-loaded'));
  }
  
  // Set up toggle listeners
  function setupToggleListeners() {
    document.querySelectorAll('.toggle-input').forEach(toggle => {
      toggle.addEventListener('change', function() {
        saveTriggerState();
        
        // Award XP when enabling a trigger
        if (this.checked && window.socket?.connected) {
          window.socket.emit('award-xp', {
            username: document.body.getAttribute('data-username'),
            amount: 3,
            action: 'trigger_used'
          });
        }
      });
    });
  }
  
  // Set up action buttons
  function setupActionButtons() {
    if (selectAll) {
      selectAll.addEventListener('click', function() {
        document.querySelectorAll('.toggle-input').forEach(t => t.checked = true);
        saveTriggerState();
      });
    }
    
    if (clearAll) {
      clearAll.addEventListener('click', function() {
        document.querySelectorAll('.toggle-input').forEach(t => t.checked = false);
        saveTriggerState();
      });
    }
  }
  
  // Load saved triggers
  function loadSavedTriggers() {
    // Get triggers from system state
    let triggers = [];
    
    if (window.bambiSystem?.state?.triggers) {
      triggers = window.bambiSystem.state.triggers;
    } else {
      // Fallback to localStorage
      try {
        const saved = localStorage.getItem('bambiActiveTriggers');
        if (saved) triggers = JSON.parse(saved);
      } catch (e) {
        console.error('Error loading triggers', e);
      }
    }
    
    // Apply to UI
    if (triggers.length > 0) {
      document.querySelectorAll('.toggle-input').forEach(toggle => {
        const name = toggle.getAttribute('data-trigger');
        if (name) {
          // Check if trigger name exists in the array
          const found = triggers.find(t => 
            (typeof t === 'string' && t === name) || 
            (t.name === name)
          );
          
          if (found) toggle.checked = true;
        }
      });
    }
  }
  
  // Save trigger state
  function saveTriggerState() {
    // Get all checked triggers
    const triggers = [];
    document.querySelectorAll('.toggle-input:checked').forEach(toggle => {
      const name = toggle.getAttribute('data-trigger');
      const desc = toggle.getAttribute('data-description') || 'Trigger effect';
      
      if (name) triggers.push({name, description: desc});
    });
    
    // Save with system if available
    if (window.bambiSystem?.saveState) {
      window.bambiSystem.saveState('triggers', {triggers});
    } else {
      // Fallback to localStorage
      localStorage.setItem('bambiActiveTriggers', JSON.stringify(
        triggers.map(t => t.name)
      ));
    }
    
    // Send to server
    if (window.socket?.connected) {
      const username = document.body.getAttribute('data-username');
      if (username) {
        window.socket.emit('triggers', {
          triggerNames: triggers.map(t => t.name).join(','),
          triggerDetails: triggers,
          username: username
        });
      }
    }
  }
  
  // Start initialization
  init();
});