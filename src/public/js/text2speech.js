let state = true;
let _audioArray = [];
let duration = 0;
const audio = document.getElementById('audio');

/**
 * Push text to TTS queue and create URL 
 * @param {Array} _audioArray - Array to store audio URLs
 * @param {string} e - Text to convert to speech
 * @returns {Array} - Updated audio array
 */
function arrayPush(_audioArray, e) {
  document.querySelector("#audio").hidden = true;
  
  // Create a proper URL with encoded text parameter
  let URL = `/api/tts?text=${encodeURIComponent(e)}`;
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
  
  try {
    // Instead of directly setting audio.src, fetch the audio first
    const response = await fetch(currentURL);
    
    if (!response.ok) {
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
    };
    
  } catch (error) {
    console.error("Fetch error:", error);
    document.querySelector("#message").textContent = "Error fetching audio: " + error.message;
  }
}