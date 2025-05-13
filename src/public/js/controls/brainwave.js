// Brainwave controls for binaural beats
document.addEventListener('DOMContentLoaded', function() {
  // Audio context and oscillators
  let audioCtx = null;
  let leftOsc = null;
  let rightOsc = null;
  let gainNode = null;
  let isPlaying = false;
  
  // DOM Elements
  const enableToggle = document.getElementById('brainwave-enable');
  const modeSelect = document.getElementById('brainwave-mode');
  const customFreqSlider = document.getElementById('custom-frequency');
  const customFreqValue = document.getElementById('custom-frequency-value');
  const carrierFreqSlider = document.getElementById('carrier-frequency');
  const carrierFreqValue = document.getElementById('carrier-frequency-value');
  const volumeSlider = document.getElementById('brainwave-volume');
  const volumeValue = document.getElementById('brainwave-volume-value');
  const playBtn = document.getElementById('play-brainwave');
  const stopBtn = document.getElementById('stop-brainwave');
  const saveBtn = document.getElementById('save-brainwave');
  const freqDescription = document.getElementById('frequency-description');
  const customFreqContainer = document.getElementById('custom-freq-container');
  
  // Skip if no brainwave panel
  if (!playBtn || !modeSelect) return;
  
  // Frequency presets
  const frequencies = {
    alpha: 10,  // 8-14Hz - Relaxed focus
    theta: 6,   // 4-8Hz - Deep trance
    delta: 2,   // 1-4Hz - Sleep state
    beta: 20    // 14-30Hz - Alert state
  };
  
  // Descriptions
  const descriptions = {
    alpha: "Alpha waves (8-14Hz) promote relaxed focus and are ideal for gentle trance states.",
    theta: "Theta waves (4-8Hz) induce deep trance and meditation states, enhancing suggestibility.",
    delta: "Delta waves (1-4Hz) are associated with deep sleep and unconscious mind programming.",
    beta: "Beta waves (14-30Hz) create an alert, focused state and can help with mental clarity.",
    custom: "Custom frequency allows precise tuning of brainwave entrainment effects."
  };
  
  // Initialize
  function init() {
    loadSettings();
    setupListeners();
  }
  
  // Load saved settings
  function loadSettings() {
    if (window.bambiSystem?.state?.brainwaves) {
      const settings = window.bambiSystem.state.brainwaves;
      
      // Update UI
      if (enableToggle) enableToggle.checked = settings.enabled;
      if (modeSelect) modeSelect.value = settings.mode || 'alpha';
      if (customFreqSlider) customFreqSlider.value = settings.frequency || 10;
      if (carrierFreqSlider) carrierFreqSlider.value = settings.carrier || 200;
      if (volumeSlider) volumeSlider.value = settings.volume || 50;
      
      // Update displays
      if (customFreqValue) customFreqValue.textContent = (settings.frequency || 10) + ' Hz';
      if (carrierFreqValue) carrierFreqValue.textContent = (settings.carrier || 200) + ' Hz';
      if (volumeValue) volumeValue.textContent = (settings.volume || 50) + '%';
      
      // Update description
      if (freqDescription) {
        freqDescription.textContent = descriptions[settings.mode] || descriptions.alpha;
      }
      
      // Show/hide custom frequency
      if (customFreqContainer) {
        customFreqContainer.style.display = settings.mode === 'custom' ? '' : 'none';
      }
    }
  }
  
  // Setup event listeners
  function setupListeners() {
    // Mode selection
    if (modeSelect) {
      modeSelect.addEventListener('change', function() {
        const mode = this.value;
        
        // Toggle custom frequency input
        if (customFreqContainer) {
          customFreqContainer.style.display = mode === 'custom' ? '' : 'none';
        }
        
        // Update description
        if (freqDescription) {
          freqDescription.textContent = descriptions[mode] || descriptions.custom;
        }
        
        // Update audio if playing
        if (isPlaying) {
          updateBinaural();
        }
      });
    }
    
    // Frequency sliders
    if (customFreqSlider) {
      customFreqSlider.addEventListener('input', function() {
        if (customFreqValue) customFreqValue.textContent = this.value + ' Hz';
        if (isPlaying) updateBinaural();
      });
    }
    
    if (carrierFreqSlider) {
      carrierFreqSlider.addEventListener('input', function() {
        if (carrierFreqValue) carrierFreqValue.textContent = this.value + ' Hz';
        if (isPlaying) updateBinaural();
      });
    }
    
    // Volume slider
    if (volumeSlider) {
      volumeSlider.addEventListener('input', function() {
        if (volumeValue) volumeValue.textContent = this.value + '%';
        if (gainNode) gainNode.gain.value = this.value / 100;
      });
    }
    
    // Play button
    if (playBtn) {
      playBtn.addEventListener('click', playBinaural);
    }
    
    // Stop button
    if (stopBtn) {
      stopBtn.addEventListener('click', stopBinaural);
    }
    
    // Save button
    if (saveBtn) {
      saveBtn.addEventListener('click', saveSettings);
    }
  }
  
  // Play binaural beat
  function playBinaural() {
    if (isPlaying) return;
    
    try {
      // Create audio context
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create gain node
      gainNode = audioCtx.createGain();
      gainNode.gain.value = volumeSlider.value / 100;
      gainNode.connect(audioCtx.destination);
      
      // Create oscillators
      leftOsc = audioCtx.createOscillator();
      rightOsc = audioCtx.createOscillator();
      
      // Create stereo channel merger
      const merger = audioCtx.createChannelMerger(2);
      
      // Connect oscillators to channels
      leftOsc.connect(merger, 0, 0);  // Left channel
      rightOsc.connect(merger, 0, 1); // Right channel
      merger.connect(gainNode);
      
      // Set frequencies
      updateBinaural();
      
      // Start oscillators
      leftOsc.start();
      rightOsc.start();
      
      // Update UI
      isPlaying = true;
      playBtn.disabled = true;
      stopBtn.disabled = false;
      
      showMessage("Binaural beats playing");
    } catch (error) {
      console.error('Error starting binaural beat:', error);
      showMessage("Failed to start audio", true);
    }
  }
  
  // Stop playback
  function stopBinaural() {
    if (!isPlaying) return;
    
    try {
      leftOsc.stop();
      rightOsc.stop();
      
      leftOsc = null;
      rightOsc = null;
      
      isPlaying = false;
      playBtn.disabled = false;
      stopBtn.disabled = true;
      
      showMessage("Binaural beats stopped");
    } catch (error) {
      console.error('Error stopping binaural beat:', error);
    }
  }
  
  // Update binaural frequencies
  function updateBinaural() {
    if (!leftOsc || !rightOsc) return;
    
    const mode = modeSelect.value;
    let frequency = 0;
    
    if (mode === 'custom') {
      frequency = parseFloat(customFreqSlider.value);
    } else {
      frequency = frequencies[mode] || 10;
    }
    
    const carrier = parseFloat(carrierFreqSlider.value);
    
    // Set frequencies
    leftOsc.frequency.value = carrier;
    rightOsc.frequency.value = carrier + frequency;
  }
  
  // Save settings
  function saveSettings() {
    const settings = {
      enabled: enableToggle.checked,
      mode: modeSelect.value,
      frequency: parseFloat(customFreqSlider.value),
      carrier: parseFloat(carrierFreqSlider.value),
      volume: parseInt(volumeSlider.value)
    };
    
    if (window.bambiSystem?.saveState) {
      window.bambiSystem.saveState('brainwaves', settings);
      showMessage("Brainwave settings saved");
    }
  }
  
  // Show message
  function showMessage(message, isError) {
    const notification = document.createElement('div');
    notification.className = 'notification' + (isError ? ' error' : '');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 15px';
    notification.style.background = isError ? '#ff3366' : '#0088ff';
    notification.style.color = 'white';
    notification.style.borderRadius = '4px';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.style.opacity = '1', 10);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', function() {
    if (isPlaying) stopBinaural();
  });
  
  // Start initialization
  init();
  
  // Notify system
  document.dispatchEvent(new CustomEvent('brainwaves-loaded'));
});