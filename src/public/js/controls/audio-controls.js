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

window.binauralPlayer = (function() {
  // AudioContext instance
  let audioContext = null;
  let oscillatorLeft = null;
  let oscillatorRight = null;
  let gainNode = null;

  // EEG brainwave frequency ranges (in Hz)
  // Based on clinical EEG classification standards
  const brainwaveRanges = {
    delta: { min: 0.5, max: 4, typical: 2 },    // Deep sleep
    theta: { min: 4, max: 8, typical: 6 },      // Drowsiness, meditation
    alpha: { min: 8, max: 14, typical: 10 },    // Relaxed but alert
    beta: { min: 14, max: 30, typical: 20 },    // Alert, focused
    gamma: { min: 30, max: 100, typical: 40 }   // Higher cognitive processing
  };

  // Carrier tone frequencies
  // Lower frequencies are more effective for binaural beats (<1000Hz)
  const carrierFrequencies = {
    default: 250,  // Default carrier frequency
    delta: 200,    // Lower carrier for delta (better perception)
    theta: 250,    // Good carrier for theta
    alpha: 300,    // Good carrier for alpha
    beta: 350,     // Good carrier for beta
    gamma: 400     // Higher carrier for gamma
  };
  
  // Current state
  let isPlaying = false;
  let currentWave = null;
  let currentBeatFrequency = null;
  let currentCarrierFrequency = null;
  
  // Optional sweep parameters
  let isSweeping = false;
  let sweepStartFreq = null;
  let sweepEndFreq = null;
  let sweepDuration = null;
  let sweepStartTime = null;

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

  // Calculate optimal carrier frequency based on beat frequency
  function getOptimalCarrierFrequency(beatFrequency) {
    // Lower carrier tones work better for lower beat frequencies
    if (beatFrequency < 5) return 200;
    if (beatFrequency < 10) return 250;
    if (beatFrequency < 20) return 300;
    return 350;
  }
  
  // Start playing a specific binaural pattern
  function playBinaural(type, options = {}) {
    const { frequency, carrierFreq, sweep } = options;
    
    if (!brainwaveRanges[type]) {
      console.error(`Unknown brainwave type: ${type}`);
      return false;
    }

    try {
      initAudio();
      stopBinaural(); // Stop any current playback
      
      // Resume context if suspended (needed due to autoplay policies)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Determine beat frequency to use
      let beatFrequency;
      if (frequency && frequency >= brainwaveRanges[type].min && frequency <= brainwaveRanges[type].max) {
        beatFrequency = frequency;
      } else {
        beatFrequency = brainwaveRanges[type].typical;
      }
      
      // Determine carrier frequency
      const carrier = carrierFreq || carrierFrequencies[type] || getOptimalCarrierFrequency(beatFrequency);
      
      // Setup sweep if requested
      if (sweep && sweep.endFreq) {
        isSweeping = true;
        sweepStartFreq = beatFrequency;
        sweepEndFreq = sweep.endFreq;
        sweepDuration = sweep.duration || 300; // Default 5 minutes (300 seconds)
        sweepStartTime = audioContext.currentTime;
      } else {
        isSweeping = false;
      }
      
      // Create oscillators for left and right ear
      oscillatorLeft = audioContext.createOscillator();
      oscillatorRight = audioContext.createOscillator();
      
      // Set initial frequencies
      oscillatorLeft.frequency.value = carrier; 
      oscillatorRight.frequency.value = carrier + beatFrequency;
      
      currentBeatFrequency = beatFrequency;
      currentCarrierFrequency = carrier;
      
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
      
      // Set up frequency sweep if needed
      if (isSweeping) {
        startFrequencySweep();
      }
      
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
  
  // Handle frequency sweep over time
  function startFrequencySweep() {
    if (!isSweeping || !oscillatorRight || !sweepStartFreq || !sweepEndFreq) return;
    
    const updateFrequency = () => {
      if (!isPlaying || !isSweeping) return;
      
      const now = audioContext.currentTime;
      const elapsed = now - sweepStartTime;
      const progress = Math.min(elapsed / sweepDuration, 1.0);
      
      // Calculate current frequency in the sweep
      const currentFreq = sweepStartFreq + (sweepEndFreq - sweepStartFreq) * progress;
      
      // Update oscillator frequency
      if (oscillatorRight) {
        oscillatorRight.frequency.value = currentCarrierFrequency + currentFreq;
        currentBeatFrequency = currentFreq;
      }
      
      // Update UI if needed
      updateBinauralUI();
      
      // Continue sweep if not complete
      if (progress < 1.0) {
        requestAnimationFrame(updateFrequency);
      } else {
        isSweeping = false;
      }
    };
    
    requestAnimationFrame(updateFrequency);
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
      currentBeatFrequency = null;
      currentCarrierFrequency = null;
      isSweeping = false;
      
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
      currentWave,
      beatFrequency: currentBeatFrequency,
      carrierFrequency: currentCarrierFrequency,
      isSweeping,
      sweepProgress: isSweeping ? 
        Math.min((audioContext.currentTime - sweepStartTime) / sweepDuration, 1.0) : 0
    };
  }
  
  // Get information about brain states
  function getBrainwaveInfo(type) {
    const info = {
      delta: {
        name: "Delta",
        range: "0.5-4 Hz",
        state: "Deep sleep, healing",
        benefits: "Promotes deep sleep, healing, immune system function",
        description: "Delta waves are the slowest recorded brain waves in humans. They are found most often in infants and young children, and are associated with the deepest levels of relaxation and restorative sleep."
      },
      theta: {
        name: "Theta",
        range: "4-8 Hz",
        state: "Drowsiness, meditation, creativity",
        benefits: "Enhances meditation, creativity, memory function",
        description: "Theta waves occur during sleep but have also been observed in deep meditation. Theta is believed to be important for processing information and memory formation."
      },
      alpha: {
        name: "Alpha",
        range: "8-14 Hz",
        state: "Relaxed alertness, calm, learning",
        benefits: "Reduces anxiety, improves learning, promotes calm focus",
        description: "Alpha waves are dominant during quietly flowing thoughts, in some meditative states, and generally when the eyes are closed. Alpha is the resting state for the brain."
      },
      beta: {
        name: "Beta",
        range: "14-30 Hz",
        state: "Active thinking, focus, alert",
        benefits: "Improves concentration, alertness, cognition",
        description: "Beta waves dominate our normal waking state when attention is directed towards cognitive tasks and the outside world. Beta is a 'fast' activity, present when we are alert, attentive, or problem-solving."
      },
      gamma: {
        name: "Gamma",
        range: "30-100 Hz",
        state: "Higher cognitive processing, peak focus",
        benefits: "Associated with peak concentration, cognition and problem solving",
        description: "Gamma waves are associated with higher cognitive functioning, peak concentration, and the integration of information across different brain regions."
      }
    };
    
    return type ? info[type] : info;
  }

  // Update UI elements
  function updateBinauralUI() {
    try {
      // Update active wave display
      const activeWaveDisplay = document.getElementById('active-wave-display');
      if (activeWaveDisplay && currentWave) {
        const displayText = currentBeatFrequency ? 
          `${currentWave.charAt(0).toUpperCase() + currentWave.slice(1)} (${currentBeatFrequency.toFixed(1)}Hz)` : 
          'None';
        activeWaveDisplay.textContent = displayText;
      } else if (activeWaveDisplay) {
        activeWaveDisplay.textContent = 'None';
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
      
      // Update frequency display if available
      const freqDisplay = document.getElementById('binaural-freq-display');
      if (freqDisplay && currentBeatFrequency) {
        freqDisplay.textContent = currentBeatFrequency.toFixed(1) + ' Hz';
      } else if (freqDisplay) {
        freqDisplay.textContent = '—';
      }
      
      // Update sweep progress if available
      const sweepDisplay = document.getElementById('sweep-progress');
      if (sweepDisplay && isSweeping) {
        const progress = Math.min((audioContext.currentTime - sweepStartTime) / sweepDuration, 1.0) * 100;
        sweepDisplay.textContent = `Sweep: ${progress.toFixed(0)}%`;
        sweepDisplay.style.display = 'block';
      } else if (sweepDisplay) {
        sweepDisplay.style.display = 'none';
      }
      
      // Dispatch state change event for visualizer
      document.dispatchEvent(new CustomEvent('binaural-state-changed', {
        detail: { 
          isPlaying, 
          type: currentWave,
          frequency: currentBeatFrequency 
        }
      }));
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
            // Use specific frequency if provided
            const freq = this.getAttribute('data-freq');
            const options = freq ? { frequency: parseFloat(freq) } : {};
            playBinaural(wave, options);
          }
        });
      });
      
      // Set up sweep buttons if available
      document.querySelectorAll('.sweep-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const startType = this.getAttribute('data-start');
          const endType = this.getAttribute('data-end');
          const duration = this.getAttribute('data-duration');
          
          if (startType && endType && brainwaveRanges[startType] && brainwaveRanges[endType]) {
            const options = {
              sweep: {
                endFreq: brainwaveRanges[endType].typical,
                duration: duration ? parseInt(duration) : 300
              }
            };
            playBinaural(startType, options);
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
      
      // Set up custom frequency slider if available
      const freqSlider = document.getElementById('custom-frequency');
      const freqValue = document.getElementById('custom-frequency-value');
      
      if (freqSlider && freqValue) {
        freqSlider.addEventListener('input', function() {
          const freq = parseFloat(this.value);
          freqValue.textContent = freq.toFixed(1) + ' Hz';
          
          // Apply frequency if already playing
          if (isPlaying && oscillatorRight && currentCarrierFrequency) {
            oscillatorRight.frequency.value = currentCarrierFrequency + freq;
            currentBeatFrequency = freq;
            updateBinauralUI();
          }
        });
        
        // Custom frequency apply button
        const applyFreqBtn = document.getElementById('apply-frequency');
        if (applyFreqBtn) {
          applyFreqBtn.addEventListener('click', function() {
            const freq = parseFloat(freqSlider.value);
            
            // Determine appropriate brainwave type based on frequency
            let type = 'custom';
            for (const [waveType, range] of Object.entries(brainwaveRanges)) {
              if (freq >= range.min && freq <= range.max) {
                type = waveType;
                break;
              }
            }
            
            playBinaural(type, { frequency: freq });
          });
        }
      }
      
      // Initialize UI
      updateBinauralUI();
      
      // Create info popups for each brainwave type
      createBrainwaveInfoElements();
      
    } catch (error) {
      console.error('Error initializing binaural player:', error);
    }
  }
  
  // Create information elements for each brainwave type
  function createBrainwaveInfoElements() {
    try {
      const infoContainer = document.getElementById('brainwave-info');
      if (!infoContainer) return;
      
      // Clear existing content
      infoContainer.innerHTML = '';
      
      // Create tabs for each brainwave type
      const tabsHtml = Object.keys(brainwaveRanges).map(type => {
        return `<button class="info-tab" data-type="${type}">${getBrainwaveInfo(type).name}</button>`;
      }).join('');
      
      // Create content for each brainwave type
      const contentHtml = Object.keys(brainwaveRanges).map(type => {
        const info = getBrainwaveInfo(type);
        return `
          <div class="info-content" id="info-${type}">
            <h3>${info.name} waves (${info.range})</h3>
            <p><strong>State of mind:</strong> ${info.state}</p>
            <p><strong>Benefits:</strong> ${info.benefits}</p>
            <p>${info.description}</p>
            <div class="frequency-presets">
              ${getFrequencyPresetButtons(type)}
            </div>
          </div>
        `;
      }).join('');
      
      infoContainer.innerHTML = `
        <div class="info-tabs">${tabsHtml}</div>
        <div class="info-contents">${contentHtml}</div>
      `;
      
      // Show the first tab by default
      const firstType = Object.keys(brainwaveRanges)[0];
      document.getElementById(`info-${firstType}`).style.display = 'block';
      document.querySelector(`.info-tab[data-type="${firstType}"]`).classList.add('active');
      
      // Add tab click handlers
      document.querySelectorAll('.info-tab').forEach(tab => {
        tab.addEventListener('click', function() {
          const type = this.getAttribute('data-type');
          
          // Hide all content panels
          document.querySelectorAll('.info-content').forEach(content => {
            content.style.display = 'none';
          });
          
          // Show selected content
          const selectedContent = document.getElementById(`info-${type}`);
          if (selectedContent) {
            selectedContent.style.display = 'block';
          }
          
          // Update tab states
          document.querySelectorAll('.info-tab').forEach(t => {
            t.classList.remove('active');
          });
          this.classList.add('active');
        });
      });
      
      // Add preset frequency button handlers
      document.querySelectorAll('.freq-preset-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const type = this.getAttribute('data-type');
          const freq = parseFloat(this.getAttribute('data-freq'));
          
          if (type && !isNaN(freq)) {
            playBinaural(type, { frequency: freq });
          }
        });
      });
    } catch (error) {
      console.error('Error creating brainwave info elements:', error);
    }
  }
  
  // Generate preset frequency buttons for each brainwave type
  function getFrequencyPresetButtons(type) {
    const range = brainwaveRanges[type];
    if (!range) return '';
    
    const presets = [];
    const step = (range.max - range.min) / 3;
    
    // Generate several preset frequencies within the range
    for (let freq = range.min; freq <= range.max; freq += step) {
      const roundedFreq = Math.round(freq * 10) / 10;
      presets.push(`
        <button class="freq-preset-btn" data-type="${type}" data-freq="${roundedFreq}">
          ${roundedFreq} Hz
        </button>
      `);
    }
    
    return presets.join('');
  }

  // Public API
  return {
    init,
    playBinaural,
    stopBinaural,
    getStatus,
    setVolume,
    destroy,
    getBrainwaveInfo,
    getBrainwaveRanges: () => brainwaveRanges
  };
})();

