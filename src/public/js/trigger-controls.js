// Trigger controls module
(function () {
  // Initialize trigger controls
  function init() {
    setupToggleListeners();
    setupActionButtons();
    loadSavedTriggers();

    // Notify system that trigger controls are ready
    document.dispatchEvent(new Event('trigger-controls-loaded'));
  }

  // Set up trigger toggle listeners
  function setupToggleListeners() {
    const toggles = document.querySelectorAll('.toggle-input');

    toggles.forEach(toggle => {
      toggle.addEventListener('change', function () {
        saveTriggerState();

        // Award XP when enabling a trigger
        if (this.checked && window.socket && window.socket.connected) {
          window.socket.emit('award-xp', {
            username: document.body.getAttribute('data-username'),
            amount: 3,
            action: 'trigger_used'
          });
        }
      });
    });
  }

  // Set up action buttons (select all, clear all)
  function setupActionButtons() {
    const selectAll = document.getElementById('select-all-triggers');
    const clearAll = document.getElementById('clear-all-triggers');

    if (selectAll) {
      selectAll.addEventListener('click', function () {
        document.querySelectorAll('.toggle-input').forEach(t => t.checked = true);
        saveTriggerState();
      });
    }

    if (clearAll) {
      clearAll.addEventListener('click', function () {
        document.querySelectorAll('.toggle-input').forEach(t => t.checked = false);
        saveTriggerState();
      });
    }
  }

  // Load saved triggers
  function loadSavedTriggers() {
    let triggers = [];

    // Try loading from bambiSystem first
    if (window.bambiSystem) {
      const settings = window.bambiSystem.collectSettings ? window.bambiSystem.collectSettings() : null;
      if (settings && settings.activeTriggers) {
        triggers = settings.activeTriggers;
      }
    }

    // Fallback to localStorage
    if (!triggers.length) {
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
        if (name && triggers.includes(name)) {
          toggle.checked = true;
        }
      });
    }
  }

    // Save trigger state
    function saveTriggerState() {
      // Get active triggers
      const triggers = [];
      document.querySelectorAll('.toggle-input:checked').forEach(toggle => {
        const name = toggle.getAttribute('data-trigger');
        const desc = toggle.getAttribute('data-description') || 'Trigger effect';
  
        if (name) triggers.push({ name, description: desc });
      });
  
      // Save with centralized system if available
      if (window.bambiSystem && typeof window.bambiSystem.saveState === 'function') {
        window.bambiSystem.saveState('triggers', { triggers });
      } else {
        // Fallback to localStorage
        localStorage.setItem('bambiActiveTriggers', JSON.stringify(triggers.map(t => t.name)));
      }
  
      // Always send to server to ensure backend gets updated
      if (window.socket && window.socket.connected) {
        const username = document.body.getAttribute('data-username');
        if (username) {
          // Single standardized socket emission for triggers
          // This format matches what the worker and system expect
          window.socket.emit('triggers', {
            triggerNames: triggers.map(t => t.name).join(','),
            triggerDetails: triggers,
            username: username
          });
        }
      }
    }

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', init);
})();