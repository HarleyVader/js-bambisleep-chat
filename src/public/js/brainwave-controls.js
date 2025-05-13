document.addEventListener('DOMContentLoaded', function() {
  // Audio context and variables
  let audioContext = null;
  let oscillatorLeft = null;
  let oscillatorRight = null;
  let gainNode = null;
  let isPlaying = false;
  
  // Get DOM elements
  const brainwaveToggle = document.getElementById('brainwave-enable');
  const brainwaveMode = document.getElementById('brainwave-mode');
  const customFrequencySlider = document.getElementById('custom-frequency');
  const customFrequencyValue = document.getElementById('custom-frequency-value');
  const carrierFrequencySlider = document.getElementById('carrier-frequency');
  const carrierFrequencyValue = document.getElementById('carrier-frequency-value');
  const volumeSlider = document.getElementById('brainwave-volume');
  const volumeValue = document.getElementById('brainwave-volume-value');
  const playButton = document.getElementById('play-brainwave');
  const stopButton = document.getElementById('stop-brainwave');
  const saveButton = document.getElementById('save-brainwave');
  const frequencyDescription = document.getElementById('frequency-description');
  const customFreqContainer = document.getElementById('custom-freq-container');
  
  if (!brainwaveToggle || !brainwaveMode) return;
  
  // Frequency presets (in Hz)
  const frequencies = {
    alpha: 10,    // 8-14Hz - Relaxed focus
    theta: 6,     // 4-8Hz - Deep trance
    delta: 2,     // 1-4Hz - Sleep state
    beta: 20      // 14-30Hz - Alert state
  };
  
  // Description texts
  const descriptions = {
    alpha: "Alpha waves (8-14Hz) promote relaxed focus and are ideal for gentle trance states.",
    theta: "Theta waves (4-8Hz) induce deep trance and meditation states, enhancing suggestibility.",
    delta: "Delta waves (1-4Hz) are associated with deep sleep and unconscious mind programming.",
    beta: "Beta waves (14-30Hz) create an alert, focused state and can help with mental clarity.",
    custom: "Custom frequency allows precise tuning of brainwave entrainment effects."
  };
  
  // Update UI based on mode selection
  brainwaveMode.addEventListener('change', function() {
    const mode = this.value;
    
    if (mode === 'custom') {
      customFreqContainer.style.display = '';
    } else {
      customFreqContainer.style.display = 'none';
    }
    
    // Update description
    frequencyDescription.textContent = descriptions[mode] || descriptions.custom;
  });
  
  // Update custom frequency display
  customFrequencySlider.addEventListener('input', function() {
    customFrequencyValue.textContent = this.value + ' Hz';
    if (isPlaying) {
      updateBinauralBeat();
    }
  });
  
  // Update carrier frequency display
  carrierFrequencySlider.addEventListener('input', function() {
    carrierFrequencyValue.textContent = this.value + ' Hz';
    if (isPlaying) {
      updateBinauralBeat();
    }
  });
  
  // Update volume
  volumeSlider.addEventListener('input', function() {
    volumeValue.textContent = this.value + '%';
    if (gainNode) {
      gainNode.gain.value = this.value / 100;
    }
  });
  
  // Start binaural beat
  playButton.addEventListener('click', function() {
    if (isPlaying) return;
    
    try {
      // Create audio context if not exists
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Create gain node
      gainNode = audioContext.createGain();
      gainNode.gain.value = volumeSlider.value / 100;
      gainNode.connect(audioContext.destination);
      
      // Create oscillators
      oscillatorLeft = audioContext.createOscillator();
      oscillatorRight = audioContext.createOscillator();
      
      // Create channel merger for stereo
      const merger = audioContext.createChannelMerger(2);
      
      // Connect oscillators to specific channels
      oscillatorLeft.connect(merger, 0, 0);  // Left channel
      oscillatorRight.connect(merger, 0, 1); // Right channel
      merger.connect(gainNode);
      
      // Set frequencies
      updateBinauralBeat();
      
      // Start oscillators
      oscillatorLeft.start();
      oscillatorRight.start();
      
      isPlaying = true;
      playButton.disabled = true;
      stopButton.disabled = false;
      
      showNotification("Binaural beats playing", "success");
    } catch (error) {
      console.error('Error starting binaural beat:', error);
      showNotification("Failed to start audio: " + error.message, "error");
    }
  });
  
  // Stop binaural beat
  stopButton.addEventListener('click', function() {
    if (!isPlaying) return;
    
    try {
      oscillatorLeft.stop();
      oscillatorRight.stop();
      
      oscillatorLeft = null;
      oscillatorRight = null;
      
      isPlaying = false;
      playButton.disabled = false;
      stopButton.disabled = true;
      
      showNotification("Binaural beats stopped", "info");
    } catch (error) {
      console.error('Error stopping binaural beat:', error);
    }
  });
  
  // Save settings
  saveButton.addEventListener('click', function() {
    const settings = {
      brainwaveEnabled: brainwaveToggle.checked,
      brainwaveMode: brainwaveMode.value,
      customFrequency: parseFloat(customFrequencySlider.value),
      carrierFrequency: parseFloat(carrierFrequencySlider.value),
      brainwaveVolume: parseInt(volumeSlider.value)
    };
    
    // Save to system state first
    if (window.bambiSystem && typeof window.bambiSystem.saveBrainwaveSettings === 'function') {
      window.bambiSystem.saveBrainwaveSettings(settings);
      showNotification("Brainwave settings saved", "success");
    } else {
      // Fallback - save directly to localStorage
      try {
        // Get existing state
        let state = {};
        try {
          const stateJson = localStorage.getItem('bambiSystemState');
          if (stateJson) {
            state = JSON.parse(stateJson);
          }
        } catch(e) {
          console.error('Error parsing system state:', e);
          state = {};
        }
        
        // Update with brainwave settings
        state.brainwaves = settings;
        
        // Save back to localStorage
        localStorage.setItem('bambiSystemState', JSON.stringify(state));
        showNotification("Brainwave settings saved", "success");
      } catch(e) {
        console.error('Error saving to localStorage:', e);
        showNotification("Failed to save settings", "error");
      }
    }
  });
  
  // Update binaural beat frequencies
  function updateBinauralBeat() {
    if (!oscillatorLeft || !oscillatorRight) return;
    
    const mode = brainwaveMode.value;
    let frequency = 0;
    
    if (mode === 'custom') {
      frequency = parseFloat(customFrequencySlider.value);
    } else {
      frequency = frequencies[mode] || 10; // Default to alpha if unknown
    }
    
    const carrierFrequency = parseFloat(carrierFrequencySlider.value);
    
    // Set frequencies for left and right ears
    oscillatorLeft.frequency.value = carrierFrequency;
    oscillatorRight.frequency.value = carrierFrequency + frequency;
  }
  
  // Show notification
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification notification-' + type;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
  
  // Send loaded event when component is ready
  document.dispatchEvent(new CustomEvent('brainwaves-loaded'));
});