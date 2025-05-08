/**
 * Unified trigger system module for BambiSleep Chat
 * Handles trigger management, activation and audio playback
 */
window.triggerSystem = (function() {
  // Private variables
  let triggerData = [];
  const audioCache = {};
  let audioLoadAttempts = {};
  const MAX_LOAD_ATTEMPTS = 2;
  let continuousPlaybackActive = false;
  let playbackSpeedFactor = 1.0;
  let playbackVolumeFactor = 1.0;
  
  // Static fallback trigger data
  const fallbackTriggerData = [
    { name: "BAMBI SLEEP", description: "Primary conditioning trigger for Bambi personality" },
    { name: "GOOD GIRL", description: "Makes you feel pleasure when obeying commands" },
    { name: "BAMBI RESET", description: "Resets Bambi to default programming state" },
    { name: "BIMBO DOLL", description: "Turns you into a mindless, giggly bimbo doll" },
    { name: "BAMBI FREEZE", description: "Locks you in place, unable to move" }
  ];
  
  // Initialize module
  function init() {
    loadTriggerData();
    setupEventListeners();
    setTimeout(setupSocketListener, 1000);
  }
  
  // Set up event listeners
  function setupEventListeners() {
    // Loop toggle
    const loopToggle = document.getElementById("loop-toggle");
    if (loopToggle) loopToggle.addEventListener("change", handleLoopToggle);
    
    // Play button
    const playButton = document.getElementById("play-playlist");
    if (playButton) playButton.addEventListener("click", playRandomTrigger);
    
    // Toggle all button
    const toggleAllButton = document.getElementById("toggle-all");
    if (toggleAllButton) toggleAllButton.addEventListener("click", toggleAllTriggers);
    
    // Volume control
    const volumeSlider = document.getElementById('loop-volume');
    if (volumeSlider) volumeSlider.addEventListener('input', handleVolumeChange);
    
    // Speed slider
    const speedSlider = document.getElementById('loop-speed');
    if (speedSlider) speedSlider.addEventListener('input', handleSpeedChange);
    
    // Listen for system updates
    document.addEventListener('system-update', handleSystemUpdate);
  }
  
  // Clean up event listeners
  function tearDown() {
    try {
      // Remove UI control listeners
      const loopToggle = document.getElementById("loop-toggle");
      if (loopToggle) loopToggle.removeEventListener("change", handleLoopToggle);
      
      const playButton = document.getElementById("play-playlist");
      if (playButton) playButton.removeEventListener("click", playRandomTrigger);
      
      const toggleAllButton = document.getElementById("toggle-all");
      if (toggleAllButton) toggleAllButton.removeEventListener("click", toggleAllTriggers);
      
      const volumeSlider = document.getElementById('loop-volume');
      if (volumeSlider) volumeSlider.removeEventListener('input', handleVolumeChange);
      
      const speedSlider = document.getElementById('loop-speed');
      if (speedSlider) speedSlider.removeEventListener('input', handleSpeedChange);
      
      // Remove toggle listeners
      document.querySelectorAll('.toggle-input').forEach(toggle => {
        toggle.removeEventListener("change", handleTriggerToggle);
      });
      
      // Remove socket listeners
      if (window.socket) {
        window.socket.off("trigger:audio");
        window.socket.off("active-triggers");
      }
      
      // Stop continuous playback if active
      if (continuousPlaybackActive) {
        stopContinuousPlayback();
      }
      
      // Remove system update listener
      document.removeEventListener('system-update', handleSystemUpdate);
    } catch (error) {
      console.error('Error during trigger teardown:', error);
    }
  }
  
  // Handle system state updates
  function handleSystemUpdate(event) {
    if (event.detail && (event.detail.section === 'triggers' || event.detail.section === 'all')) {
      loadSavedTriggers();
    }
  }
  
  // Handle loop toggle change
  function handleLoopToggle() {
    if (this.checked) {
      startContinuousPlayback();
    } else {
      stopContinuousPlayback();
    }
  }
  
  // Handle volume slider change
  function handleVolumeChange() {
    const volumeFactor = this.value / 10;
    const volumeValue = document.getElementById('volume-value');
    
    if (volumeValue) {
      volumeValue.textContent = Math.round(volumeFactor * 100) + '%';
    }
    
    // Update internal state
    playbackVolumeFactor = volumeFactor;
    
    // Save in central state
    if (window.bambiSystem) {
      window.bambiSystem.saveState('audio', { volume: volumeFactor });
    }
  }
  
  // Handle speed slider change
  function handleSpeedChange() {
    updateSpeedLabel(this.value);
    playbackSpeedFactor = getSpeedFactor(this.value);
    
    // Save in central state
    if (window.bambiSystem) {
      window.bambiSystem.saveState('audio', {
        speed: this.value,
        speedFactor: playbackSpeedFactor
      });
    }
  }
  
  // Load trigger data from server
  function loadTriggerData() {
    fetch('/config/triggers.json')
      .then(response => {
        if (!response.ok) throw new Error(`Failed to load triggers.json: ${response.status}`);
        return response.json();
      })
      .then(data => {
        triggerData = data.triggers;
        createTriggerToggles();
        preloadSelectedAudio();
      })
      .catch(error => {
        console.log('Error loading trigger data, using fallback:', error);
        triggerData = fallbackTriggerData;
        createTriggerToggles();
        
        // Try to load from central state
        if (window.bambiSystem) {
          const state = window.bambiSystem.getState('triggers');
          if (state && state.triggerData && state.triggerData.length > 0) {
            triggerData = state.triggerData;
            createTriggerToggles();
          }
        }
      });
  }
  
  // Create trigger toggle buttons
  function createTriggerToggles() {
    const container = document.getElementById('trigger-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Get active triggers from state
    let activeTriggerNames = [];
    if (window.bambiSystem) {
      const state = window.bambiSystem.getState('triggers');
      if (state && Array.isArray(state.activeTriggers)) {
        activeTriggerNames = state.activeTriggers;
      }
    }
    
    // Create toggle for each trigger
    triggerData.forEach(trigger => {
      const toggleItem = document.createElement('div');
      toggleItem.className = 'trigger-toggle-item';
      
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'toggle-input';
      input.id = `trigger-${trigger.name.replace(/\s+/g, '-').toLowerCase()}`;
      input.dataset.triggerName = trigger.name;
      
      // Check if active
      if (Array.isArray(activeTriggerNames) && activeTriggerNames.includes(trigger.name)) {
        input.checked = true;
      }
      
      const label = document.createElement('label');
      label.className = 'toggle-label';
      label.htmlFor = input.id;
      label.textContent = trigger.name;
      label.title = trigger.description || '';
      
      toggleItem.appendChild(input);
      toggleItem.appendChild(label);
      container.appendChild(toggleItem);
      
      // Add event listener
      input.addEventListener('change', handleTriggerToggle);
    });
    
    // Notify that trigger controls are ready
    document.dispatchEvent(new CustomEvent('trigger-controls-loaded'));
  }
  
  // Handle trigger toggle change
  function handleTriggerToggle() {
    // Don't handle loop toggle itself
    if (this.id === "loop-toggle") return;
    
    // Save toggle states
    saveToggleState();
    
    // Restart continuous playback if active
    if (continuousPlaybackActive) {
      continuousPlaybackActive = false;
      
      setTimeout(() => {
        const loopToggle = document.getElementById("loop-toggle");
        if (loopToggle && loopToggle.checked) {
          startContinuousPlayback();
        }
      }, 100);
    }
    
    // Preload audio if newly checked
    if (this.checked && this.dataset.triggerName) {
      const triggerName = this.dataset.triggerName;
      const trigger = triggerData.find(t => t.name === triggerName);
      if (trigger) preloadTriggerAudio(trigger);
    }
    
    // Award XP if checked
    if (this.checked) awardTriggerXp();
  }
  
  // Award XP for trigger activation
  function awardTriggerXp() {
    if (!window.socket || !window.socket.connected) return;
    
    // Amount increases with multiple active triggers
    const activeCount = document.querySelectorAll('.toggle-input:checked').length;
    const amount = Math.min(3 + activeCount, 10); // Base 3 XP + 1 per trigger, max 10
    
    window.socket.emit('client-award-xp', {
      action: 'trigger-activation',
      amount: amount,
      timestamp: Date.now()
    });
  }
  
  // Save trigger toggle state
  function saveToggleState() {
    const selectedTriggers = getSelectedTriggers();
    const triggerNames = selectedTriggers.map(t => t.name);
    
    // Save to central state
    if (window.bambiSystem) {
      window.bambiSystem.saveState('triggers', {
        activeTriggers: triggerNames,
        triggerData: triggerData
      });
    }
    
    // Notify listeners
    document.dispatchEvent(new CustomEvent('trigger-state-changed', {
      detail: { activeTriggers: triggerNames }
    }));
    
    // Sync with server
    if (window.socket && window.socket.connected) {
      window.socket.emit('active-triggers', {
        activeTriggers: triggerNames,
        triggerDetails: selectedTriggers.map(t => ({
          name: t.name,
          description: t.description || ''
        }))
      });
    }
  }
  
  // Get selected triggers
  function getSelectedTriggers() {
    const selectedTriggers = [];
    
    document.querySelectorAll('.toggle-input:checked').forEach(toggle => {
      if (toggle.dataset.triggerName) {
        const triggerName = toggle.dataset.triggerName;
        const trigger = triggerData.find(t => t.name === triggerName);
        if (trigger) selectedTriggers.push(trigger);
      }
    });
    
    return selectedTriggers;
  }
  
  // Activate a trigger by name
  function activateTrigger(triggerName) {
    try {
      // Find the trigger in our data
      const trigger = triggerData.find(t => t.name === triggerName);
      if (!trigger) {
        console.log(`Trigger not found: ${triggerName}`);
        return;
      }
      
      // Play the trigger audio
      playTriggerAudio(trigger);
      
      // Display the trigger text
      displayTriggerText(trigger.name);
      
      // Award XP for activation
      if (window.socket && window.socket.connected) {
        window.socket.emit('client-award-xp', {
          action: 'trigger-activated',
          trigger: triggerName,
          amount: 5,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error activating trigger:', error);
    }
  }
  
  // Play trigger audio
  function playTriggerAudio(trigger) {
    if (!trigger || !trigger.name) return;
    
    const triggerName = trigger.name;
    const audioSrc = `/audio/triggers/${triggerName.replace(/\s+/g, '-')}.mp3`;
    
    // Use global audio player if available
    if (window.audioPlayer && typeof window.audioPlayer.play === 'function') {
      window.audioPlayer.play(audioSrc);
      return;
    }
    
    // Fallback to basic audio
    const audio = audioCache[triggerName] || new Audio(audioSrc);
    audio.volume = playbackVolumeFactor;
    
    // Cache for future use
    if (!audioCache[triggerName]) {
      audioCache[triggerName] = audio;
    }
    
    audio.play().catch(err => {
      console.error(`Error playing audio for trigger ${triggerName}:`, err);
    });
  }
  
  // Preload audio for a trigger
  function preloadTriggerAudio(trigger) {
    if (!trigger || !trigger.name) return;
    
    const triggerName = trigger.name;
    
    // Skip if already cached or too many attempts
    if (audioCache[triggerName]) return;
    if (audioLoadAttempts[triggerName] && audioLoadAttempts[triggerName] >= MAX_LOAD_ATTEMPTS) return;
    
    const audioSrc = `/audio/triggers/${triggerName.replace(/\s+/g, '-')}.mp3`;
    const audio = new Audio();
    
    // Track load attempts
    audioLoadAttempts[triggerName] = (audioLoadAttempts[triggerName] || 0) + 1;
    
    // Setup event handlers
    audio.addEventListener('canplaythrough', () => {
      audioCache[triggerName] = audio;
      console.log(`Loaded audio for trigger: ${triggerName}`);
    });
    
    audio.addEventListener('error', () => {
      console.error(`Error loading audio for trigger ${triggerName}`);
    });
    
    // Start loading
    audio.src = audioSrc;
    audio.preload = 'auto';
  }
  
  // Display trigger text in UI
  function displayTriggerText(triggerName) {
    const triggerDisplay = document.getElementById('trigger-display');
    if (!triggerDisplay) return;
    
    triggerDisplay.textContent = triggerName;
    triggerDisplay.classList.add('active');
    
    setTimeout(() => {
      triggerDisplay.classList.remove('active');
    }, 3000);
  }
  
  // Toggle all triggers
  function toggleAllTriggers() {
    const toggles = document.querySelectorAll('.toggle-input');
    
    // Check if any are selected
    const anySelected = Array.from(toggles).some(t => t.checked);
    
    // Set all to opposite state
    toggles.forEach(toggle => {
      toggle.checked = !anySelected;
    });
    
    saveToggleState();
  }
  
  // Play a random trigger from selected ones
  function playRandomTrigger() {
    const selectedTriggers = getSelectedTriggers();
    
    if (selectedTriggers.length === 0) {
      alert("Please select at least one trigger first");
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * selectedTriggers.length);
    activateTrigger(selectedTriggers[randomIndex].name);
  }
  
  // Start continuous playback
  function startContinuousPlayback() {
    const selectedTriggers = getSelectedTriggers();
    
    if (selectedTriggers.length === 0) {
      alert("Please select at least one trigger first");
      const loopToggle = document.getElementById("loop-toggle");
      if (loopToggle) loopToggle.checked = false;
      return;
    }
    
    continuousPlaybackActive = true;
    playNextTrigger();
  }
  
  // Play next trigger in continuous mode
  function playNextTrigger() {
    if (!continuousPlaybackActive) return;
    
    const selectedTriggers = getSelectedTriggers();
    
    if (selectedTriggers.length === 0) {
      stopContinuousPlayback();
      return;
    }
    
    // Pick random trigger
    const randomIndex = Math.floor(Math.random() * selectedTriggers.length);
    const randomTrigger = selectedTriggers[randomIndex];
    
    // Play it
    playTriggerAudio(randomTrigger);
    displayTriggerText(randomTrigger.name);
    
    // Schedule next based on speed
    const baseDelay = 10000; // 10 seconds between triggers
    const delay = baseDelay * playbackSpeedFactor;
    
    setTimeout(playNextTrigger, delay);
  }
  
  // Stop continuous playback
  function stopContinuousPlayback() {
    continuousPlaybackActive = false;
  }
  
  // Preload audio for all selected triggers
  function preloadSelectedAudio() {
    getSelectedTriggers().forEach(trigger => {
      preloadTriggerAudio(trigger);
    });
  }
  
  // Helper for speed label display
  function updateSpeedLabel(value) {
    const speedValue = document.getElementById('speed-value');
    if (!speedValue) return;
    
    const speedVal = parseInt(value);
    if (speedVal === 5) {
      speedValue.textContent = 'Normal';
    } else if (speedVal < 5) {
      speedValue.textContent = 'Slower ' + (5 - speedVal) + 'x';
    } else {
      speedValue.textContent = 'Faster ' + (speedVal - 5) + 'x';
    }
  }
  
  // Convert slider value to speed factor
  function getSpeedFactor(value) {
    const speedVal = parseInt(value);
    if (speedVal === 5) return 1.0;
    if (speedVal < 5) return 1.0 + ((5 - speedVal) * 0.5); // Slower = higher number
    return 1.0 - ((speedVal - 5) * 0.1); // Faster = lower number
  }
  
  // Load saved triggers from central state
  function loadSavedTriggers() {
    if (!window.bambiSystem) return;
    
    const settings = window.bambiSystem.getState('triggers');
    if (!settings || !settings.activeTriggers) return;
    
    document.querySelectorAll('.toggle-input').forEach(toggle => {
      const name = toggle.dataset.triggerName;
      if (name && settings.activeTriggers.includes(name)) {
        toggle.checked = true;
      } else {
        toggle.checked = false;
      }
    });
  }
  
  // Set up socket event listeners
  function setupSocketListener() {
    if (!window.socket) return;
    
    // Clean up existing listeners
    window.socket.off("trigger:audio");
    window.socket.off("active-triggers");
    
    // Listen for trigger activation from server
    window.socket.on("trigger:audio", (triggerName) => {
      if (triggerName) activateTrigger(triggerName);
    });
    
    // Listen for active triggers from server
    window.socket.on("active-triggers", (data) => {
      if (data && Array.isArray(data.activeTriggers)) {
        // Update toggles
        document.querySelectorAll('.toggle-input').forEach(toggle => {
          const name = toggle.dataset.triggerName;
          if (name) {
            toggle.checked = data.activeTriggers.includes(name);
          }
        });
        
        // Update central state
        if (window.bambiSystem) {
          window.bambiSystem.saveState('triggers', {
            activeTriggers: data.activeTriggers
          });
        }
      }
    });
  }
  
  // Public API
  return {
    init,
    tearDown,
    activateTrigger,
    playRandomTrigger,
    startContinuousPlayback,
    stopContinuousPlayback,
    getSelectedTriggers,
    toggleAllTriggers,
    
    // For backward compatibility
    playTrigger: activateTrigger,
    playRandomPlaylist: playRandomTrigger
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.triggerSystem.init);

// For backward compatibility
window.triggerControls = window.triggerSystem;
window.bambiTriggers = window.triggerSystem;