// Initialize binaural player when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  try {
    if (window.binauralPlayer) {
      window.binauralPlayer.init();
    }
    
    // Create enhanced UI if the container exists
    createEnhancedBinauralUI();
  } catch (error) {
    console.error('Error initializing binaural player:', error);
  }
});

// Create enhanced binaural UI with more options
function createEnhancedBinauralUI() {
  try {
    const container = document.getElementById('binaurals-panel');
    if (!container) return;
    
    // Get brainwave ranges
    const brainwaveRanges = window.binauralPlayer.getBrainwaveRanges();
    if (!brainwaveRanges) return;
    
    // Create basic controls
    const basicControls = `
      <div class="binaural-controls">
        <h3>Binaural Beat Therapy</h3>
        <div class="binaural-status">
          <div class="status-item">
            <span>Active:</span>
            <span id="active-wave-display">None</span>
          </div>
          <div class="status-item">
            <span>Frequency:</span>
            <span id="binaural-freq-display">—</span>
          </div>
          <div class="status-item" id="sweep-progress" style="display:none;"></div>
        </div>
        
        <div class="binaural-buttons">
          ${Object.keys(brainwaveRanges).map(wave => `
            <button class="binaural-btn" data-wave="${wave}" title="${getBrainwaveTitle(wave)}">
              ${wave.charAt(0).toUpperCase() + wave.slice(1)}
            </button>
          `).join('')}
          <button class="binaural-btn stop-btn" data-wave="stop">Stop</button>
        </div>
        
        <div class="volume-control">
          <label for="binaurals-volume">Volume: <span id="binaurals-volume-value">20%</span></label>
          <input type="range" id="binaurals-volume" min="0" max="100" value="20">
        </div>
      </div>
    `;
    
    // Create advanced controls
    const advancedControls = `
      <div class="advanced-controls">
        <h4>Frequency Sweeps</h4>
        <div class="sweep-buttons">
          <button class="sweep-btn" data-start="beta" data-end="alpha" data-duration="300" 
                  title="Gradually transition from alert to relaxed state">
            Focus → Relax (5m)
          </button>
          <button class="sweep-btn" data-start="alpha" data-end="theta" data-duration="600"
                  title="Gradually transition from relaxed to meditation state">
            Relax → Meditate (10m)
          </button>
          <button class="sweep-btn" data-start="theta" data-end="delta" data-duration="900"
                  title="Gradually transition from meditation to deep sleep">
            Meditate → Sleep (15m)
          </button>
        </div>
        
        <h4>Custom Frequency</h4>
        <div class="custom-frequency">
          <div class="freq-slider-container">
            <input type="range" id="custom-frequency" min="0.5" max="40" step="0.1" value="10">
            <span id="custom-frequency-value">10.0 Hz</span>
          </div>
          <button id="apply-frequency">Apply</button>
        </div>
      </div>
      
      <div id="brainwave-info" class="brainwave-info">
        <!-- Populated by JavaScript -->
      </div>
    `;
    
    // Add the UI to the container
    container.innerHTML = basicControls + advancedControls;
    
    // Helper function for brainwave descriptions
    function getBrainwaveTitle(type) {
      const descriptions = {
        delta: "0.5-4Hz: Deep sleep, healing",
        theta: "4-8Hz: Meditation, creativity",
        alpha: "8-14Hz: Relaxed alertness",
        beta: "14-30Hz: Focus, alert thinking",
        gamma: "30-100Hz: Higher cognition"
      };
      
      return descriptions[type] || "";
    }
    
  } catch (error) {
    console.error('Error creating enhanced binaural UI:', error);
  }
}