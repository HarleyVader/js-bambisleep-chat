// audio element & functions required to be placed in control fronend
    <audio id="audio" hidden controls></audio>

/* socker.on('respone'), function handles response text block, type checks for string, show tts & audio play errors to the user, splits upon punctuation
* IMPORTANT needs to be updated to handle new trigger highlighting, trigers should always be said on their own using kokoro.js
*
*/

let state = false; // tts play state machine, it must be used for



socket.on('response', async (message) => {
    console.log('Raw response received:', message);

    // Validate the message first
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        console.warn('Received empty or invalid response:', message);
        // Show user-friendly error message
        const errorElement = document.createElement('p');
        errorElement.className = 'system-error';
        errorElement.textContent = 'AI response was empty. Please try your message again.';
        if (response) {
            if (response.firstChild) {
                response.insertBefore(errorElement, response.firstChild);
            } else {
                response.appendChild(errorElement);
            }
        }
        return;
    }

    const messageText = message.trim();
    console.log('Processing message text:', messageText);

    const sentences = messageText.split(/(?<=[:;,.!?]["']?)\s+/g); // must be updated to not split triggers
    console.log('Split into sentences:', sentences);
    // Send response processing through control network
    if (window.bambiControlNetwork && typeof window.bambiControlNetwork.processControlSignal === 'function') {
        const nodeId = window.bambiControlNetwork.clientNodeId || 'aigf-core';
        window.bambiControlNetwork.processControlSignal('AI_RESPONSE_RECEIVED', {
            content: messageText,
            sentenceCount: sentences.length,
            timestamp: Date.now(),
            source: 'AIGF_CORE'
        }, nodeId);

    } for (let sentence of sentences) {
        sentence = sentence.trim();
        if (sentence.length > 0) { // Only add non-empty sentences
            if (_textArray) {
                _textArray.push(sentence);
                console.log('Text array:', _textArray);
            }
            if (state) {
                handleAudioEnded();
            }
        }
    }
    applyUppercaseStyle();
});

// core syncronization function THIS MUST BE EXACTLY AS IT IS
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
    flashTrigger(text, duration);
    const messageElement = document.createElement('p'); // should target replies
    messageElement.textContent = text;
    console.log('Text reply: ', messageElement.textContent);
    if (response.firstChild) {
        response.insertBefore(messageElement, response.firstChild);
    } else {
        response.appendChild(messageElement);
    }
    applyUppercaseStyle();
}

// Add null check before adding event listeners
if (audio) {
    audio.addEventListener('ended', handleAudioEnded);
    audio.addEventListener('play', handleAudioPlay);
}

// Clean up event listeners when appropriate
function cleanup() {
    if (audio) {
        audio.removeEventListener('ended', handleAudioEnded);
        audio.removeEventListener('play', handleAudioPlay);
    }
    if (submit) {
        submit.removeEventListener('click', handleClick);
    }
    socket.off('response');
    socket.off('reconnect');
    socket.off('disconnect');
    socket.off('message');
    socket.off('system');
}

// Call cleanup when needed
window.addEventListener('beforeunload', cleanup);

// should play text audio & show audio text in the center if the spiral
function flashTrigger(trigger, duration) {
    const container = document.getElementById("eye");
    if (!container) return;

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
