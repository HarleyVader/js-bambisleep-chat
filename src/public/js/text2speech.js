let state = true;
let _audioArray = [];
let duration = 0;
const audio = document.getElementById('audio');
let currentVoice = 'af_bella'; // Default voice from app.js (KOKORO_DEFAULT_VOICE)

/**
 * Set the voice to use for TTS
 * @param {string} voice - Voice ID to use
 */
function setVoice(voice) {
  if (voice && typeof voice === 'string') {
    currentVoice = voice;
    console.log(`TTS voice set to: ${currentVoice}`);
  }
}

/**
 * Push text to TTS queue and create URL 
 * @param {Array} _audioArray - Array to store audio URLs
 * @param {string} e - Text to convert to speech
 * @returns {Array} - Updated audio array
 */
function arrayPush(_audioArray, e) {
  document.querySelector("#audio").hidden = true;
  
  // Update the URL to match the route structure in server.js
  // Try using a relative path that works with both server configurations
  let URL = `/api/tts?text=${encodeURIComponent(e)}&voice=${encodeURIComponent(currentVoice)}`;
  _audioArray.push(URL);
  
  return _audioArray;
}

/**
 * Shift and return first URL from audio array
 * @param {Array} _audioArray - Array containing audio URLs
 * @returns {string|undefined} - URL for audio or undefined
 */
function arrayShift(_audioArray) {
  if (_audioArray.length > 0 && audio !== null) {
    let _currentURL = _audioArray.shift();
    console.log("Processing URL:", _currentURL);
    return _currentURL;
  }
  return undefined;
}

/**
 * Process TTS queue and play audio
 * @param {Array} _audioArray - Array containing audio URLs
 */
