let state = true;
let _audioArray = [];
let duration = 0;
const audio = document.getElementById('audio');

function arrayPush(_audioArray, e) {
  document.querySelector("#audio").hidden = true;

  const speakerWav = '../bambi.wav';
  const language = 'en';

  let URL = `https://bambisleep.chat/api/tts?text=${encodeURIComponent(e)}&speakerWav=${encodeURIComponent(speakerWav)}&language=${encodeURIComponent(language)}`;
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
  };
  audio.onerror = function (e) {
    console.error("Error playing audio:", e);
    document.querySelector("#message").textContent = "Error playing audio." + e;
    alert("Error playing audio. Please try again later.");
  };
};

document.addEventListener("DOMContentLoaded", () => {
  const audioUploadForm = document.getElementById('audio-upload-form');
  const uploadMessage = document.getElementById('upload-message');

  audioUploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const audioFile = document.getElementById('audio-file').files[0];

    if (audioFile && audioFile.type === 'audio/wav') {
      const formData = new FormData();
      formData.append('audio', audioFile);

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
          uploadMessage.textContent = 'Upload failed. Please try again.';
        }
      } catch (error) {
        console.error('Error uploading audio file:', error);
        uploadMessage.textContent = 'Error uploading audio file.';
      }
    } else {
      uploadMessage.textContent = 'Please upload a valid .wav file.';
    }
  });
});