// Main system controls module to initialize all components

(function() {
  // Initialize all system controls
  function init() {
    initTabSystem();
    loadControlModules();
    
    // Dispatch event when system controls are fully loaded
    document.dispatchEvent(new CustomEvent('system-controls-loaded'));
  }
  
  // Initialize tab system
  function initTabSystem() {
    const controlButtons = document.querySelectorAll('.control-btn:not(.disabled)');
    
    controlButtons.forEach(button => {
      button.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target');
        
        // Remove active class from all buttons
        controlButtons.forEach(btn => btn.classList.remove('active'));
        
        // Hide all panels
        document.querySelectorAll('.control-panel').forEach(panel => {
          panel.classList.remove('active');
        });
        
        // Add active class to clicked button
        this.classList.add('active');
        
        // Show target panel
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) targetPanel.classList.add('active');
      });
    });
  }
  
  // Load required modules
  function loadControlModules() {
    // Initialize modules in proper order
    if (window.bambiTriggers) {
      window.bambiTriggers.init();
    }
    
    if (window.bambiCollar) {
      window.bambiCollar.init();
    }
    
    if (window.bambiHistory) {
      window.bambiHistory.init();
    }
    
    if (window.bambiSpirals) {
      window.bambiSpirals.init();
    }
  }
  
  // Send active triggers to server
  function sendActiveTriggersToServer() {
    const triggerToggles = document.querySelectorAll('.toggle-input:checked');
    if (!triggerToggles.length) return;
    
    const activeTriggers = Array.from(triggerToggles).map(toggle => {
      return {
        name: toggle.getAttribute('data-trigger'),
        description: toggle.getAttribute('data-description') || ''
      };
    }).filter(t => t.name);
    
    if (activeTriggers.length && window.socket) {
      window.socket.emit('triggers', {
        triggerNames: activeTriggers.map(t => t.name).join(','),
        triggerDetails: activeTriggers
      });
    }
  }
  
  // Export functions
  window.bambiSystemControls = {
    init,
    sendActiveTriggersToServer
  };
  
  // Auto-initialize on load
  document.addEventListener('DOMContentLoaded', init);
})();