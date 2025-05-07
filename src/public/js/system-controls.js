// Main system controls module to initialize all components

(function() {
  // Initialize all system controls
  function init() {
    initTabSystem();
    
    // Initialize module components if they exist
    if (window.bambiXPProgress && typeof window.bambiXPProgress.init === 'function') {
      window.bambiXPProgress.init();
    }
    
    if (window.bambiCollar && typeof window.bambiCollar.init === 'function') {
      window.bambiCollar.init();
    }
    
    if (window.bambiTriggers && typeof window.bambiTriggers.init === 'function') {
      window.bambiTriggers.init();
    }
    
    if (window.bambiHistory && typeof window.bambiHistory.init === 'function') {
      window.bambiHistory.init();
    }
    
    // Initialize audio controls
    initAudioControls();
  }
  
  // Initialize tab system
  function initTabSystem() {
    const controlButtons = document.querySelectorAll('.control-btn:not(.disabled)');
    
    controlButtons.forEach(button => {
      button.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target');
        
        // Remove active class from all buttons
        controlButtons.forEach(btn => {
          btn.classList.remove('active');
        });
        
        // Hide all panels
        document.querySelectorAll('.control-panel').forEach(panel => {
          panel.classList.remove('active');
        });
        
        // Add active class to clicked button
        this.classList.add('active');
        
        // Show target panel
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }
      });
    });
  }
  
  // Initialize audio controls
  function initAudioControls() {
    const loopToggle = document.getElementById('loop-toggle');
    const loopSpeedSlider = document.getElementById('loop-speed');
    const speedValueDisplay = document.getElementById('speed-value');
    
    if (loopToggle) {
      loopToggle.addEventListener('change', function() {
        if (this.checked) {
          // Use bambiAudio API to control continuous playback
          if (window.bambiAudio && typeof window.bambiAudio.startContinuousPlayback === 'function') {
            window.bambiAudio.startContinuousPlayback();
          }
        } else {
          if (window.bambiAudio && typeof window.bambiAudio.stopContinuousPlayback === 'function') {
            window.bambiAudio.stopContinuousPlayback();
          }
        }
      });
    }
    
    if (loopSpeedSlider) {
      // Set initial speed value
      window.loopSpeedFactor = 1.0;
      
      loopSpeedSlider.addEventListener('input', function() {
        const value = parseInt(this.value);
        let speedLabel = '';
        
        // Map slider values to speed factors (1-10 scale) with more descriptive names
        if (value <= 2) {
          window.loopSpeedFactor = 2.0;
          speedLabel = 'Relaxation (Slow)';
        } else if (value <= 4) {
          window.loopSpeedFactor = 1.5;
          speedLabel = 'Gentle Drop';
        } else if (value <= 5) {
          window.loopSpeedFactor = 1.0;
          speedLabel = 'Normal';
        } else if (value <= 6) {
          window.loopSpeedFactor = 0.36;
          speedLabel = 'Trance (2.5x)';
        } else if (value <= 8) {
          window.loopSpeedFactor = 0.18;
          speedLabel = 'Deep Trance (3x)';
        } else {
          window.loopSpeedFactor = 0.06;
          speedLabel = 'Brainwash (4x)';
        }
        
        // Update display text
        if (speedValueDisplay) {
          speedValueDisplay.textContent = speedLabel;
        }
        
        // Update any active playback
        if (window.bambiAudio && typeof window.bambiAudio.updatePlaybackSpeed === 'function') {
          window.bambiAudio.updatePlaybackSpeed(window.loopSpeedFactor);
        }
      });
    }
  }
  
  // Export functions
  window.bambiSystemControls = {
    init
  };
  
  // Auto-initialize on load
  document.addEventListener('DOMContentLoaded', init);
})();