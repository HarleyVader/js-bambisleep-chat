let triggerData = []; // Will hold the data from triggers.json
const audioCache = {};

const textElements = [
  document.getElementById("eyeCursorText"),
  document.getElementById("eyeCursorText2"),
  document.getElementById("eyeCursorText3"),
  document.getElementById("eyeCursorText4")
].filter(element => element !== null);

// Fetch trigger data from JSON file
function loadTriggerData() {
  fetch('/config/triggers.json')
    .then(response => response.json())
    .then(data => {
      triggerData = data.triggers;
      createToggleButtons();
    })
    .catch(error => console.error('Error loading trigger data:', error));
}

// Load audio for a specific trigger
function loadTriggerAudio(trigger) {
  if (!trigger || !trigger.filename) return null;
  
  if (audioCache[trigger.name]) return audioCache[trigger.name];
  
  const audio = new Audio(`/audio/${trigger.filename}`);
  audio.preload = 'auto';
  audioCache[trigger.name] = audio;
  
  // Log when loaded
  audio.addEventListener('canplaythrough', () => {
    console.log(`Audio loaded: ${trigger.filename}`);
  });
  
  // Log errors
  audio.addEventListener('error', (e) => {
    console.log(`Error loading audio for ${trigger.filename}`);
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
  if (!element) return Promise.resolve();
  
  element.textContent = triggerName;
  const duration = Math.random() * 2 + 2;
  element.style.transition = `opacity ${duration}s`;
  element.style.opacity = 1;
  
  // Wait for fade in
  await new Promise(resolve => setTimeout(resolve, duration * 1000));
  
  // Fade out
  element.style.opacity = 0;
  return new Promise(resolve => setTimeout(resolve, duration * 1000));
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
  
  // Display trigger in first available text element
  const element = textElements.find(el => el !== null);
  if (element) {
    element.textContent = trigger.name;
    element.style.opacity = 1;

    // Wait for audio to finish
    await audioPromise;
    
    // Keep text visible briefly after audio ends
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Fade out text
    element.style.transition = "opacity 1s";
    element.style.opacity = 0;
  } else {
    // If no display element, just wait for audio
    await audioPromise;
  }
}

// Create toggle buttons only if container exists
function createToggleButtons() {
  const container = document.getElementById("trigger-toggles");
  if (!container) {
    setTimeout(createToggleButtons, 500);
    return;
  }

  // Clear existing buttons
  container.innerHTML = "";

  triggerData.forEach((trigger, index) => {
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.id = `toggle-${index}`;
    toggle.className = "toggle-input";
    toggle.dataset.triggerName = trigger.name;

    const label = document.createElement("label");
    label.textContent = trigger.name;
    label.htmlFor = `toggle-${index}`;
    label.className = "toggle-label";
    
    if (trigger.description) {
      label.title = trigger.description;
    }

    container.appendChild(toggle);
    container.appendChild(label);
  });
  
  // Set up listeners after creating buttons
  setupToggleListeners();
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

// Update the toggle input event handler to only load audio, not play it
function setupToggleListeners() {
  const toggleInputs = document.getElementsByClassName("toggle-input");
  
  for (let i = 0; i < toggleInputs.length; i++) {
    toggleInputs[i].addEventListener("change", function() {
      // If continuous playback is active, stop it when selection changes
      if (continuousPlaybackActive && this.dataset.triggerName) {
        stopContinuousPlayback();
      }
      
      if (this.checked && this.dataset.triggerName) {
        // Only load audio, don't play it
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
      
      // Brief delay between triggers
      const delay = Math.random() * 1000 + 500;
      await new Promise(resolve => setTimeout(resolve, delay));
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
  stopContinuousPlayback: stopContinuousPlayback
};