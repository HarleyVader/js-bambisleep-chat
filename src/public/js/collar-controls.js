// Collar controls module
(function () {
  function init() {
    const saveCollarBtn = document.getElementById('save-collar');
    
    if (saveCollarBtn) {
      saveCollarBtn.addEventListener('click', function () {
        saveCollarSettings();
        
        // Award XP for using the collar
        if (socket && socket.connected) {
          socket.emit('award-xp', {
            username: document.body.getAttribute('data-username') || window.username,
            amount: 15,
            action: 'collar_used'
          });
        }
      });
    }
  }

  function saveCollarSettings() {
    const enable = document.getElementById('collar-enable');
    const textarea = document.getElementById('textarea-collar');

    const enabled = enable && enable.checked;
    const text = textarea ? textarea.value.trim() : '';

    // Use centralized state management
    if (window.bambiSystem) {
      window.bambiSystem.saveState('collar', { enabled, text });
      showCollarMessage('Collar settings saved!');
    } else {
      // Fallback to old method
      const username = document.body.getAttribute('data-username') || window.username;

      if (socket && socket.connected) {
        socket.emit('update-system-controls', {
          username,
          collarEnabled: enabled,
          collarText: text
        });
        showCollarMessage('Collar settings saved!');
      }
    }
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
    setTimeout(() => element.remove(), 3000);
  }

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', init);
})();