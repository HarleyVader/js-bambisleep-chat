// Main system controls module to initialize all components

(function() {
  // Initialize all system controls
  function init() {
    initTabSystem();
    loadControlModules();
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
    // Check and initialize modules
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
  
  // Export functions
  window.bambiSystemControls = {
    init
  };
  
  // Auto-initialize on load
  document.addEventListener('DOMContentLoaded', init);
})();