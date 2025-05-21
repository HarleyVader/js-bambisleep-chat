let state = true;
let _audioArray = [];
let duration = 0;
const audio = document.getElementById('audio');
let currentVoice = 'af_bella'; // Default voice

// Set TTS voice
function setVoice(voice) {
  if (voice && typeof voice === 'string') {
    currentVoice = voice;
    console.log(`TTS voice set to: ${currentVoice}`);
  }
}

// Add text to queue
function arrayPush(_audioArray, text) {
  document.querySelector("#audio").hidden = true;
  
  // Use shorter text chunks if text is very long
  let processedText = text;
  if (text.length > 500) {
    processedText = text.substring(0, 500);
    console.log("Text truncated for TTS to avoid timeouts");
  }
  
  const url = `/api/tts?text=${encodeURIComponent(processedText)}&voice=${encodeURIComponent(currentVoice)}`;
  _audioArray.push(url);
  
  return _audioArray;
}

// Get next URL from queue
function arrayShift(_audioArray) {
  if (_audioArray.length > 0 && audio !== null) {
    return _audioArray.shift();
  }
  return undefined;
}

// Process TTS queue
async function do_tts(_audioArray) {
  document.querySelector("#message").textContent = "Synthesizing...";

  let currentURL = arrayShift(_audioArray);
  if (!currentURL) return;
  
  try {
    // Single attempt with shorter timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
    
    const response = await fetch(currentURL, {
      signal: controller.signal,
      credentials: 'same-origin',
      headers: {'Accept': 'audio/mpeg'}
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    audio.src = audioUrl;
    audio.load();
    
    // Set up audio event handlers
    audio.onloadedmetadata = function() {
      document.querySelector("#message").textContent = "Playing...";
      audio.play().catch(e => {
        document.querySelector("#message").textContent = "Error playing audio";
        processNextAudio(_audioArray, audioUrl);
      });
    };
    
    audio.onended = function() {
      document.querySelector("#message").textContent = "Finished!";
      processNextAudio(_audioArray, audioUrl);
    };
    
    audio.onerror = function() {
      document.querySelector("#message").textContent = "Audio error";
      processNextAudio(_audioArray, audioUrl);
    };
    
  } catch (error) {
    console.error("TTS fetch failed:", error.message);
    document.querySelector("#message").textContent = "TTS failed";
    
    // Continue with next item
    if (_audioArray.length > 0) {
      setTimeout(() => do_tts(_audioArray), 500);
    }
  }
}

// Process next audio in queue
function processNextAudio(_audioArray, currentUrl) {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
  }
  
  if (_audioArray.length > 0) {
    setTimeout(() => do_tts(_audioArray), 500);
  }
}

// Get available voices
async function fetchAvailableVoices() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('/api/tts/voices', {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching voices:", error);
    return [];
  }
}

// Make functions available globally
window.tts = {
  arrayPush,
  arrayShift,
  do_tts,
  setVoice,
  fetchAvailableVoices
};