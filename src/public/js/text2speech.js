window.ttsSystem = (function() {
  // Private variables
  let _audioArray = [];
  let audio = null;
  let isPlaying = false;
  
  // Initialize module
  function init() {
    audio = document.getElementById('audio');
    
    // Load previous state from bambiSystem
    loadState();
    
    // Set up audio event listeners
    setupAudioListeners();
  }
  
  // Set up audio element event listeners
  function setupAudioListeners() {
    if (!audio) return;
    
    audio.onloadedmetadata = function() {
      updateMessage("Playing...");
      audio.play().catch(e => {
        console.error("Error playing audio:", e);
        updateMessage("Error playing audio");
      });
    };
    
    audio.onended = function() {
      updateMessage("Finished!");
      
      // Process next item in queue if any
      if (_audioArray.length > 0) {
        playNext();
      } else {
        isPlaying = false;
        saveState();
      }
    };
    
    audio.onerror = function() {
      updateMessage("Error playing audio");
      isPlaying = false;
      saveState();
    };
  }
  
  // Load state from central system
  function loadState() {
    if (window.bambiSystem) {
      const state = window.bambiSystem.getState('tts');
      if (state) {
        _audioArray = state.queue || [];
        isPlaying = state.isPlaying || false;
      }
    }
  }
  
  // Save state to central system
  function saveState() {
    if (window.bambiSystem) {
      window.bambiSystem.saveState('tts', {
        queue: _audioArray,
        isPlaying: isPlaying
      });
    }
  }
  
  // Update UI message
  function updateMessage(text) {
    const msgElement = document.querySelector("#message");
    if (msgElement) {
      msgElement.textContent = text;
    }
  }
  
  // Add text to TTS queue
  function queueText(text) {
    if (!text) return;
    
    // Sanitize text by removing anything but letters, numbers and spaces
    const sanitizedText = text.replace(/[^a-zA-Z0-9\s]/g, '');
    
    // Create a proper URL with encoded sanitized text parameter
    let url = `/api/tts?text=${encodeURIComponent(sanitizedText)}`;
    _audioArray.push(url);
    
    // Save updated queue to state
    saveState();
    
    // If not already playing, start playback
    if (!isPlaying) {
      playNext();
    }
    
    return _audioArray.length;
  }
  
  // Process and play next item in queue
  async function playNext() {
    if (_audioArray.length === 0 || !audio) {
      isPlaying = false;
      saveState();
      return;
    }
    
    isPlaying = true;
    saveState();
    updateMessage("Synthesizing...");
    
    const currentURL = _audioArray.shift();
    let retries = 2;
    
    while (retries >= 0) {
      try {
        // Fetch the audio first
        const response = await fetch(currentURL);
        
        if (!response.ok) {
          if (retries > 0) {
            retries--;
            await new Promise(resolve => setTimeout(resolve, 1000));
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
        audio.load();
        
        // onloadedmetadata handles playback
        // Store URL to revoke later
        audio.dataset.blobUrl = audioUrl;
        
        break;
        
      } catch (error) {
        if (retries <= 0) {
          console.error("Fetch error:", error);
          updateMessage("Error fetching audio");
          
          // Use a fallback if TTS fails completely
          audio.src = "./silence_100ms.wav";
          audio.load();
        } else {
          retries--;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  }
  
  // Cancel all queued audio
  function cancelAll() {
    _audioArray = [];
    
    if (audio) {
      // Revoke any blob URL to prevent memory leaks
      if (audio.dataset.blobUrl) {
        URL.revokeObjectURL(audio.dataset.blobUrl);
        audio.dataset.blobUrl = '';
      }
      
      audio.pause();
      audio.src = '';
    }
    
    isPlaying = false;
    updateMessage("Canceled");
    saveState();
  }
  
  // Clean up when page unloads
  function tearDown() {
    if (audio) {
      // Revoke any blob URL to prevent memory leaks
      if (audio.dataset.blobUrl) {
        URL.revokeObjectURL(audio.dataset.blobUrl);
      }
      
      audio.onloadedmetadata = null;
      audio.onended = null;
      audio.onerror = null;
    }
  }
  
  // Public API
  return {
    init,
    tearDown,
    speak: queueText,
    cancel: cancelAll,
    getQueue: () => _audioArray.slice(),
    isPlaying: () => isPlaying
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.ttsSystem.init);

// For backward compatibility
function arrayPush(_audioArray, e) {
  return window.ttsSystem.speak(e);
}

function do_tts(_audioArray) {
  _audioArray.forEach(text => window.ttsSystem.speak(text));
}