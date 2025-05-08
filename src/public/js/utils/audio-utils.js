window.audioUtils = (function() {
  // Simple cache for loaded audio
  const audioCache = {};
  
  // Default volume
  let volume = 0.7;
  
  // Load settings from localStorage
  try {
    const settings = JSON.parse(localStorage.getItem('audioSettings') || '{}');
    if (settings.volume !== undefined) volume = settings.volume;
  } catch (e) {
    console.error('Error loading audio settings:', e);
  }
  
  // Play trigger audio
  function playTriggerAudio(triggerName) {
    const audioPath = `/public/audio/triggers/${triggerName}.mp3`;
    
    // Use existing audio player if available
    if (window.audioPlayer) {
      window.audioPlayer.play(audioPath);
      return;
    }
    
    // Fallback to basic audio
    const audio = new Audio(audioPath);
    audio.volume = 0.7; // Default volume
    audio.play().catch(err => console.error('Audio playback error:', err));
  }
  
  // Update volume for all audio
  function setVolume(newVolume) {
    volume = Math.max(0, Math.min(1, newVolume));
    
    // Update all cached audio elements
    Object.values(audioCache).forEach(audio => {
      audio.volume = volume;
    });
    
    // Save to localStorage
    try {
      const settings = JSON.parse(localStorage.getItem('audioSettings') || '{}');
      settings.volume = volume;
      localStorage.setItem('audioSettings', JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving audio settings:', e);
    }
  }
  
  // Apply audio settings
  function applyAudioSettings() {
    const settings = localStorage.getItem('audioSettings');
    if (!settings) return;
    
    try {
      const { volume, enableSound, enableVoice } = JSON.parse(settings);
      
      // Set global volume
      if (window.audioPlayer) {
        window.audioPlayer.setVolume(volume);
      }
      
      // Update UI controls
      const volumeSlider = document.getElementById('volume-slider');
      if (volumeSlider) volumeSlider.value = volume * 100;
      
      const soundToggle = document.getElementById('sound-toggle');
      if (soundToggle) soundToggle.checked = enableSound;
      
      const voiceToggle = document.getElementById('voice-toggle');
      if (voiceToggle) voiceToggle.checked = enableVoice;
    } catch (err) {
      console.error('Error parsing audio settings:', err);
    }
  }
  
  // Return public API
  return {
    playTriggerAudio,
    setVolume,
    applyAudioSettings
  };
})();

window.brainwaveGenerator = (function() {
  // AudioContext instance
  let audioContext = null;
  let oscillatorLeft = null;
  let oscillatorRight = null;
  let gainNode = null;

  // Brainwave frequency ranges (in Hz)
  const brainwaveRanges = {
    delta: { base: 100, difference: 1.5 },  // 0.5-4Hz beats (deep sleep)
    theta: { base: 100, difference: 5 },    // 4-8Hz beats (meditation, drowsiness)
    alpha: { base: 100, difference: 10 },   // 8-12Hz beats (relaxed awareness)
    beta: { base: 100, difference: 18 },    // 13-30Hz beats (active thinking)
    gamma: { base: 100, difference: 35 }    // 30-100Hz beats (higher cognition)
  };

  let isPlaying = false;
  let currentWave = null;

  // Initialize audio context
  function initAudio() {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create stereo panner for proper stereo separation
        gainNode = audioContext.createGain();
        gainNode.gain.value = 0.2; // Lower default volume for comfort
        gainNode.connect(audioContext.destination);
      }
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  // Start playing a specific brainwave pattern
  function playBrainwave(type) {
    if (!brainwaveRanges[type]) {
      console.error(`Unknown brainwave type: ${type}`);
      return;
    }

    try {
      initAudio();
      stopBrainwave(); // Stop any current playback
      
      // Resume context if suspended (needed due to autoplay policies)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const { base, difference } = brainwaveRanges[type];
      
      // Create oscillators for left and right ear
      oscillatorLeft = audioContext.createOscillator();
      oscillatorRight = audioContext.createOscillator();
      
      // Set frequencies to create the binaural beat
      oscillatorLeft.frequency.value = base;
      oscillatorRight.frequency.value = base + difference;
      
      // Create channel merger for stereo
      const merger = audioContext.createChannelMerger(2);
      
      // Route oscillators to proper channels
      const leftGain = audioContext.createGain();
      const rightGain = audioContext.createGain();
      
      oscillatorLeft.connect(leftGain);
      oscillatorRight.connect(rightGain);
      
      leftGain.connect(merger, 0, 0);  // Left oscillator to left channel
      rightGain.connect(merger, 0, 1);  // Right oscillator to right channel
      
      merger.connect(gainNode);
      
      // Start oscillators
      oscillatorLeft.start();
      oscillatorRight.start();
      
      isPlaying = true;
      currentWave = type;
      
      // Award XP for using the feature
      if (window.socket && window.socket.connected) {
        window.socket.emit('client-award-xp', {
          action: 'use-brainwave',
          amount: 5,
          timestamp: Date.now()
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error playing brainwave:', error);
      return false;
    }
  }

  // Stop playing brainwaves
  function stopBrainwave() {
    try {
      if (oscillatorLeft) {
        oscillatorLeft.stop();
        oscillatorLeft.disconnect();
        oscillatorLeft = null;
      }
      
      if (oscillatorRight) {
        oscillatorRight.stop();
        oscillatorRight.disconnect();
        oscillatorRight = null;
      }
      
      isPlaying = false;
      currentWave = null;
    } catch (error) {
      console.error('Error stopping brainwave:', error);
    }
  }

  // Set volume for brainwave audio
  function setVolume(value) {
    if (gainNode) {
      gainNode.gain.value = Math.max(0, Math.min(1, value));
    }
  }

  // Get current status
  function getStatus() {
    return {
      isPlaying,
      currentWave
    };
  }

  // Clean up resources
  function destroy() {
    stopBrainwave();
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
  }

  // Public API
  return {
    playBrainwave,
    stopBrainwave,
    getStatus,
    setVolume,
    destroy
  };
})();

window.binauralPlayer = (function() {
  // AudioContext instance
  let audioContext = null;
  let oscillatorLeft = null;
  let oscillatorRight = null;
  let gainNode = null;

  // Binaural frequency ranges (in Hz)
  const brainwaveRanges = {
    delta: { base: 100, difference: 1.5 },  // 0.5-4Hz beats (deep sleep)
    theta: { base: 100, difference: 5 },    // 4-8Hz beats (meditation, drowsiness)
    alpha: { base: 100, difference: 10 },   // 8-12Hz beats (relaxed awareness)
    beta: { base: 100, difference: 18 },    // 13-30Hz beats (active thinking)
    gamma: { base: 100, difference: 35 }    // 30-100Hz beats (higher cognition)
  };

  let isPlaying = false;
  let currentWave = null;

  // Initialize audio context
  function initAudio() {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create gain node for volume control
        gainNode = audioContext.createGain();
        gainNode.gain.value = 0.2; // Lower default volume for comfort
        gainNode.connect(audioContext.destination);
      }
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  // Start playing a specific binaural pattern
  function playBinaural(type) {
    if (!brainwaveRanges[type]) {
      console.error(`Unknown binaural type: ${type}`);
      return false;
    }

    try {
      initAudio();
      stopBinaural(); // Stop any current playback
      
      // Resume context if suspended (needed due to autoplay policies)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const { base, difference } = brainwaveRanges[type];
      
      // Create oscillators for left and right ear
      oscillatorLeft = audioContext.createOscillator();
      oscillatorRight = audioContext.createOscillator();
      
      // Set frequencies to create the binaural beat
      oscillatorLeft.frequency.value = base;
      oscillatorRight.frequency.value = base + difference;
      
      // Create channel merger for stereo
      const merger = audioContext.createChannelMerger(2);
      
      // Route oscillators to proper channels
      const leftGain = audioContext.createGain();
      const rightGain = audioContext.createGain();
      
      oscillatorLeft.connect(leftGain);
      oscillatorRight.connect(rightGain);
      
      leftGain.connect(merger, 0, 0);  // Left oscillator to left channel
      rightGain.connect(merger, 0, 1);  // Right oscillator to right channel
      
      merger.connect(gainNode);
      
      // Start oscillators
      oscillatorLeft.start();
      oscillatorRight.start();
      
      isPlaying = true;
      currentWave = type;
      
      // Award XP for using the feature
      if (window.socket && window.socket.connected) {
        window.socket.emit('client-award-xp', {
          action: 'use-binaural',
          amount: 5,
          timestamp: Date.now()
        });
      }
      
      // Update UI
      updateBinauralUI();
      
      return true;
    } catch (error) {
      console.error('Error playing binaural:', error);
      return false;
    }
  }

  // Stop playing binaurals
  function stopBinaural() {
    try {
      if (oscillatorLeft) {
        oscillatorLeft.stop();
        oscillatorLeft.disconnect();
        oscillatorLeft = null;
      }
      
      if (oscillatorRight) {
        oscillatorRight.stop();
        oscillatorRight.disconnect();
        oscillatorRight = null;
      }
      
      isPlaying = false;
      currentWave = null;
      
      // Update UI
      updateBinauralUI();
      
      return true;
    } catch (error) {
      console.error('Error stopping binaural:', error);
      return false;
    }
  }

  // Set volume for binaural audio
  function setVolume(value) {
    if (gainNode) {
      const normalizedValue = Math.max(0, Math.min(1, value));
      gainNode.gain.value = normalizedValue;
      
      try {
        localStorage.setItem('binauralVolume', normalizedValue.toString());
      } catch (e) {
        console.error('Error saving binaural volume:', e);
      }
    }
  }

  // Get current status
  function getStatus() {
    return {
      isPlaying,
      currentWave
    };
  }

  // Update UI elements
  function updateBinauralUI() {
    try {
      // Update active wave display
      const activeWaveDisplay = document.getElementById('active-wave-display');
      if (activeWaveDisplay) {
        activeWaveDisplay.textContent = currentWave ? 
          currentWave.charAt(0).toUpperCase() + currentWave.slice(1) : 
          'None';
      }
      
      // Update button states
      document.querySelectorAll('.binaural-btn').forEach(btn => {
        const wave = btn.getAttribute('data-wave');
        if (wave === currentWave) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    } catch (error) {
      console.error('Error updating binaural UI:', error);
    }
  }

  // Clean up resources
  function destroy() {
    stopBinaural();
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
  }

  // Initialize event listeners
  function init() {
    try {
      // Set up binaural button event handlers
      document.querySelectorAll('.binaural-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const wave = this.getAttribute('data-wave');
          if (wave === 'stop') {
            stopBinaural();
          } else {
            playBinaural(wave);
          }
        });
      });
      
      // Set up volume control
      const volumeSlider = document.getElementById('binaurals-volume');
      const volumeValue = document.getElementById('binaurals-volume-value');
      
      if (volumeSlider && volumeValue) {
        // Load saved volume
        try {
          const savedVolume = localStorage.getItem('binauralVolume');
          if (savedVolume !== null) {
            const volume = parseFloat(savedVolume);
            volumeSlider.value = volume * 100;
            volumeValue.textContent = Math.round(volume * 100) + '%';
            setVolume(volume);
          }
        } catch (e) {
          console.error('Error loading binaural volume:', e);
        }
        
        // Add event listener for volume changes
        volumeSlider.addEventListener('input', function() {
          const volume = this.value / 100;
          setVolume(volume);
          if (volumeValue) {
            volumeValue.textContent = this.value + '%';
          }
        });
      }
      
      // Initialize UI
      updateBinauralUI();
    } catch (error) {
      console.error('Error initializing binaural player:', error);
    }
  }

  // Public API
  return {
    init,
    playBinaural,
    stopBinaural,
    getStatus,
    setVolume,
    destroy
  };
})();

// Initialize binaural player when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  try {
    if (window.binauralPlayer) {
      window.binauralPlayer.init();
    }
  } catch (error) {
    console.error('Error initializing binaural player:', error);
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Optional: create controller UI elements
  try {
    const container = document.getElementById('brainwave-controls');
    if (container) {
      const waves = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
      
      const controlsHTML = `
        <div class="brainwave-buttons">
          ${waves.map(wave => `
            <button class="brainwave-btn" data-wave="${wave}">
              ${wave.charAt(0).toUpperCase() + wave.slice(1)}
            </button>
          `).join('')}
          <button class="brainwave-btn stop-btn" data-wave="stop">Stop</button>
        </div>
        <div class="volume-control">
          <label for="brainwave-volume">Volume: </label>
          <input type="range" id="brainwave-volume" min="0" max="100" value="20">
        </div>
      `;
      
      container.innerHTML = controlsHTML;
      
      // Add event listeners
      document.querySelectorAll('.brainwave-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const wave = this.getAttribute('data-wave');
          if (wave === 'stop') {
            window.brainwaveGenerator.stopBrainwave();
          } else {
            window.brainwaveGenerator.playBrainwave(wave);
          }
        });
      });
      
      // Volume control
      const volumeSlider = document.getElementById('brainwave-volume');
      if (volumeSlider) {
        volumeSlider.addEventListener('input', function() {
          window.brainwaveGenerator.setVolume(this.value / 100);
        });
      }
    }
  } catch (error) {
    console.error('Error initializing brainwave UI:', error);
  }
});