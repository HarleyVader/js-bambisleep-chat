let triggerData = []; // Will hold the data from triggers.json
const audioCache = {};

const textElements = [
  document.getElementById("eyeCursorText"),
  document.getElementById("eyeCursorText2"),
  document.getElementById("eyeCursorText3"),
  document.getElementById("eyeCursorText4")
].filter(element => element !== null);

// Load trigger data from JSON file
function loadTriggerData() {
  fetch('/config/triggers.json')
    .then(response => response.json())
    .then(data => {
      triggerData = data.triggers;
      createToggleButtons();
      preloadSelectedAudio();
    })
    .catch(error => {
      console.log('Error loading trigger data:', error);
    });
}

// Create toggle buttons for each trigger
function createToggleButtons() {
  const container = document.getElementById('trigger-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  triggerData.forEach(trigger => {
    const toggleItem = document.createElement('div');
    toggleItem.className = 'trigger-toggle-item';
    
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'toggle-input';
    input.id = `trigger-${trigger.name.replace(/\s+/g, '-').toLowerCase()}`;
    input.dataset.triggerName = trigger.name;
    
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

// Load audio for a specific trigger
function loadTriggerAudio(trigger) {
  if (!trigger || !trigger.name) return null;
  
  if (audioCache[trigger.name]) return audioCache[trigger.name];
  
  const audio = new Audio();
  
  // Use filename from trigger data if available
  if (trigger.filename) {
    audio.src = `/audio/${trigger.filename}`;
  } else {
    const formattedName = trigger.name.replace(/\s+/g, '-');
    audio.src = `/audio/${formattedName}.mp3`;
  }
  
  audioCache[trigger.name] = audio;
  
  audio.addEventListener('error', () => {
    console.log(`Failed to load audio: ${trigger.name}`);
  });
  
  return audio;
}

// Only preload selected trigger audio files (don't play them)
function preloadSelectedAudio() {
  const selectedTriggers = getSelectedTriggers();
  
  if (!selectedTriggers.length) return;
  
  selectedTriggers.forEach(trigger => {
    // Just load the audio, don't play it
    loadTriggerAudio(trigger);
  });
}

// Modified function to play trigger sound
function playTriggerSound(triggerName) {
  const trigger = triggerData.find(t => t.name === triggerName);
  
  // Load audio if not already loaded
  if (trigger && !audioCache[triggerName]) {
    loadTriggerAudio(trigger);
  }
  
  if (!audioCache[triggerName]) {
    console.log(`No audio found for trigger: ${triggerName}`);
    return Promise.resolve();
  }
  
  const audio = audioCache[triggerName];
  audio.currentTime = 0;
  
  return new Promise(resolve => {
    const onEnd = () => {
      audio.removeEventListener('ended', onEnd);
      resolve();
    };
    
    audio.addEventListener('ended', onEnd);
    audio.play().catch(e => {
      console.log(`Error playing audio: ${triggerName}`);
      resolve();
    });
  });
}

// Display trigger text and return a promise
async function displayTriggerText(triggerName, element) {
  // Find all eye cursor text elements
  const textElements = [
    document.getElementById("eyeCursorText"),
    document.getElementById("eyeCursorText2"),
    document.getElementById("eyeCursorText3"),
    document.getElementById("eyeCursorText4")
  ].filter(el => el !== null);
  
  if (!textElements.length) return Promise.resolve();
  
  // Display the trigger name in all text elements
  textElements.forEach(el => {
    el.textContent = triggerName;
    // Faster transition speed
    el.style.transition = `opacity ${Math.random() * 1 + 1}s`;
    el.style.opacity = 1;
  });
  
  // Shorter duration for display
  const duration = Math.random() * 1 + 1;
  
  // Wait for fade in (shorter wait)
  await new Promise(resolve => setTimeout(resolve, duration * 500));
  
  // Fade out all elements
  textElements.forEach(el => {
    el.style.opacity = 0;
  });
  
  // Shorter wait before resolving
  return new Promise(resolve => setTimeout(resolve, duration * 500));
}

// Handle playing of triggers one by one
async function triggerTriggers(triggers) {
  if (!Array.isArray(triggers) || triggers.length === 0) {
    console.log("No triggers to display.");
    return;
  }

  // Process triggers with delay between them
  for (const trigger of triggers) {
    await playTriggerWithDisplay(trigger);
    
    // Random delay between triggers (1-3 seconds)
    const delay = Math.random() * 2000 + 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// Play single trigger with synchronized display
async function playTriggerWithDisplay(trigger) {
  // Start audio playback
  const audioPromise = playTriggerSound(trigger.name);
  
  // Display trigger text simultaneously with audio
  await displayTriggerText(trigger.name);
  
  // Wait for audio to finish
  return audioPromise;
}

function toggleAllToggles() {
  const toggleInputs = document.getElementsByClassName("toggle-input");
  for (let i = 0; i < toggleInputs.length; i++) {
    toggleInputs[i].checked = !toggleInputs[i].checked;
  }
}

// Get all selected triggers
function getSelectedTriggers() {
  const selectedTriggers = [];
  const toggleInputs = document.getElementsByClassName("toggle-input");
  
  for (let i = 0; i < toggleInputs.length; i++) {
    if (toggleInputs[i].checked) {
      const triggerName = toggleInputs[i].dataset.triggerName || toggleInputs[i].dataset.trigger;
      const trigger = triggerData.find(t => t.name === triggerName);
      if (trigger) {
        selectedTriggers.push(trigger);
      }
    }
  }
  
  return selectedTriggers;
}

// Create and play a random playlist from selected triggers
function playRandomPlaylist() {
  const selectedTriggers = getSelectedTriggers();
  
  if (selectedTriggers.length === 0) {
    console.log("No triggers selected");
    return;
  }
  
  // Load audio for selected triggers
  selectedTriggers.forEach(trigger => {
    loadTriggerAudio(trigger);
  });
  
  // Shuffle the selected triggers
  const shuffledTriggers = [...selectedTriggers].sort(() => Math.random() - 0.5);
  
  // Start playing the random playlist
  triggerTriggers(shuffledTriggers);
  
  // Send triggers to server if socket is available
  if (typeof socket !== "undefined" && socket.connected) {
    const triggerNames = shuffledTriggers.map(t => t.name);
    socket.emit("triggers", triggerNames);
  }
}

// Update the toggle input event handler to restart loop when selection changes
function setupToggleListeners() {
  const toggleInputs = document.getElementsByClassName("toggle-input");
  
  for (let i = 0; i < toggleInputs.length; i++) {
    toggleInputs[i].addEventListener("change", function() {
      // Don't handle loop toggle itself
      if (this.id === "loop-toggle") return;
      
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
    });
  }
}

// Handle specific trigger activation
function activateTrigger(trigger) {
  // If trigger is a string, find the matching trigger data
  if (typeof trigger === 'string') {
    const triggerObj = triggerData.find(t => t.name === trigger);
    if (triggerObj) {
      console.log(`Activating trigger: ${triggerObj.name}`);
      playTriggerWithDisplay(triggerObj);
    }
  } 
  // If trigger is an object, use it directly
  else if (typeof trigger === 'object' && trigger.name) {
    console.log(`Activating trigger: ${trigger.name}`);
    playTriggerWithDisplay(trigger);
  }
}

// Set up socket event listener if socket exists
function setupSocketListener() {
  if (typeof socket !== "undefined") {
    socket.on("trigger:audio", (triggerName) => {
      if (!triggerName) return;
      activateTrigger(triggerName);
    });
  }
}

let continuousPlaybackActive = false;

// Add a global variable to track playback speed
let playbackSpeedFactor = 1.0;

// Function to update playback speed
function updatePlaybackSpeed(speedFactor) {
  playbackSpeedFactor = speedFactor;
}

// Play selected triggers in a continuous loop until stopped
function playContinuousTriggers() {
  if (continuousPlaybackActive) {
    console.log("Continuous playback already active");
    return;
  }

  let selectedTriggers = getSelectedTriggers();
  
  if (selectedTriggers.length === 0) {
    console.log("No triggers selected for continuous playback");
    // Make sure toggle is unchecked if no triggers selected
    const loopToggle = document.getElementById("loop-toggle");
    if (loopToggle) {
      loopToggle.checked = false;
    }
    return;
  }
  
  // Ensure toggle is checked when playback starts
  const loopToggle = document.getElementById("loop-toggle");
  if (loopToggle) {
    loopToggle.checked = true;
  }
  
  continuousPlaybackActive = true;
  
  // Function to check if trigger selection has changed
  function hasSelectionChanged(originalSelection) {
    const currentSelection = getSelectedTriggers();
    
    // Different number of triggers means selection changed
    if (currentSelection.length !== originalSelection.length) {
      return true;
    }
    
    // Check if all current triggers were in original selection
    return !currentSelection.every(current => 
      originalSelection.some(original => original.name === current.name)
    );
  }
  
  // Recursive function to keep playing until stopped
  async function playLoop(initialSelection) {
    // Stop if continuous playback was deactivated or selection changed
    if (!continuousPlaybackActive || hasSelectionChanged(initialSelection)) {
      console.log("Continuous playback stopped");
      continuousPlaybackActive = false;
      return;
    }
    
    // Shuffle the triggers again for each loop
    const shuffledTriggers = [...initialSelection].sort(() => Math.random() - 0.5);
    
    // Play all triggers in the shuffled array
    for (const trigger of shuffledTriggers) {
      // Stop loop if selection changed during playback
      if (!continuousPlaybackActive || hasSelectionChanged(initialSelection)) {
        console.log("Continuous playback stopped mid-sequence");
        continuousPlaybackActive = false;
        return;
      }
      
      await playTriggerWithDisplay(trigger);
      
      // Delay between triggers adjusted by speed factor
      const baseDelay = Math.random() * 200 + 100;
      const adjustedDelay = baseDelay * playbackSpeedFactor;
      await new Promise(resolve => setTimeout(resolve, adjustedDelay));
    }
    
    // Continue with next loop
    playLoop(initialSelection);
  }
  
  // Preload audio for all selected triggers
  selectedTriggers.forEach(trigger => {
    loadTriggerAudio(trigger);
  });
  
  // Start the continuous playback loop
  playLoop(selectedTriggers);
}

// Stop continuous playback
function stopContinuousPlayback() {
  continuousPlaybackActive = false;
  
  // Uncheck the toggle when stopping playback
  const loopToggle = document.getElementById("loop-toggle");
  if (loopToggle) {
    loopToggle.checked = false;
  }
}

// Initialize when window loads
window.onload = function () {
  loadTriggerData();
  
  // Add event listener for the loop toggle
  const loopToggle = document.getElementById("loop-toggle");
  if (loopToggle) {
    loopToggle.addEventListener("change", function() {
      if (this.checked) {
        playContinuousTriggers();
      } else {
        stopContinuousPlayback();
      }
    });
  }
  
  // Add event listener for the play button
  const playButton = document.getElementById("play-playlist");
  if (playButton) {
    playButton.addEventListener("click", playRandomPlaylist);
  }
  
  // Setup toggle listeners
  setupToggleListeners();
  setupSocketListener();
};

// Expose the API globally for use by other scripts
window.bambiAudio = {
  playTrigger: activateTrigger,
  playRandomPlaylist: playRandomPlaylist,
  startContinuousPlayback: playContinuousTriggers,
  stopContinuousPlayback: stopContinuousPlayback,
  updatePlaybackSpeed: updatePlaybackSpeed
};