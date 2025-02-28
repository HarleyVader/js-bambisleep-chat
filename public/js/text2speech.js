let state = true;
let _audioArray = [];
let duration = 0;
const audio = document.getElementById('audio');

function arrayPush(_audioArray, e) {
  document.querySelector("#audio").hidden = true;
  let URL = `https://bambisleep.chat/api/tts?text=${encodeURIComponent(e)}`;
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
  };
};