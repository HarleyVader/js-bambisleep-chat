// BambiSleep Chat Client
const socket = window.socket || io();
window.socket = socket;

let token = '';

// Create arrays and cache DOM elements
const _textArray = [];
const _audioArray = [];
const textarea = document.getElementById('textarea');
const submit = document.getElementById('submit');
const response = document.getElementById('response');
const userPrompt = document.getElementById('user-prompt');

// Share audio element between scripts
window.audio = window.audio || document.getElementById('audio');
const audio = window.audio;

// Variables for state management
let text = '';
let state = true;

// Share arrays with other scripts
window._textArray = _textArray;
window._audioArray = _audioArray;

// Socket event handlers
socket.on('disconnect', () => {
    console.log('Disconnected');
    alert('Bambi disconnected!\nrefresh bambisleep.chat');
});

socket.on('connect', () => {
    console.log('Connected to BambiSleep chat server! Socket ID:', socket.id);
});

socket.on('reconnect_attempt', () => {
    console.log('Attempting to reconnect...');
});

socket.on('reconnect', () => {
    console.log('Reconnected to server');
});

socket.on('reconnect_failed', () => {
    console.error('Failed to reconnect to server');
});

socket.on('connect_error', (error) => {
    console.log('Connection Error:', error.message);
    // Try to reconnect automatically
    setTimeout(() => {
        if (!socket.connected) {
            console.log('Attempting to reconnect...');
            socket.connect();
        }
    }, 2000);
});

// Handle message events from server
socket.on('message', (message) => {
    console.log('Received message:', message);
    // Display in UI if needed
});

// Handle system messages
socket.on('system', (data) => {
    console.log('System message:', data.message);
    if (data.type === 'error') {
        showError(data.message);
    } else {
        showSystemMessage(data.message);
    }
});

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
}

function showSystemMessage(message) {
    const messageElement = document.createElement('p');
    messageElement.className = 'system-message';
    messageElement.textContent = message;
    
    if (response && response.firstChild) {
        response.insertBefore(messageElement, response.firstChild);
    } else if (response) {
        response.appendChild(messageElement);
    }
}

let debounceTimeout;
let isProcessing = false;

if (submit) {
    submit.addEventListener('click', (event) => {
        event.preventDefault();
        
        // Prevent multiple rapid clicks
        if (isProcessing) return;
        
        isProcessing = true;
        clearTimeout(debounceTimeout);
        
        debounceTimeout = setTimeout(() => {
            handleClick();
            
            // Reset processing state after completion or timeout
            setTimeout(() => {
                isProcessing = false;
            }, 1000); // Ensure at least 1 second between submissions
        }, 200);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Fix cookie parsing to handle empty cookie strings
    const cookies = {};
    if (document.cookie) {
        document.cookie.split(";").forEach(cookie => {
            const parts = cookie.split("=").map(c => c.trim());
            if (parts.length === 2) {
                cookies[parts[0]] = parts[1];
            }
        });
    }
    
    let username = decodeURIComponent(cookies['bambiname'] || 'anonBambi').replace(/%20/g, ' ');
    window.username = username;
});

function arrayPush(array, text) {
    if (Array.isArray(array)) {
        array.push(text);
    }
}

function applyUppercaseStyle() {
    // Get all message paragraphs in the response
    const paragraphs = response ? response.querySelectorAll('p') : [];
    
    // Apply uppercase to trigger words
    paragraphs.forEach(p => {
        if (!p) return;
        
        // Get triggers from localStorage
        const triggers = JSON.parse(localStorage.getItem('bambiActiveTriggers') || '[]');
        if (!triggers || triggers.length === 0) return;
        
        // Replace trigger words with uppercase versions
        let html = p.textContent;
        triggers.forEach(trigger => {
            const regex = new RegExp(`\\b${trigger}\\b`, 'gi');
            html = html.replace(regex, match => `<strong>${match.toUpperCase()}</strong>`);
        });
        
        p.innerHTML = html;
    });
}

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

function handleClick() {
    const message = textarea ? textarea.value.trim() : '';

    if (message === '') {
        alert('Message cannot be empty');
        return;
    }
    
    if (userPrompt) userPrompt.textContent = message;
    socket.emit('message', message);

    if (textarea) {
        textarea.value = '';
        textarea.style.height = 'inherit';
    }
}

socket.on('response', async (message) => {
    try {
        // Handle both string and object responses
        const messageText = typeof message === 'object' ? JSON.stringify(message) : message;
        const sentences = messageText.split(/(?<=[:;,.!?]["']?)\s+/g);
        
        // Reset text array
        _textArray.length = 0;
        
        // Add each sentence to the text array
        for (let sentence of sentences) {
            if (sentence.trim()) {
                _textArray.push(sentence);
            }
        }
        
        // Display the full message in response area
        const messageElement = document.createElement('p');
        messageElement.textContent = messageText;
        
        if (response) {
            if (response.firstChild) {
                response.insertBefore(messageElement, response.firstChild);
            } else {
                response.appendChild(messageElement);
            }
        }
        
        // Apply uppercase style to triggers
        applyUppercaseStyle();
        
        // Start processing audio if needed
        if (state && _textArray.length > 0) {
            handleAudioEnded();
        }
    } catch (error) {
        console.error('Error handling response:', error);
    }
});

function handleAudioEnded() {
    try {
        if (_textArray.length > 0) {
            state = false;
            text = _textArray.shift();
            
            if (text && text.trim()) {
                arrayPush(_audioArray, text);
                if (typeof do_tts === 'function') {
                    do_tts(_audioArray);
                }
            } else {
                // If text is empty, move to the next item
                handleAudioEnded();
            }
        } else {
            state = true;
        }
    } catch (error) {
        console.error('Error in handleAudioEnded:', error);
        state = true;
    }
}

function handleAudioPlay() {
    try {
        if (!audio) return;
        
        console.log('Audio is playing');
        const duration = audio.duration * 1000;
        
        // Flash trigger for the duration of the audio
        if (text && text.trim()) {
            flashTrigger(text, duration);
        }
    } catch (error) {
        console.error('Error in handleAudioPlay:', error);
    }
}

// Fix audio event listeners by checking element exists
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

// Handle JSON parse errors gracefully
function safeJsonParse(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        console.log('JSON parse error:', e.message);
        return {};
    }
}

// Make key functions available globally
window.handleClick = handleClick;
window.applyUppercaseStyle = applyUppercaseStyle;