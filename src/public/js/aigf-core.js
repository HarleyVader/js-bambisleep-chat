let token = '';
const socket = io({
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

// Make socket available globally
window.socket = socket;

const _textArray = [];
const textarea = document.getElementById('textarea');
const submit = document.getElementById('submit');
const response = document.getElementById('response');
const userPrompt = document.getElementById('user-prompt');
let currentMessage = '';

document.addEventListener('DOMContentLoaded', function() {
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

let debounceTimeout;
submit.addEventListener('click', (event) => {
    event.preventDefault();
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        handleClick();
    }, 200);
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
    
    // Check for trigger words in the response
    detectAndPlayTriggers(messageText);
});

// Function to detect trigger words in text and play them
function detectAndPlayTriggers(text) {
    // Skip if text is empty
    if (!text) return;
    
    // Try to get triggers from server first
    fetch('/config/triggers.json')
        .then(response => response.json())
        .then(data => {
            // Get the active triggers
            const activeTriggers = getActiveTriggers();
            processTriggersInText(text, data.triggers, activeTriggers);
        })
        .catch(error => {
            // Fallback to bambiAudio if available
            if (typeof window.bambiAudio !== 'undefined') {
                const allTriggers = window.bambiAudio.getAllTriggers();
                if (allTriggers && allTriggers.length) {
                    const activeTriggers = getActiveTriggers();
                    processTriggersInText(text, allTriggers, activeTriggers);
                }
            } else {
                console.error('Failed to load triggers:', error);
            }
        });
}

// Get active triggers from DOM or localStorage
function getActiveTriggers() {
    // Try to get from toggles first
    const activeTriggerElements = document.querySelectorAll('.toggle-input:checked');
    if (activeTriggerElements.length > 0) {
        return Array.from(activeTriggerElements).map(el => 
            el.getAttribute('data-trigger')
        ).filter(Boolean);
    }
    
    // Try localStorage next
    try {
        const storedTriggers = localStorage.getItem('bambiActiveTriggers');
        if (storedTriggers) {
            return JSON.parse(storedTriggers);
        }
    } catch (e) {
        console.warn('Error reading stored triggers:', e);
    }
    
    // Return empty array if nothing found
    return [];
}

// Process triggers in text and play matching ones
function processTriggersInText(text, allTriggers, activeTriggers) {
    // Convert text to uppercase for case-insensitive matching
    const uppercaseText = text.toUpperCase();
    
    // Track matched triggers to avoid duplicates
    const matchedTriggers = [];
    
    // Check each trigger
    allTriggers.forEach(trigger => {
        // Skip if trigger name is empty
        if (!trigger.name) return;
        
        // Use the name property directly
        const triggerName = typeof trigger === 'string' ? trigger : trigger.name;
        
        // Skip if this trigger isn't active (unless no active triggers specified)
        if (activeTriggers.length > 0 && !activeTriggers.includes(triggerName)) {
            return;
        }
        
        // Check if trigger appears as a whole word
        const escapedName = triggerName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const triggerRegex = new RegExp(`\\b${escapedName}\\b`, 'i');
        
        if (triggerRegex.test(uppercaseText) && !matchedTriggers.includes(triggerName)) {
            console.log(`Detected trigger: ${triggerName}`);
            matchedTriggers.push(triggerName);
            
            // Play trigger with small delay between each
            setTimeout(() => {
                playTriggerAudio(trigger);
            }, matchedTriggers.length * 350);
        }
    });
    
    // Track trigger events for profile if matches found
    if (matchedTriggers.length > 0 && socket.connected) {
        const username = document.body.getAttribute('data-username') || window.username;
        if (username) {
            socket.emit('trigger-event', {
                username,
                triggers: matchedTriggers,
                source: 'chat'
            });
        }
    }

    // Send only trigger names to worker - no descriptions
    // LMStudio.js will get descriptions from triggers.json directly
    socket.emit('triggers', {
        triggerNames: activeTriggers.join(','),
        triggerDetails: matchedTriggers
    });
}

// Play trigger audio using best available method
function playTriggerAudio(trigger) {
    // If bambiAudio API available, use it
    if (window.bambiAudio && typeof window.bambiAudio.playTrigger === 'function') {
        window.bambiAudio.playTrigger(trigger);
        return;
    }
    
    // Fallback to direct audio playback
    const triggerName = typeof trigger === 'string' ? trigger : trigger.name;
    const filename = typeof trigger === 'object' && trigger.filename 
        ? trigger.filename 
        : triggerName.replace(/\s+/g, '-') + '.mp3';
    
    const audio = new Audio(`/audio/${filename}`);
    audio.volume = 0.8;
    audio.play().catch(err => console.warn('Could not play trigger:', err.message));
    
    // Flash trigger name on screen
    flashTrigger(triggerName, 2000);
}

function applyUppercaseStyle() {
    // Create style if it doesn't exist
    if (!document.getElementById('trigger-word-style')) {
        const style = document.createElement('style');
        style.id = 'trigger-word-style';
        style.textContent = `
            .trigger-word {
                color: #ff00ff;
                font-weight: bold;
                text-shadow: 0 0 5px #ff00ff;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0% { opacity: 0.7; }
                50% { opacity: 1; }
                100% { opacity: 0.7; }
            }
        `;
        document.head.appendChild(style);
    }

    // Check for specific trigger words and apply styling
    const responseElements = document.querySelectorAll('#response p');
    
    // Get all trigger names if available
    let triggerNames = [];
    if (window.bambiAudio && typeof window.bambiAudio.getAllTriggers === 'function') {
        const allTriggers = window.bambiAudio.getAllTriggers();
        if (allTriggers && allTriggers.length) {
            triggerNames = allTriggers.map(t => t.name);
        }
    }
    
    // Fallback to common triggers if API not available
    if (!triggerNames.length) {
        triggerNames = [
            'BAMBI SLEEP', 'GOOD GIRL', 'BAMBI RESET', 'BIMBO DOLL', 'BAMBI FREEZE',
            'SAFE & SECURE', 'AIRHEAD BARBIE', 'BRAINDEAD BOBBLEHEAD', 'COCKBLANK LOVEDOLL',
            'SNAP & FORGET', 'ZAP COCK DRAIN OBEY', 'UNIFORM LOCK', 'PRIMPED & PAMPERED',
            'GIGGLE TIME', 'BLONDE MOMENT', 'BAMBI DOES AS SHE IS TOLD', 'DROP FOR COCK',
            'BAMBI CUM & COLLAPSE', 'BAMBI ALWAYS WINS', 'GIGGLE DOLL', 'IQ DROP', 'IQ LOCK'
        ];
    }
    
    // Create regex pattern for trigger words
    const triggerPattern = triggerNames.map(name => name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
    const triggerRegex = new RegExp(`\\b(${triggerPattern})\\b`, 'gi');
    
    responseElements.forEach(element => {
        const text = element.textContent;
        const formattedText = text.replace(triggerRegex, match => {
            return `<span class="trigger-word">${match}</span>`;
        });
        
        if (formattedText !== text) {
            element.innerHTML = formattedText;
        }
    });
}

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