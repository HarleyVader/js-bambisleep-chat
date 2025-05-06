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

// Simple API to play a trigger sound
function playTriggerSound(triggerName) {
  if (!audioCache[triggerName]) {
    console.log(`No audio found for trigger: ${triggerName}`);
    return;
  }
  
  const audio = audioCache[triggerName];
  audio.currentTime = 0;
  audio.play().catch(e => {
    console.error(`Error playing audio for ${triggerName}: ${e.message}`);
  });
}

function createToggleButtons() {
  const container = document.getElementById("trigger-toggles");
  if (!container) {
    console.error("Container with id 'trigger-toggles' not found.");
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

// Handle playing of triggers one by one
async function triggerTriggers(triggers) {
  if (!Array.isArray(triggers) || triggers.length === 0) {
    console.log("No triggers to display.");
    return;
  }

  for (const trigger of triggers) {
    // Play the trigger sound
    playTriggerSound(trigger.name);
    
    // Display trigger on screen
    for (const element of textElements) {
      if (!element) continue;
      element.textContent = trigger.name;
      const duration = Math.random() * 2 + 2;
      element.style.transition = `opacity ${duration}s`;
      element.style.opacity = 1;
      await new Promise(resolve => setTimeout(resolve, duration * 1000));
      element.style.opacity = 0;
      await new Promise(resolve => setTimeout(resolve, duration * 1000));
    }
  }
}

// Handle specific trigger activation
function activateTrigger(trigger) {
  // If trigger is a string, find the matching trigger data
  if (typeof trigger === 'string') {
    const triggerObj = triggerData.find(t => t.name === trigger);
    if (triggerObj) {
      console.log(`Activating trigger: ${triggerObj.name} (${triggerObj.description || 'No description'})`);
      playTriggerSound(triggerObj.name);
    }
  } 
  // If trigger is an object, use it directly
  else if (typeof trigger === 'object' && trigger.name) {
    console.log(`Activating trigger: ${trigger.name} (${trigger.description || 'No description'})`);
    playTriggerSound(trigger.name);
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