let state = true;
let _audioArray = [];
let duration = 0;
const audio = document.getElementById('audio');
const messageElement = document.querySelector("#message"); // Cache DOM element
let currentVoice = 'af_bella'; // Default voice

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
  // Check if element exists before accessing
  const audioElement = document.querySelector("#audio");
  if (audioElement) audioElement.hidden = true;
  
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
  if (_audioArray.length > 0 && audio) {
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
  if (messageElement) messageElement.textContent = "Synthesizing...";

  let currentURL = arrayShift(_audioArray);
  if (!currentURL) return;
  
  let retries = 2;
  let audioUrl = null; // Track URL for cleanup
  
  while (retries >= 0) {
    try {
      const response = await fetch(currentURL, {
        credentials: 'same-origin',
        headers: {
          'Accept': 'audio/mpeg'
        }
      });
      
      if (!response.ok) {
        if (retries > 0) {
          console.log(`Retrying TTS request (${retries} attempts left)...`);
          retries--;
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const audioBlob = await response.blob();
      audioUrl = URL.createObjectURL(audioBlob);
      
      if (!audio) {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        throw new Error("Audio element not found");
      }
      
      audio.src = audioUrl;
      audio.load();
      
      // Set up event handlers
      audio.onloadedmetadata = function() {
        if (messageElement) messageElement.textContent = "Playing...";
        audio.play().catch(e => {
          console.error("Error playing audio:", e);
          if (messageElement) messageElement.textContent = "Error playing audio: " + e.message;
        });
      };
      
      audio.onended = function() {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        audioUrl = null;
        
        if (messageElement) messageElement.textContent = "Finished!";
        
        if (_audioArray.length > 0) {
          do_tts(_audioArray);
        }
      };
      
      audio.onerror = function(e) {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        audioUrl = null;
        
        if (messageElement) messageElement.textContent = "Error playing audio: " + 
          (audio.error ? audio.error.message : "Unknown error");
        
        if (_audioArray.length > 0) {
          do_tts(_audioArray);
        }
      };
      
      break;
      
    } catch (error) {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = null;
      
      if (retries <= 0) {
        console.error("Fetch error:", error);
        if (messageElement) messageElement.textContent = "Error fetching audio: " + error.message;
        
        if (_audioArray.length > 0) {
          do_tts(_audioArray);
        }
      } else {
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000));
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

/**
 * Cleanup function for page unload
 */
function cleanupAudio() {
  if (audio) {
    audio.pause();
    audio.src = '';
  }
  _audioArray = [];
}

// Add unload handler
window.addEventListener('beforeunload', cleanupAudio);

// Export functions for use in other modules
window.tts = {
  arrayPush,
  arrayShift,
  do_tts,
  setVoice,
  fetchAvailableVoices
};