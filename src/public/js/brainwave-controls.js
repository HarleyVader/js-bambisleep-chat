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
      if (frequencies[mode]) {
        customFrequencySlider.value = frequencies[mode];
        customFrequencyValue.textContent = frequencies[mode] + ' Hz';
      }
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
      // Initialize audio context if needed
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Create gain node for volume control
      gainNode = audioContext.createGain();
      gainNode.gain.value = volumeSlider.value / 100;
      gainNode.connect(audioContext.destination);
      
      // Create stereo panner for left/right ear separation
      const pannerLeft = audioContext.createStereoPanner();
      pannerLeft.pan.value = -1; // Full left
      pannerLeft.connect(gainNode);
      
      const pannerRight = audioContext.createStereoPanner();
      pannerRight.pan.value = 1; // Full right
      pannerRight.connect(gainNode);
      
      // Create oscillators
      const baseFreq = parseFloat(carrierFrequencySlider.value);
      const beatFreq = parseFloat(customFrequencySlider.value);
      
      oscillatorLeft = audioContext.createOscillator();
      oscillatorLeft.type = 'sine';
      oscillatorLeft.frequency.value = baseFreq;
      oscillatorLeft.connect(pannerLeft);
      
      oscillatorRight = audioContext.createOscillator();
      oscillatorRight.type = 'sine';
      oscillatorRight.frequency.value = baseFreq + beatFreq;
      oscillatorRight.connect(pannerRight);
      
      // Start oscillators
      oscillatorLeft.start();
      oscillatorRight.start();
      
      isPlaying = true;
      playButton.disabled = true;
      stopButton.disabled = false;
      
      // Notify user
      showNotification('Binaural beat started', 'info');
      
    } catch (error) {
      console.error('Error starting binaural beat:', error);
      showNotification('Failed to start audio. Please try again.', 'error');
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
      gainNode = null;
      
      isPlaying = false;
      playButton.disabled = false;
      stopButton.disabled = true;
      
      showNotification('Binaural beat stopped', 'info');
      
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
    
    fetch('/api/profile/system-controls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ systemControls: settings })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showNotification('Brainwave settings saved', 'success');
      } else {
        showNotification('Failed to save settings', 'error');
      }
    })
    .catch(error => {
      console.error('Error saving brainwave settings:', error);
      showNotification('Error saving settings', 'error');
    });
  });
  
  // Update binaural beat frequencies
  function updateBinauralBeat() {
    if (!oscillatorLeft || !oscillatorRight) return;
    
    const baseFreq = parseFloat(carrierFrequencySlider.value);
    const beatFreq = parseFloat(customFrequencySlider.value);
    
    oscillatorLeft.frequency.value = baseFreq;
    oscillatorRight.frequency.value = baseFreq + beatFreq;
  }
  
  // Show notification
  function showNotification(message, type = 'info') {
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      // Fallback if global notification function isn't available
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }
});