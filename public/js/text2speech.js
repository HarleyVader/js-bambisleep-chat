let state = true;
let _audioArray = [];
let duration = 0;
const audio = document.getElementById('audio');

function displayErrorMessage(message) {
  const errorMessageElement = document.getElementById('error-message');
  errorMessageElement.textContent = message;
  errorMessageElement.style.display = 'block';
}

function arrayPush(_audioArray, e, speakerWav = 'bambi.wav') {
  document.querySelector("#audio").hidden = true;

  const language = 'en';

  let URL = `/api/tts?text=${encodeURIComponent(e)}&speakerWav=${encodeURIComponent(speakerWav)}&language=${encodeURIComponent(language)}`;
  console.log("Generated TTS URL:", URL);
  _audioArray.push(URL);

  return _audioArray;
}

function arrayShift(_audioArray) {
  if (_audioArray.length > 0 && audio !== null) {
    let _currentURL = _audioArray.shift();
    console.log("currentURL ", _currentURL);
    return _currentURL;
  }
}

async function do_tts(_audioArray) {
  document.querySelector("#message").textContent = "Synthesizing...";

  let currentURL = arrayShift(_audioArray);
  if (!currentURL) {
    console.error("[FRONTEND ERROR] No URL found in the audio array.");
    document.querySelector("#message").textContent = "Error: No audio URL found.";
    displayErrorMessage("Error: No audio URL found.");
    return;
  }

  audio.src = currentURL;
  console.log("audio.src ", audio.src);
  audio.load();
  audio.onloadedmetadata = function () {
    console.log("audio ", audio);
    console.log("audio.duration ", audio.duration);
    document.querySelector("#message").textContent = "Playing...";
    audio.play();
  };
  audio.onended = function () {
    console.log("audio ended");
    document.querySelector("#message").textContent = "Finished!";
    handleAudioEnded();
  };
  audio.onerror = function (e) {
    console.error("[FRONTEND ERROR] Error playing audio:", e);
    console.error("[FRONTEND ERROR] Audio source URL:", audio.src);
    console.error("[FRONTEND ERROR] Audio element state:", {
      src: audio.src,
      currentTime: audio.currentTime,
      duration: audio.duration,
      networkState: audio.networkState,
      readyState: audio.readyState,
      error: audio.error
    });
    document.querySelector("#message").textContent = "Error playing audio. Please try again later.";
    displayErrorMessage("Error playing audio. Please try again later.");
    if (e.target.error.code === e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      console.error("[FRONTEND ERROR] Audio source not supported. Please check the URL.");
    } else if (e.target.error.code === e.target.error.MEDIA_ERR_NETWORK) {
      console.error("[FRONTEND ERROR] Network error occurred while fetching the audio.");
    } else if (e.target.error.code === e.target.error.MEDIA_ERR_DECODE) {
      console.error("[FRONTEND ERROR] Error decoding the audio file.");
    } else if (e.target.error.code === e.target.error.MEDIA_ERR_ABORTED) {
      console.error("[FRONTEND ERROR] Audio playback was aborted.");
    }
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const audioUploadForm = document.getElementById('audio-upload-form');
  const uploadMessage = document.getElementById('upload-message');

  audioUploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const audioFile = document.getElementById('audio-file').files[0];
    const socketId = document.getElementById('socket-id').value;

    if (audioFile && audioFile.type === 'audio/wav') {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('socket-id', socketId);

      try {
        const response = await fetch('/api/upload-audio', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          uploadMessage.textContent = 'Upload successful!';
          console.log('Uploaded file path:', result.filePath);
        } else {
          const errorData = await response.json();
          uploadMessage.textContent = `Upload failed: ${errorData.details}`;
        }
      } catch (error) {
        console.error('Error uploading audio file:', error);
        uploadMessage.textContent = 'Error uploading audio file.';
      }
    } else {
      uploadMessage.textContent = 'Please upload a valid .wav file.';
    }
  });

  // Handle TTS form submission
  document.getElementById('tts-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = document.getElementById('tts-text').value;
    const speakerWav = document.getElementById('tts-speaker-wav').value;
    const language = document.getElementById('tts-language').value;
    const useCuda = true; // Set this based on your requirements

    socket.emit('generate tts', { text, speaker_wav: speakerWav, language, output_file: 'output.wav', use_cuda: useCuda });
  });

  socket.on('tts success', (message) => {
    document.getElementById('tts-message').textContent = 'TTS generation successful!';
    console.log('TTS generation successful:', message);
    // Play the generated TTS audio
    audio.src = 'output.wav';
    audio.load();
    audio.play();
  });

  socket.on('tts error', (error) => {
    document.getElementById('tts-message').textContent = `TTS generation failed: ${error}`;
    console.error('TTS generation failed:', error);
  });
});