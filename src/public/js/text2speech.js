let state = true;
let _audioArray = [];
let duration = 0;
const audio = document.getElementById('audio');
let currentVoice = 'af_bella'; // Default voice from config (KOKORO_DEFAULT_VOICE)

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
 * @param {string} text - Text to convert to speech
 * @returns {Array} - Updated audio array
 */
function arrayPush(_audioArray, text) {
  document.querySelector("#audio").hidden = true;
  
  // Match server.js implementation - use the same endpoint
  let url = `/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(currentVoice)}`;
  _audioArray.push(url);
  
  return _audioArray;
}

/**
 * Shift and return first URL from audio array
 */
function arrayShift(_audioArray) {
  if (_audioArray.length > 0 && audio !== null) {
    return _audioArray.shift();
  }
  return undefined;
}

/**
 * Process TTS queue and play audio
 */
async function do_tts(_audioArray) {
  document.querySelector("#message").textContent = "Synthesizing...";

  let currentURL = arrayShift(_audioArray);
  if (!currentURL) return;
  
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      // Match the timeout logic from server.js
      const timeout = 10000 + (attempts * 5000); // 10s, 15s, 20s
      
      // Set up abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      // Fetch the audio from the server
      const response = await fetch(currentURL, {
        signal: controller.signal,
        credentials: 'same-origin',
        headers: {
          'Accept': 'audio/mpeg'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      // Get audio data as blob
      const audioBlob = await response.blob();
      
      // Create object URL from blob
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Set audio source to blob URL
      audio.src = audioUrl;
      
      audio.load();
      
      // Set up event handlers
      audio.onloadedmetadata = function() {
        document.querySelector("#message").textContent = "Playing...";
        audio.play().catch(e => {
          console.error("Error playing audio:", e);
          document.querySelector("#message").textContent = "Error playing audio";
        });
      };
      
      audio.onended = function() {
        document.querySelector("#message").textContent = "Finished!";
        URL.revokeObjectURL(audioUrl);
        
        // Process next item in queue if any
        if (_audioArray.length > 0) {
          do_tts(_audioArray);
        }
      };
      
      audio.onerror = function() {
        document.querySelector("#message").textContent = "Audio error";
        URL.revokeObjectURL(audioUrl);
        
        // Process next item in queue if any
        if (_audioArray.length > 0) {
          do_tts(_audioArray);
        }
      };
      
      break; // Exit the retry loop on success
      
    } catch (error) {
      attempts++;
      
      // Match server.js wait time logic for retries
      const waitTime = error.name === 'AbortError' ? 2000 * attempts : 1000 * attempts;
      
      if (attempts >= maxAttempts) {
        console.error("Fetch failed after all attempts:", error);
        document.querySelector("#message").textContent = "Failed to generate speech";
        
        // Process next item in queue if any
        if (_audioArray.length > 0) {
          do_tts(_audioArray);
        }
        return;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, waitTime));
      document.querySelector("#message").textContent = `Retry attempt ${attempts}...`;
    }
  }
}

/**
 * Fetch available TTS voices from the server
 */
async function fetchAvailableVoices() {
  try {
    const response = await fetch('/api/tts/voices');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching voices:", error);
    return [];
  }
}

// Export functions for use in other modules
window.tts = {
  arrayPush,
  arrayShift,
  do_tts,
  setVoice,
  fetchAvailableVoices
};