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
  
  // Further reduce text length to avoid timeouts
  let processedText = text;
  if (text.length > 200) {
    processedText = text.substring(0, 200);
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
  
  // Create an audio element each time instead of reusing
  const tempAudio = new Audio();
  
  try {
    tempAudio.src = currentURL;
    tempAudio.onloadeddata = () => {
      document.querySelector("#message").textContent = "Playing...";
      tempAudio.play();
    };
    
    tempAudio.onended = () => {
      document.querySelector("#message").textContent = "Finished";
      // Process next in queue after a small delay
      if (_audioArray.length > 0) {
        setTimeout(() => do_tts(_audioArray), 500);
      }
    };
    
    tempAudio.onerror = () => {
      console.log("Audio error, skipping to next");
      document.querySelector("#message").textContent = "TTS error, skipping";
      
      if (_audioArray.length > 0) {
        setTimeout(() => do_tts(_audioArray), 500);
      }
    };
  } catch (error) {
    console.log("TTS error:", error);
    document.querySelector("#message").textContent = "TTS failed";
    
    if (_audioArray.length > 0) {
      setTimeout(() => do_tts(_audioArray), 500);
    }
  }
}

// Get available voices - simplified without timeout handling
async function fetchAvailableVoices() {
  try {
    const response = await fetch('/api/tts/voices');
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.log("Voice fetch error:", error);
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