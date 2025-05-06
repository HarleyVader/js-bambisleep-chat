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
      preloadTriggerAudio();
    })
    .catch(error => console.error('Error loading trigger data:', error));
}

// Function to preload all trigger audio files
function preloadTriggerAudio() {
  if (!triggerData.length) return;
  
  triggerData.forEach(trigger => {
    if (!trigger.filename) return;
    
    const audio = new Audio(`/audio/${trigger.filename}`);
    audio.preload = 'auto';
    audioCache[trigger.name] = audio;
    
    // Add load event to track loading status
    audio.addEventListener('canplaythrough', () => {
      console.log(`Audio loaded: ${trigger.filename}`);
    });
    
    // Add error handler
    audio.addEventListener('error', (e) => {
      console.log(`Error loading audio for ${trigger.filename}: ${e.target.error.message}`);
    });
  });
}

// Simple API to play a trigger sound and return a promise
function playTriggerSound(triggerName) {
  if (!audioCache[triggerName]) {
    console.log(`No audio found for trigger: ${triggerName}`);
    return Promise.resolve();
  }
  
  const audio = audioCache[triggerName];
  audio.currentTime = 0;
  
  // Return a promise that resolves when audio ends
  return new Promise((resolve, reject) => {
    const onEnd = () => {
      audio.removeEventListener('ended', onEnd);
      resolve();
    };
    
    audio.addEventListener('ended', onEnd);
    audio.play().catch(e => {
      console.error(`Error playing audio for ${triggerName}: ${e.message}`);
      resolve(); // Resolve anyway to prevent hanging
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
    console.log("Container with id 'trigger-toggles' not found. Will try again later.");
    // Try again after a short delay to allow DOM to load
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
    
    // Add description as title for tooltip
    if (trigger.description) {
      label.title = trigger.description;
    }

    container.appendChild(toggle);
    container.appendChild(label);
  });
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
      const triggerName = toggleInputs[i].dataset.triggerName;
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
  
  // Shuffle the selected triggers
  const shuffledTriggers = [...selectedTriggers].sort(() => Math.random() - 0.5);
  
  // Start playing the random playlist
  triggerTriggers(shuffledTriggers);
  
  // Send triggers to server if socket is available
  if (typeof socket !== "undefined" && socket.connected) {
    const triggerNames = shuffledTriggers.map(t => t.name);
    socket.emit("triggers", triggerNames);
    socket.emit("trigger:play-audio", triggerNames);
    console.log("Triggers sent:", triggerNames);
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

// Initialize when window loads
window.onload = function () {
  loadTriggerData();
  
  // Check if trigger container exists, create it if not
  let container = document.getElementById("trigger-toggles");
  if (!container && document.body) {
    console.log("Creating missing trigger-toggles container");
    container = document.createElement("div");
    container.id = "trigger-toggles";
    container.className = "trigger-container";
    document.body.appendChild(container);
  }
  
  // Set up button click handlers
  const activateAllButton = document.getElementById("activate-all");
  if (activateAllButton) {
    activateAllButton.addEventListener("click", toggleAllToggles);
  }
  
  const playButton = document.getElementById("play-playlist");
  if (playButton) {
    playButton.addEventListener("click", playRandomPlaylist);
  }
  
  setupSocketListener();
};

// Expose the API globally for use by other scripts
window.bambiAudio = {
  playTrigger: activateTrigger,
  playRandomPlaylist: playRandomPlaylist
};