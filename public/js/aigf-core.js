let token = '';

const _textArray = [];
const textarea = document.getElementById('textarea');
const submit = document.getElementById('submit');
const response = document.getElementById('response');
const userPrompt = document.getElementById('user-prompt');
let currentMessage = '';

let debounceTimeout;
if (!submit.dataset.listenerAdded) {
    submit.addEventListener('click', (event) => {
        event.preventDefault();
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            handleClick();
        }, 200);
    });
    submit.dataset.listenerAdded = true;
}

document.addEventListener("DOMContentLoaded", () => {
    const cookies = document.cookie.split(";").reduce((acc, cookie) => {
        const [name, value] = cookie.split("=").map(c => c.trim());
        acc[name] = value;
        return acc;
    }, {});
    console.log("Site Cookies:", cookies);
    let username = decodeURIComponent(cookies['bambiname'] || 'anonBambi').replace(/%20/g, ' ');
    if (username === 'anonBambi') {
        socket.emit('username set');
    }
    console.log("Username:", username);
    window.username = username;
});

function flashTrigger(trigger, duration) {
    const container = document.getElementById("eye");
    container.innerHTML = "";
    const span = document.createElement("span");
    span.textContent = trigger;
    container.appendChild(span);

    setTimeout(() => {
        requestAnimationFrame(() => {
            container.innerHTML = "";
        });
    }, duration);
}

function handleClick() {
    const message = textarea.value.trim();
    console.log('Message:', message);

    if (message === '') {
        alert('Message cannot be empty');
        return;
    }
    userPrompt.textContent = message;
    socket.emit('message', message);

    textarea.value = '';
    textarea.style.height = 'inherit';
}

socket.on('response', async (message) => {
    const messageText = message;
    const sentences = messageText.split(/(?<=[:;,.!?]["']?)\s+/g);
    for (let sentence of sentences) {
        _textArray.push(sentence);
        console.log('Text array:', _textArray);
        if (state) {
            handleAudioEnded();
        }
        sentence = '';
    }
    applyUppercaseStyle();
});

function handleAudioEnded() {
    if (_textArray.length > 0) {
        state = false;
        text = _textArray.shift();
    } else if (_textArray.length === 0) {
        state = true;
        return;
    }
    arrayPush(_audioArray, text);
    do_tts(_audioArray);
}

function handleAudioPlay() {
    console.log('Audio is playing');
    const duration = audio.duration * 1000;
    new Promise(resolve => setTimeout(resolve, duration));
    flashTrigger(text, duration);
    const messageElement = document.createElement('p');
    messageElement.textContent = text;
    console.log('Text reply: ', messageElement.textContent);
    if (response.firstChild) {
      response.insertBefore(messageElement, response.firstChild);
    } else {
      response.appendChild(messageElement);
    }
    applyUppercaseStyle();
  }

audio.addEventListener('ended', handleAudioEnded);
audio.addEventListener('play', handleAudioPlay);