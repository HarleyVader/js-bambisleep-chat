// Trigger controls module for managing trigger toggles

(function() {
  // Initialize trigger controls
  function init() {
    initTriggerList();
    initTriggerButtons();
    initAudioControls();
  }
  
  // Initialize trigger list
  function initTriggerList() {
    const triggerList = document.getElementById('trigger-list');
    
    // Clear any existing content to avoid duplicates
    if (triggerList) {
      triggerList.innerHTML = '';
      
      // Fetch triggers from the JSON file
      fetch('/config/triggers.json')
        .then(response => response.json())
        .then(data => {
          const triggers = data.triggers;
          var activeTriggers = [];
          
          // Get active triggers from profile data or localStorage
          if (typeof profileData !== 'undefined' && profileData.systemControls && profileData.systemControls.activeTriggers) {
            activeTriggers = profileData.systemControls.activeTriggers;
          } else {
            try {
              const storedTriggers = localStorage.getItem('bambiActiveTriggers');
              if (storedTriggers) {
                activeTriggers = JSON.parse(storedTriggers);
              }
            } catch (e) {}
          }
          
          triggers.forEach((trigger, index) => {
            var triggerItem = document.createElement('div');
            triggerItem.className = 'trigger-toggle-item';
            
            var toggle = document.createElement('input');
            toggle.type = 'checkbox';
            toggle.id = `toggle-${index}`;
            toggle.className = 'toggle-input';
            toggle.setAttribute('data-trigger', trigger.name);
            toggle.setAttribute('data-description', trigger.description || '');
            toggle.title = trigger.description || '';
            toggle.checked = activeTriggers.includes(trigger.name);
            
            toggle.addEventListener('change', function() {
              // Award XP when enabling a trigger
              if (toggle.checked && window.socket && window.socket.connected) {
                socket.emit('award-xp', {
                  username: document.body.getAttribute('data-username') || window.username,
                  amount: 3,
                  action: 'trigger_used'
                });
                
                // Play trigger sound if enabled
                if (toggle.checked) {
                  playTriggerSound(trigger.name);
                }
              }
              
              // Save and broadcast the change
              saveTriggerState();
              sendTriggerUpdate();
            });
            
            var label = document.createElement('label');
            label.htmlFor = `toggle-${index}`;
            label.className = 'toggle-label';
            label.textContent = trigger.name;
            label.title = trigger.description || '';
            
            triggerItem.appendChild(toggle);
            triggerItem.appendChild(label);
            triggerList.appendChild(triggerItem);
          });
          
          // Initial sync of trigger state
          sendTriggerUpdate();
          
          // Dispatch trigger controls loaded event
          document.dispatchEvent(new Event('trigger-controls-loaded'));
        })
        .catch(error => {
          console.log('Error loading triggers:', error);
          triggerList.innerHTML = '<p>Failed to load triggers. Please refresh the page.</p>';
        });
    }
  }
  
  // Initialize trigger control buttons
  function initTriggerButtons() {
    const selectAllBtn = document.getElementById('select-all-triggers');
    const clearAllBtn = document.getElementById('clear-all-triggers');
    const playBtn = document.getElementById('play-triggers');
    const activateAllBtn = document.getElementById('activate-all');
    
    if (activateAllBtn) {
      let allActive = false;
      activateAllBtn.addEventListener('click', function() {
        allActive = !allActive;
        document.querySelectorAll('.toggle-input').forEach(toggle => {
          toggle.checked = allActive;
        });
        saveTriggerState();
        sendTriggerUpdate();
      });
    }
    
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', function() {
        document.querySelectorAll('.toggle-input').forEach(toggle => {
          toggle.checked = true;
        });
        saveTriggerState();
        sendTriggerUpdate();
      });
    }
    
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', function() {
        document.querySelectorAll('.toggle-input').forEach(toggle => {
          toggle.checked = false;
        });
        saveTriggerState();
        sendTriggerUpdate();
      });
    }
    
    if (playBtn) {
      playBtn.addEventListener('click', playActiveTriggers);
    }
  }
  
  // Initialize audio controls
  function initAudioControls() {
    const playlistBtn = document.getElementById('play-playlist');
    const loopToggle = document.getElementById('loop-toggle');
    const speedSlider = document.getElementById('loop-speed');
    const volumeSlider = document.getElementById('loop-volume');
    
    if (playlistBtn) {
      playlistBtn.addEventListener('click', function() {
        playRandomPlaylist();
      });
    }
    
    if (loopToggle) {
      loopToggle.addEventListener('change', function() {
        if (this.checked) {
          startContinuousPlayback();
        } else {
          stopContinuousPlayback();
        }
      });
    }
    
    if (speedSlider) {
      const speedValue = document.getElementById('speed-value');
      speedSlider.addEventListener('input', function() {
        const value = this.value;
        updateSpeedLabel(value, speedValue);
        setPlaybackSpeed(value);
      });
      
      // Set initial value
      const initialSpeed = localStorage.getItem('bambiAudioSpeed') || 5;
      speedSlider.value = initialSpeed;
      updateSpeedLabel(initialSpeed, speedValue);
    }
    
    if (volumeSlider) {
      const volumeValue = document.getElementById('volume-value');
      volumeSlider.addEventListener('input', function() {
        const value = this.value / 10; // Convert to 0-1 range
        updateVolumeLabel(value, volumeValue);
        setPlaybackVolume(value);
      });
      
      // Set initial value
      const initialVolume = localStorage.getItem('bambiAudioVolume') || 0.8;
      volumeSlider.value = initialVolume * 10;
      updateVolumeLabel(initialVolume, volumeValue);
    }
  }
  
  // Helper functions for audio controls
  function updateSpeedLabel(value, element) {
    if (!element) return;
    
    const speedVal = parseInt(value);
    if (speedVal === 5) {
      element.textContent = 'Normal';
    } else if (speedVal < 5) {
      element.textContent = 'Slower ' + (5 - speedVal) + 'x';
    } else {
      element.textContent = 'Faster ' + (speedVal - 5) + 'x';
    }
  }
  
  function updateVolumeLabel(value, element) {
    if (!element) return;
    element.textContent = Math.round(value * 100) + '%';
  }
  
  function setPlaybackSpeed(value) {
    const speedFactor = getSpeedFactor(value);
    localStorage.setItem('bambiAudioSpeed', value);
    
    if (window.bambiAudio && typeof window.bambiAudio.updatePlaybackSpeed === 'function') {
      window.bambiAudio.updatePlaybackSpeed(speedFactor);
    }
  }
  
  function getSpeedFactor(value) {
    const speedVal = parseInt(value);
    if (speedVal === 5) return 1.0;
    if (speedVal < 5) return 1.0 + ((5 - speedVal) * 0.5); // Slower = higher number
    return 1.0 - ((speedVal - 5) * 0.1); // Faster = lower number
  }
  
  function setPlaybackVolume(value) {
    localStorage.setItem('bambiAudioVolume', value);
    
    if (window.bambiAudio && typeof window.bambiAudio.updatePlaybackVolume === 'function') {
      window.bambiAudio.updatePlaybackVolume(value);
    }
  }
  
  // Save trigger state to profile
  function saveTriggerState() {
    var username = document.body.getAttribute('data-username') || window.username;
    if (!username) return;
    
    var activeTriggers = [];
    document.querySelectorAll('.toggle-input:checked').forEach(input => {
      activeTriggers.push(input.getAttribute('data-trigger'));
    });
    
    // Update profile via socket or fetch
    if (window.socket && window.socket.connected) {
      socket.emit('update-system-controls', {
        username: username,
        activeTriggers: activeTriggers
      });
    } else {
      fetch(`/profile/${username}/system-controls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeTriggers: activeTriggers })
      });
    }
  }
  
  // Send trigger info to LMStudio worker
  function sendTriggerUpdate() {
    const activeTriggers = Array.from(document.querySelectorAll('.toggle-input:checked')).map(toggle => ({
      name: toggle.getAttribute('data-trigger'),
      description: toggle.getAttribute('data-description') || ''
    })).filter(t => t.name);
    
    // Save to localStorage
    try {
      localStorage.setItem('bambiActiveTriggers', JSON.stringify(activeTriggers.map(t => t.name)));
    } catch(e) {}
    
    // Send to worker via socket
    if (window.socket && window.socket.connected) {
      socket.emit('triggers', {
        triggerNames: activeTriggers.map(t => t.name).join(','),
        triggerDetails: activeTriggers
      });
    }
    
    // Notify other components
    document.dispatchEvent(new CustomEvent('system-control-loaded', {
      detail: {
        type: 'triggers',
        activeTriggers: activeTriggers.map(t => t.name)
      }
    }));
  }
  
  // Play all active triggers in sequence
  function playActiveTriggers() {
    const activeTriggers = Array.from(document.querySelectorAll('.toggle-input:checked')).map(toggle => ({
      name: toggle.getAttribute('data-trigger'),
      description: toggle.getAttribute('data-description') || ''
    })).filter(t => t.name);
    
    if (activeTriggers.length === 0) {
      console.log("No triggers selected");
      return;
    }
    
    playRandomPlaylist();
  }
  
  // Play a random playlist of selected triggers
  function playRandomPlaylist() {
    const activeTriggers = getSelectedTriggers();
    
    if (activeTriggers.length === 0) {
      console.log("No triggers selected");
      return;
    }
    
    // Shuffle the triggers
    const shuffledTriggers = [...activeTriggers].sort(() => Math.random() - 0.5);
    
    // Play each trigger one by one
    let index = 0;
    const playNext = () => {
      if (index >= shuffledTriggers.length) return;
      
      const trigger = shuffledTriggers[index++];
      playTriggerSound(trigger.name, () => {
        // Wait a bit before playing the next one
        setTimeout(playNext, 500);
      });
    };
    
    // Start playing
    playNext();
    
    // Send to server if socket is available
    if (window.socket && window.socket.connected) {
      socket.emit('triggers', {
        triggerNames: shuffledTriggers.map(t => t.name).join(','),
        triggerDetails: shuffledTriggers
      });
    }
  }
  
  // Get selected triggers
  function getSelectedTriggers() {
    return Array.from(document.querySelectorAll('.toggle-input:checked'))
      .map(toggle => ({
        name: toggle.getAttribute('data-trigger'),
        description: toggle.getAttribute('data-description') || ''
      }))
      .filter(t => t.name);
  }
  
  // Play sound for a specific trigger
  function playTriggerSound(triggerName, callback) {
    // Use bambiAudio system if available
    if (window.bambiAudio && typeof window.bambiAudio.playTrigger === 'function') {
      window.bambiAudio.playTrigger(triggerName);
      if (callback) setTimeout(callback, 2000);
      return;
    }
    
    // Use window.playTriggerSound function if available
    if (window.playTriggerSound && typeof window.playTriggerSound === 'function') {
      window.playTriggerSound(triggerName);
      if (callback) setTimeout(callback, 2000);
      return;
    }
    
    // Fallback to direct audio playback
    const filename = triggerName.replace(/\s+/g, '-').toLowerCase() + '.mp3';
    const audio = new Audio(`/audio/triggers/${filename}`);
    
    // Apply volume from settings
    try {
      const volume = localStorage.getItem('bambiAudioVolume') || 0.8;
      audio.volume = parseFloat(volume);
    } catch (e) {
      audio.volume = 0.8;
    }
    
    // Add callback for when audio ends
    if (callback) {
      audio.onended = callback;
    }
    
    // Handle error by trying alternate path
    audio.onerror = () => {
      console.log(`Could not load trigger from /audio/triggers/${filename}, trying alternate path`);
      audio.src = `/audio/${filename}`;
      
      audio.onerror = () => {
        console.log(`Could not load trigger from /audio/${filename} either`);
        if (callback) callback();
      };
      
      audio.play().catch(err => {
        console.log('Could not play trigger:', err.message);
        if (callback) callback();
      });
    };
    
    // Play the audio
    audio.play().catch(err => {
      console.log('Could not play trigger:', err.message);
      if (callback) callback();
    });
    
    // Flash trigger name on screen
    const eye = document.getElementById('eye');
    if (eye) {
      const triggerSpan = document.createElement('span');
      triggerSpan.textContent = triggerName;
      eye.innerHTML = '';
      eye.appendChild(triggerSpan);
      
      setTimeout(() => {
        eye.innerHTML = '';
      }, 2000);
    }
  }
  
  // Start continuous playback
  let continuousPlaybackActive = false;
  
  function startContinuousPlayback() {
    if (continuousPlaybackActive) return;
    
    const selectedTriggers = getSelectedTriggers();
    if (selectedTriggers.length === 0) {
      // Uncheck the loop toggle if no triggers selected
      const loopToggle = document.getElementById('loop-toggle');
      if (loopToggle) loopToggle.checked = false;
      return;
    }
    
    continuousPlaybackActive = true;
    
    // Function to run continuous playback loop
    function playbackLoop() {
      if (!continuousPlaybackActive) return;
      
      // Get current selected triggers
      const currentTriggers = getSelectedTriggers();
      if (currentTriggers.length === 0) {
        stopContinuousPlayback();
        return;
      }
      
      // Shuffle the triggers
      const shuffledTriggers = [...currentTriggers].sort(() => Math.random() - 0.5);
      
      // Play a random trigger
      const randomIndex = Math.floor(Math.random() * shuffledTriggers.length);
      const trigger = shuffledTriggers[randomIndex];
      
      // Play it
      playTriggerSound(trigger.name, () => {
        // Wait a bit then continue loop if still active
        if (continuousPlaybackActive) {
          // Get speed setting to adjust delay
          const speedSetting = localStorage.getItem('bambiAudioSpeed') || 5;
          const speedFactor = getSpeedFactor(speedSetting);
          const delay = 2000 / speedFactor;
          
          setTimeout(playbackLoop, delay);
        }
      });
    }
    
    // Start the loop
    playbackLoop();
  }
  
  function stopContinuousPlayback() {
    continuousPlaybackActive = false;
    
    // Uncheck the loop toggle
    const loopToggle = document.getElementById('loop-toggle');
    if (loopToggle) loopToggle.checked = false;
  }
  
  // Export functions
  window.bambiTriggers = {
    init,
    saveTriggerState,
    sendTriggerUpdate,
    playActiveTriggers,
    playTriggerSound,
    playRandomPlaylist,
    startContinuousPlayback,
    stopContinuousPlayback,
    setPlaybackSpeed,
    setPlaybackVolume
  };
  
  // Auto-initialize on load
  document.addEventListener('DOMContentLoaded', init);
})();