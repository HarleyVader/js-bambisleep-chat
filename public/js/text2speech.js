let state = true;
let _audioArray = [];
let duration = 0;
const audioElement = document.getElementById('audioElement'); // Renamed to audioElement

function arrayPush(_audioArray, e) {
  document.querySelector("#audioElement").hidden = true;

  let URL = `https://bambisleep.chat/api/tts?text=${encodeURIComponent(e)}`;
  _audioArray.push(URL);

  console.log("audioArray ", _audioArray);
  console.log("length ", _audioArray.length);
  return _audioArray;
}

function arrayShift(_audioArray) {
  if (_audioArray.length > 0 && audioElement !== null) {
    let _currentURL = _audioArray.shift();
    console.log("currentURL ", _currentURL);
    return _currentURL;
  }
}

async function do_tts(_audioArray) {
  state = false;
  document.querySelector("#message").textContent = "Synthesizing...";

  let currentURL = arrayShift(_audioArray);
  audioElement.src = currentURL;
  console.log("audioElement.src ", audioElement.src);
  audioElement.load();
  audioElement.onloadedmetadata = function () {
    console.log("audioElement ", audioElement);
    console.log("audioElement.duration ", audioElement.duration);
    document.querySelector("#message").textContent = "Playing...";
    audioElement.play();
  };
  audioElement.onended = function () {
    console.log("audioElement ended");
    document.querySelector("#message").textContent = "Finished!";
  };
  audioElement.onerror = function (e) {
    console.error("Error playing audio:", e);
    document.querySelector("#message").textContent = "Error playing audio.";
  };
};