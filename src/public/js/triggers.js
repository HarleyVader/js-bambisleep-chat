/**
 * Trigger system module for BambiSleep Chat
 * Handles activation of trigger words and audio playback
 */
window.triggerControls = (function() {
  // Private variables
  let triggerData = [];
  const audioCache = {};
  let audioLoadAttempts = {};
  const MAX_LOAD_ATTEMPTS = 2;
  let continuousPlaybackActive = false;
  let playbackSpeedFactor = 1.0;
  let playbackVolumeFactor = 1.0;
  
  // Static fallback trigger data if JSON fails to load
  const fallbackTriggerData = [
    { name: "BAMBI SLEEP", description: "Primary conditioning trigger for Bambi personality" },
    { name: "GOOD GIRL", description: "Makes you feel pleasure when obeying commands" },
    { name: "BAMBI RESET", description: "Resets Bambi to default programming state" },
    { name: "BIMBO DOLL", description: "Turns you into a mindless, giggly bimbo doll" },
    { name: "BAMBI FREEZE", description: "Locks you in place, unable to move" }
  ];
  
  // Initialize module
  function init() {
    // Load trigger data
    loadTriggerData();
    
    // Set up event listeners
    setupEventListeners();
    
    // Setup socket listener with delay to ensure socket is initialized
    setTimeout(setupSocketListener, 1000);
  }
  
  // Set up event listeners
  function setupEventListeners() {
    // Add event listener for the loop toggle
    const loopToggle = document.getElementById("loop-toggle");
    if (loopToggle) {
      loopToggle.addEventListener("change", handleLoopToggle);
    }
    
    // Add event listener for the play button
    const playButton = document.getElementById("play-playlist");
    if (playButton) {
      playButton.addEventListener("click", playRandomPlaylist);
    }
    
    // Add event listener for toggle all button
    const toggleAllButton = document.getElementById("toggle-all");
    if (toggleAllButton) {
      toggleAllButton.addEventListener("click", toggleAllToggles);
    }
    
    // Add a retry button for audio loading if we have error handler
    if (typeof window.errorHandler !== 'undefined') {
      const retryButton = document.getElementById('retry-audio');
      if (retryButton) {
        retryButton.addEventListener('click', handleRetryAudio);
      }
    }
    
    // Volume control
    const volumeSlider = document.getElementById('loop-volume');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', handleVolumeChange);
    }
    
    // Speed slider
    const speedSlider = document.getElementById('loop-speed');
    if (speedSlider) {
      speedSlider.addEventListener('input', handleSpeedChange);
    }
    
    // Setup trigger toggle listeners
    setupToggleListeners();
  }
  
  // Clean up event listeners
  function tearDown() {
    try {
      // Remove loop toggle listener
      const loopToggle = document.getElementById("loop-toggle");
      if (loopToggle) {
        loopToggle.removeEventListener("change", handleLoopToggle);
      }
      
      // Remove play button listener
      const playButton = document.getElementById("play-playlist");
      if (playButton) {
        playButton.removeEventListener("click", playRandomPlaylist);
      }
      
      // Remove toggle all button listener
      const toggleAllButton = document.getElementById("toggle-all");
      if (toggleAllButton) {
        toggleAllButton.removeEventListener("click", toggleAllToggles);
      }
      
      // Remove retry button listener
      if (typeof window.errorHandler !== 'undefined') {
        const retryButton = document.getElementById('retry-audio');
        if (retryButton) {
          retryButton.removeEventListener('click', handleRetryAudio);
        }
      }
      
      // Remove volume slider listener
      const volumeSlider = document.getElementById('loop-volume');
      if (volumeSlider) {
        volumeSlider.removeEventListener('input', handleVolumeChange);
      }
      
      // Remove speed slider listener
      const speedSlider = document.getElementById('loop-speed');
      if (speedSlider) {
        speedSlider.removeEventListener('input', handleSpeedChange);
      }
      
      // Remove toggle input listeners
      const toggleInputs = document.getElementsByClassName("toggle-input");
      for (let i = 0; i < toggleInputs.length; i++) {
        toggleInputs[i].removeEventListener("change", handleToggleChange);
      }
      
      // Remove socket listeners
      if (typeof socket !== "undefined") {
        socket.off("trigger:audio");
        socket.off("active-triggers");
      }
      
      // Stop continuous playback if active
      if (continuousPlaybackActive) {
        stopContinuousPlayback();
      }
      
      console.log('Triggers teardown complete');
    } catch (error) {
      console.error('Error during triggers teardown:', error);
    }
  }
  
  // Handle loop toggle change
  function handleLoopToggle() {
    if (this.checked) {
      playContinuousTriggers();
    } else {
      stopContinuousPlayback();
    }
  }
  
  // Handle retry audio button click
  function handleRetryAudio() {
    window.errorHandler.clearAllFailedResources();
    preloadSelectedAudio();
  }
  
  // Handle volume slider change
  function handleVolumeChange() {
    const volumeFactor = this.value / 10; // Convert 0-10 to 0-1 for volume
    const volumeValue = document.getElementById('volume-value');
    
    if (volumeValue) {
      volumeValue.textContent = Math.round(volumeFactor * 100) + '%';
    }
    
    // Update internal state
    playbackVolumeFactor = volumeFactor;
    
    // Store in central state
    if (window.bambiSystem) {
      window.bambiSystem.saveState('audio', {
        volume: volumeFactor
      });
    }
  }
  
  // Handle speed slider change
  function handleSpeedChange() {
    updateSpeedLabel(this.value);
    
    // Update internal state
    playbackSpeedFactor = getSpeedFactor(this.value);
    
    // Store in central state
    if (window.bambiSystem) {
      window.bambiSystem.saveState('audio', {
        speed: this.value,
        speedFactor: playbackSpeedFactor
      });
    }
  }
  
  // Load trigger data from JSON file with error handling
  function loadTriggerData() {
    fetch('/config/triggers.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load triggers.json: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        triggerData = data.triggers;
        createToggleButtons();
        preloadSelectedAudio();
      })
      .catch(error => {
        console.log('Error loading trigger data, using fallback:', error);
        
        // Use fallback trigger data
        triggerData = fallbackTriggerData;
        createToggleButtons();
        
        // Try loading from central state first
        if (window.bambiSystem) {
          const state = window.bambiSystem.getState('triggers');
          if (state && state.triggerData && state.triggerData.length > 0) {
            triggerData = state.triggerData;
            // Recreate buttons with loaded data
            createToggleButtons();
          }
        }
        // Fall back to localStorage if needed
        else {
          try {
            const storedTriggers = localStorage.getItem('bambiTriggers');
            if (storedTriggers) {
              const parsedTriggers = JSON.parse(storedTriggers);
              if (Array.isArray(parsedTriggers) && parsedTriggers.length > 0) {
                triggerData = parsedTriggers;
                // Recreate buttons with loaded data
                createToggleButtons();
              }
            }
          } catch (storageError) {
            console.log('Error loading triggers from localStorage:', storageError);
          }
        }
      });
  }
  
  // Create toggle buttons for each trigger
  function createToggleButtons() {
    const container = document.getElementById('trigger-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Check for active triggers from central state first
    let activeTriggerNames = [];
    
    if (window.bambiSystem) {
      const state = window.bambiSystem.getState('triggers');
      if (state && Array.isArray(state.activeTriggers)) {
        activeTriggerNames = state.activeTriggers;
      }
    }
    // Fall back to localStorage if needed
    else {
      try {
        const storedActiveTriggers = localStorage.getItem('bambiActiveTriggers');
        if (storedActiveTriggers) {
          activeTriggerNames = JSON.parse(storedActiveTriggers);
        }
      } catch (error) {
        console.log('Error loading active triggers from localStorage:', error);
      }
    }
    
    triggerData.forEach(trigger => {
      const toggleItem = document.createElement('div');
      toggleItem.className = 'trigger-toggle-item';
      
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'toggle-input';
      input.id = `trigger-${trigger.name.replace(/\s+/g, '-').toLowerCase()}`;
      input.dataset.triggerName = trigger.name;
      
      // Check the toggle if this trigger is active
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
    });
    
    // Setup toggle listeners
    setupToggleListeners();
  }
  
  // Update the toggle input event handler with bambiSystem integration
  function setupToggleListeners() {
    const toggleInputs = document.getElementsByClassName("toggle-input");
    
    for (let i = 0; i < toggleInputs.length; i++) {
      // Remove existing listener to avoid duplicates
      toggleInputs[i].removeEventListener("change", handleToggleChange);
      
      // Add change event listener
      toggleInputs[i].addEventListener("change", handleToggleChange);
    }
  }
  
  // Handle toggle input change
  function handleToggleChange() {
    // Don't handle loop toggle itself
    if (this.id === "loop-toggle") return;
    
    // Save toggle states
    saveToggleStatesToSystem();
    
    // If continuous playback is active, restart it with new selection
    if (continuousPlaybackActive) {
      // Stop current loop
      continuousPlaybackActive = false;
      
      // Brief delay before restarting with new selection
      setTimeout(() => {
        // Only restart if toggle is still checked
        const loopToggle = document.getElementById("loop-toggle");
        if (loopToggle && loopToggle.checked) {
          playContinuousTriggers();
        }
      }, 100);
    }
    
    // Load audio for newly checked trigger
    if (this.checked && this.dataset.triggerName) {
      const triggerName = this.dataset.triggerName;
      const trigger = triggerData.find(t => t.name === triggerName);
      loadTriggerAudio(trigger);
    }
  }
  
  // Save toggle states to central state system
  function saveToggleStatesToSystem() {
    const selectedTriggers = getSelectedTriggers();
    const triggerNames = selectedTriggers.map(t => t.name);
    
    // Create trigger descriptions object
    const triggerDescriptions = {};
    selectedTriggers.forEach(trigger => {
      if (trigger.description) {
        triggerDescriptions[trigger.name] = trigger.description;
      }
    });
    
    // Use bambiSystem for central state management
    if (window.bambiSystem) {
      window.bambiSystem.saveState('triggers', {
        activeTriggers: triggerNames,
        triggerDescriptions: triggerDescriptions,
        triggerData: triggerData
      });
      
      // Notify event listeners of state change
      document.dispatchEvent(new CustomEvent('trigger-state-changed', {
        detail: { activeTriggers: triggerNames }
      }));
    } 
    // Fall back to localStorage
    else {
      try {
        localStorage.setItem('bambiActiveTriggers', JSON.stringify(triggerNames));
        localStorage.setItem('bambiTriggerDescriptions', JSON.stringify(triggerDescriptions));
      } catch (error) {
        console.log('Error saving trigger selection to localStorage:', error);
      }
    }
    
    // Sync with other pages if the sync function exists
    if (typeof window.syncTriggersWithPages === 'function') {
      window.syncTriggersWithPages(triggerNames, triggerDescriptions);
    }
    
    // Send to server if socket is available
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
  
  // Helper function for speed label display
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
  
  // Helper function to convert slider value to speed factor
  function getSpeedFactor(value) {
    const speedVal = parseInt(value);
    if (speedVal === 5) return 1.0;
    if (speedVal < 5) return 1.0 + ((5 - speedVal) * 0.5); // Slower = higher number
    return 1.0 - ((speedVal - 5) * 0.1); // Faster = lower number
  }
  
  // Set up socket event listener if socket exists
  function setupSocketListener() {
    if (typeof socket !== "undefined") {
      // Clean up any existing listeners to avoid duplicates
      socket.off("trigger:audio");
      socket.off("active-triggers");
      
      // Add listener for trigger audio events
      socket.on("trigger:audio", (triggerName) => {
        if (!triggerName) return;
        activateTrigger(triggerName);
      });
      
      // Listen for active triggers from server/other tabs
      socket.on("active-triggers", (data) => {
        if (data && Array.isArray(data.activeTriggers)) {
          updateTriggerToggles(data.activeTriggers);
          
          // Update central state
          if (window.bambiSystem) {
            window.bambiSystem.saveState('triggers', {
              activeTriggers: data.activeTriggers
            });
          }
        }
      });
    }
  }
  
  // The rest of the functions from the original file go here
  // (loadTriggerAudio, playTriggerSound, displayTriggerText, etc.)
  
  // Using the existing API with a few additions
  return {
    init,
    tearDown,
    playTrigger: activateTrigger,
    playRandomPlaylist: playRandomPlaylist,
    startContinuousPlayback: playContinuousTriggers,
    stopContinuousPlayback: stopContinuousPlayback,
    updatePlaybackSpeed: updatePlaybackSpeed,
    updatePlaybackVolume: updatePlaybackVolume,
    getSelectedTriggers: getSelectedTriggers,
    loadTriggerAudio: loadTriggerAudio,
    getAllTriggers: () => triggerData,
    refreshTriggers: loadTriggerData
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.triggerControls.init);

// Add backward compatibility for code that might still use the old name
// This will be removed in a future version after all dependencies are updated
window.bambiTriggers = window.triggerControls;