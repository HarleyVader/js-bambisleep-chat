// system-controls.js - Wrapper for bambi system controls
// This file imports functionality from controls/system.js for backward compatibility

// Initialize system controls when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Check if bambiSystem is available from the controls module
  if (window.bambiSystem) {
    // Initialize the system
    window.bambiSystem.init();
    
    console.log('System controls initialized via system-controls.js wrapper');
  } else {
    console.error('Error: bambiSystem not found. Make sure controls/system.js is loaded first.');
    
    // Load the original system.js if not already loaded
    const script = document.createElement('script');
    script.src = '/js/controls/system.js';
    script.onload = function() {
      if (window.bambiSystem) {
        window.bambiSystem.init();
        console.log('System controls loaded and initialized dynamically');
      } else {
        console.error('Failed to load system controls');
      }
    };
    document.head.appendChild(script);
  }
});