async function do_tts(_audioArray) {
  document.querySelector("#message").textContent = "Synthesizing...";

  let currentURL = arrayShift(_audioArray);
  if (!currentURL) return;
  
  let retries = 2; // Number of retry attempts
  
  while (retries >= 0) {
    try {
      // Fetch the audio from the server
      const response = await fetch(currentURL, {
        credentials: 'same-origin', // Include cookies for authentication
        headers: {
          'Accept': 'audio/mpeg' // Expect MP3 format as set in app.js
        }
      });
      
      if (!response.ok) {
        if (retries > 0) {
          console.log(`Retrying TTS request (${retries} attempts left)...`);
          retries--;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          continue;
        }
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      // Get audio data as blob
      const audioBlob = await response.blob();
      
      // Create object URL from blob
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Set audio source to blob URL
      audio.src = audioUrl;
      console.log("Audio source set:", audioUrl);
      
      audio.load();
      
      // Set up event handlers
      audio.onloadedmetadata = function() {
        console.log("Audio metadata loaded, duration:", audio.duration);
        document.querySelector("#message").textContent = "Playing...";
        audio.play().catch(e => {
          console.error("Error playing audio:", e);
          document.querySelector("#message").textContent = "Error playing audio: " + e.message;
        });
      };
      
      audio.onended = function() {
        console.log("Audio playback ended");
        document.querySelector("#message").textContent = "Finished!";
        
        // Release the blob URL to free memory
        URL.revokeObjectURL(audioUrl);
        
        // Process next item in queue if any
        if (_audioArray.length > 0) {
          do_tts(_audioArray);
        }
      };
      
      audio.onerror = function(e) {
        console.error("Audio error:", e);
        console.error("Error code:", audio.error ? audio.error.code : "unknown");
        console.error("Error message:", audio.error ? audio.error.message : "unknown");
        document.querySelector("#message").textContent = "Error playing audio: " + 
          (audio.error ? audio.error.message : "Unknown error");
        
        // Release the blob URL on error
        URL.revokeObjectURL(audioUrl);
        
        // Process next item in queue if any
        if (_audioArray.length > 0) {
          do_tts(_audioArray);
        }
      };
      
      break; // Exit the retry loop on success
      
    } catch (error) {
      if (retries <= 0) {
        console.error("Fetch error:", error);
        document.querySelector("#message").textContent = "Error fetching audio: " + error.message;
        
        // Process next item in queue if any
        if (_audioArray.length > 0) {
          do_tts(_audioArray);
        }
      } else {
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      }
    }
  }
}

/**
 * Fetch available TTS voices from the server
 * @returns {Promise<Array>} - Array of available voices
 */
async function fetchAvailableVoices() {
  try {
    const response = await fetch('/api/tts/voices');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching available voices:", error);
    return [];
  }
}

// Function to populate triggers in the trigger panel
async function populateTriggerPanel() {
  try {
    const response = await fetch('/config/triggers.json');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    const triggerList = document.getElementById('trigger-list');
    
    if (triggerList && data.triggers) {
      // Get previously active triggers
      let activeTriggerNames = [];
      try {
        const storedActiveTriggers = localStorage.getItem('bambiActiveTriggers');
        if (storedActiveTriggers) {
          activeTriggerNames = JSON.parse(storedActiveTriggers);
        }
      } catch (error) {
        console.log('Error loading active triggers from localStorage:', error);
      }
      
      triggerList.innerHTML = '';
      
      data.triggers.forEach(trigger => {
        const toggleItem = document.createElement('div');
        toggleItem.className = 'trigger-toggle-item';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'toggle-input';
        input.id = `trigger-${trigger.name.replace(/\s+/g, '-').toLowerCase()}`;
        input.dataset.trigger = trigger.name;
        input.dataset.description = trigger.description || '';
        
        // Check if this trigger was previously active
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
        triggerList.appendChild(toggleItem);
      });
      
      // Setup event listeners for triggers
      const triggerInputs = triggerList.querySelectorAll('.toggle-input');
      triggerInputs.forEach(input => {
        input.addEventListener('change', function() {
          saveTriggerState();
        });
      });
    }
  } catch (error) {
    console.error("Error loading trigger data:", error);
    
    // Populate with fallback data if fetch fails
    populateFallbackTriggers();
  }
}

// Populate triggers with fallback data
function populateFallbackTriggers() {
  const triggerList = document.getElementById('trigger-list');
  if (!triggerList) return;
  
  const fallbackTriggers = [
    { name: "BAMBI SLEEP", description: "Primary conditioning trigger for Bambi personality" },
    { name: "GOOD GIRL", description: "Makes you feel pleasure when obeying commands" },
    { name: "BAMBI RESET", description: "Resets Bambi to default programming state" },
    { name: "BIMBO DOLL", description: "Turns you into a mindless, giggly bimbo doll" },
    { name: "BAMBI FREEZE", description: "Locks you in place, unable to move" }
  ];
  
  triggerList.innerHTML = '';
  
  fallbackTriggers.forEach(trigger => {
    const toggleItem = document.createElement('div');
    toggleItem.className = 'trigger-toggle-item';
    
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'toggle-input';
    input.id = `trigger-${trigger.name.replace(/\s+/g, '-').toLowerCase()}`;
    input.dataset.trigger = trigger.name;
    input.dataset.description = trigger.description || '';
    
    const label = document.createElement('label');
    label.className = 'toggle-label';
    label.htmlFor = input.id;
    label.textContent = trigger.name;
    label.title = trigger.description || '';
    
    toggleItem.appendChild(input);
    toggleItem.appendChild(label);
    triggerList.appendChild(toggleItem);
  });
}

// Helper function to save trigger state
function saveTriggerState() {
  const triggerList = document.getElementById('trigger-list');
  if (!triggerList) return;
  
  const activeTriggers = [];
  triggerList.querySelectorAll('.toggle-input:checked').forEach(input => {
    const name = input.dataset.trigger;
    const desc = input.dataset.description || '';
    
    if (name) activeTriggers.push(name);
  });
  
  localStorage.setItem('bambiActiveTriggers', JSON.stringify(activeTriggers));
  
  // Send to server if socket is available
  if (window.socket && window.socket.connected) {
    window.socket.emit('triggers', {
      triggerNames: activeTriggers.join(','),
      triggerDetails: activeTriggers.map(name => ({
        name,
        description: document.querySelector(`input[data-trigger="${name}"]`).dataset.description || ''
      }))
    });
  }
}

// Export functions for use in other modules
window.tts = {
  arrayPush,
  arrayShift,
  do_tts,
  setVoice,
  fetchAvailableVoices,
  populateTriggerPanel
};

// Initialize trigger panel when document is loaded
document.addEventListener('DOMContentLoaded', () => {
  const triggerList = document.getElementById('trigger-list');
  if (triggerList) {
    populateTriggerPanel();
    
    // Setup play all triggers button
    const playTriggersBtn = document.getElementById('play-triggers');
    if (playTriggersBtn) {
      playTriggersBtn.addEventListener('click', () => {
        const activeTriggers = [];
        triggerList.querySelectorAll('.toggle-input:checked').forEach(input => {
          activeTriggers.push(input.dataset.trigger);
        });
        
        if (activeTriggers.length > 0 && window.socket && window.socket.connected) {
          window.socket.emit('play-triggers', { triggers: activeTriggers });
        }
      });
    }
    
    // Setup toggle all button
    const toggleAllBtn = document.getElementById('activate-all');
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener('click', () => {
        const inputs = triggerList.querySelectorAll('.toggle-input');
        const allChecked = Array.from(inputs).every(input => input.checked);
        
        inputs.forEach(input => {
          input.checked = !allChecked;
        });
        
        saveTriggerState();
      });
    }
  }
});