// Simple collar controls
document.addEventListener('DOMContentLoaded', function() {
  const saveBtn = document.getElementById('save-collar');
  const enableToggle = document.getElementById('collar-enable');
  const textArea = document.getElementById('textarea-collar');
  const msgContainer = document.querySelector('.collar-messages');
  
  // Skip if not on collar page
  if (!saveBtn || !enableToggle || !textArea) return;
  
  // Load saved collar settings
  loadCollarSettings();
  
  // Save button handler
  saveBtn.addEventListener('click', function() {
    const settings = {
      enabled: enableToggle.checked,
      text: textArea.value.trim()
    };
    
    // Save through system
    if (window.bambiSystem?.saveState) {
      window.bambiSystem.saveState('collar', settings);
      showMessage('Collar settings saved!');
      
      // Award XP
      if (window.socket?.connected) {
        window.socket.emit('award-xp', {
          username: document.body.getAttribute('data-username'),
          amount: 15,
          action: 'collar_used'
        });
      }
    } else {
      // Fallback to socket
      if (window.socket?.connected) {
        window.socket.emit('update-system-controls', {
          username: document.body.getAttribute('data-username'),
          collarEnabled: settings.enabled,
          collarText: settings.text
        });
        showMessage('Collar settings saved!');
      }
    }
  });
  
  // Load saved settings
  function loadCollarSettings() {
    if (window.bambiSystem?.state?.collar) {
      const collar = window.bambiSystem.state.collar;
      enableToggle.checked = collar.enabled;
      textArea.value = collar.text || '';
    }
  }
  
  // Show message
  function showMessage(message, isError) {
    if (!msgContainer) return;
    
    const element = document.createElement('div');
    element.className = 'collar-message' + (isError ? ' error' : '');
    element.textContent = message;
    msgContainer.prepend(element);
    
    setTimeout(() => element.remove(), 3000);
  }
});