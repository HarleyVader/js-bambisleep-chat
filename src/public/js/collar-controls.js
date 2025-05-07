// Collar controls module for managing collar settings

(function () {
  // Initialize collar controls
  function init() {
    const saveCollarBtn = document.getElementById('save-collar');

    if (saveCollarBtn) {
      saveCollarBtn.addEventListener('click', function () {
        saveCollarSettings();

        // Award XP for using the collar (+15 XP)
        if (typeof socket !== 'undefined' && socket.connected) {
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
    const collarEnable = document.getElementById('collar-enable');
    const textareaCollar = document.getElementById('textarea-collar');

    const collarEnabled = collarEnable && collarEnable.checked;
    const collarText = textareaCollar ? textareaCollar.value.trim() : '';

    // Use centralized state management
    if (window.bambiSystem) {
      window.bambiSystem.saveState('collar', {
        enabled: collarEnabled,
        text: collarText
      });
      showCollarMessage('Collar settings saved!');
    } else {
      // Fallback to old method
      const username = document.body.getAttribute('data-username') || window.username;

      if (typeof socket !== 'undefined' && socket.connected) {
        socket.emit('update-system-controls', {
          username: username,
          collarEnabled: collarEnabled,
          collarText: collarText
        });

        showCollarMessage('Collar settings saved!');
      }
    }
  }

  // Show collar status message
  function showCollarMessage(message, isError = false) {
    const messagesContainer = document.querySelector('.collar-messages');
    if (!messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = 'collar-message' + (isError ? ' error' : '');
    messageElement.textContent = message;

    messagesContainer.prepend(messageElement);

    setTimeout(() => {
      messageElement.style.opacity = '0';
      setTimeout(() => {
        messagesContainer.removeChild(messageElement);
      }, 300);
    }, 5000);
  }

  // Export functions
  window.bambiCollar = {
    init,
    saveCollarSettings,
    showCollarMessage
  };

  // Auto-initialize on load
  document.addEventListener('DOMContentLoaded', init);
})();