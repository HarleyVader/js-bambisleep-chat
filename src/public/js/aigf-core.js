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

// Track active triggers globally 
let activeTriggers = [];

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
    
    // Send any active triggers to the worker on connect
    sendActiveTriggers();
});

socket.on('reconnect_attempt', () => {
    console.log('Attempting to reconnect...');
});

socket.on('reconnect', () => {
    console.log('Reconnected to server');
    
    // Re-send trigger information after reconnect
    sendActiveTriggers();
});

socket.on('reconnect_failed', () => {
    console.error('Failed to reconnect to server');
});

// Listen for detected triggers from server
socket.on('detected-triggers', (data) => {
    if (data && data.triggers && data.triggers.length) {
        console.log('Server detected triggers:', data.triggers);
        // Play each detected trigger
        data.triggers.forEach((trigger, index) => {
            setTimeout(() => {
                // Try to find the full trigger object if available
                const triggerObj = typeof trigger === 'string' ? { name: trigger } : trigger;
                playTriggerAudio(triggerObj);
            }, index * 350); // Stagger trigger audio
        });
    }
});

// Replace the existing socket.on('response') handler with this simpler version

socket.on('response', function(message) {
  // Skip if no message received
  if (!message) {
    console.log('Empty response received');
    return;
  }

  try {
    // Get raw text from message regardless of format
    const messageText = typeof message === 'object' ? message.data : message;
    
    // Create and display message element
    const messageElement = document.createElement('p');
    messageElement.textContent = messageText;
    
    if (response.firstChild) {
      response.insertBefore(messageElement, response.firstChild);
    } else {
      response.appendChild(messageElement);
    }
    
    currentMessage = messageText;
    
    // Process text for TTS
    const sentences = messageText.split(/(?<=[:;,.!?]["']?)\s+/g);
    for (let sentence of sentences) {
      if (sentence.trim()) {
        _textArray.push(sentence);
      }
    }
    
    if (state) {
      handleAudioEnded();
    }
    
    // Apply visual styling
    applyUppercaseStyle();
    
    // Check for trigger words
    detectAndPlayTriggers(messageText);
    
    // Scroll to bottom of chat
    if (chatList) {
      chatList.scrollTop = chatList.scrollHeight;
    }
  } catch (err) {
    console.log('Error processing response:', err);
    
    // Simple error fallback
    if (response) {
      const errorElement = document.createElement('p');
      errorElement.textContent = "Error processing response. Please try again.";
      errorElement.style.color = "#ff6b6b";
      response.appendChild(errorElement);
    }
  }
});

// Improve socket connection handling
socket.on('connect_error', () => {
    console.log('Connection error');
    // Show connection error in chat area
    if (response) {
        const errorMsg = document.createElement('p');
        errorMsg.textContent = 'Connection error. Trying to reconnect...';
        errorMsg.style.color = '#ff6b6b';
        response.prepend(errorMsg);
    }
});

// Helper function to send active triggers to the worker
function sendActiveTriggers() {
    // Get active triggers
    const triggers = getActiveTriggers();
    if (!triggers.length) return;
    
    // Format trigger objects with descriptions if available
    const triggerDetails = triggers.map(name => {
        // Try to find description in stored descriptions
        let description = '';
        try {
            const storedDescriptions = JSON.parse(localStorage.getItem('bambiTriggerDescriptions') || '{}');
            description = storedDescriptions[name] || '';
        } catch (e) {}
        
        return {
            name: name,
            description: description
        };
    });
    
    // Send to server via socket
    socket.emit('triggers', {
        triggerNames: triggers.join(','),
        triggerDetails: triggerDetails
    });
    
    console.log('Sent active triggers to server:', triggers);
}

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

// Function to detect trigger words in text and play them
function detectAndPlayTriggers(text) {
    // Skip if text is empty
    if (!text) return;
    
    // Log the received text for debugging
    console.log(`Checking for triggers in: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    
    // Try to get triggers from server first
    fetch('/config/triggers.json')
        .then(response => response.json())
        .then(data => {
            // Log available triggers for debugging
            console.log(`Found ${data.triggers.length} triggers in config`);
            
            // Get the active triggers
            const activeTriggers = getActiveTriggers();
            console.log(`Active triggers: ${activeTriggers.length ? activeTriggers.join(', ') : 'none'}`);
            
            processTriggersInText(text, data.triggers, activeTriggers);
        })
        .catch(error => {
            console.warn('Could not load triggers from server, falling back to bambiAudio API');
            
            // Fallback to bambiAudio if available
            if (typeof window.bambiAudio !== 'undefined') {
                const allTriggers = window.bambiAudio.getAllTriggers();
                if (allTriggers && allTriggers.length) {
                    console.log(`Found ${allTriggers.length} triggers from bambiAudio API`);
                    const activeTriggers = getActiveTriggers();
                    processTriggersInText(text, allTriggers, activeTriggers);
                } else {
                    console.warn('No triggers found in bambiAudio API');
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
        if (!trigger.name && typeof trigger !== 'string') return;
        
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

    // Get trigger descriptions
    const triggerDetails = matchedTriggers.map(name => {
        // Try to find the full trigger object if it's in allTriggers
        const triggerObj = allTriggers.find(t => 
            (typeof t === 'string' && t === name) || 
            (typeof t === 'object' && t.name === name)
        );
        
        if (triggerObj && typeof triggerObj === 'object') {
            return triggerObj;
        }
        
        // Otherwise just return the name
        return { name };
    });

    // Send to worker
    socket.emit('triggers', {
        triggerNames: activeTriggers.join(','),
        triggerDetails: triggerDetails
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
        : triggerName.replace(/\s+/g, '-').toLowerCase() + '.mp3';
    
    console.log(`Playing trigger audio: ${triggerName} (${filename})`);
    
    // Create audio element
    const audio = new Audio(`/audio/triggers/${filename}`);
    audio.volume = 0.8;
    
    // Add error handling to try alternate paths if the first one fails
    audio.onerror = () => {
        console.warn(`Could not load trigger from /audio/triggers/${filename}, trying alternate path`);
        audio.src = `/audio/${filename}`;
        
        audio.onerror = () => {
            console.warn(`Could not load trigger from /audio/${filename} either`);
            flashTrigger(triggerName, 2000); // Flash trigger anyway even if audio fails
        };
        
        audio.play().catch(err => console.warn('Could not play trigger:', err.message));
    };
    
    // Play the audio
    audio.play().catch(err => console.warn('Could not play trigger:', err.message));
    
    // Flash trigger name on screen
    flashTrigger(triggerName, 2000);
}

// Add this function to initialize triggers from the system controls
function initializeFromSystemControls() {
    // Find triggers in the system controls panel
    const toggles = document.querySelectorAll('.trigger-toggle');
    if (toggles.length > 0) {
        const activeTriggers = Array.from(toggles)
            .filter(toggle => toggle.checked)
            .map(toggle => toggle.getAttribute('data-trigger'))
            .filter(Boolean);
        
        if (activeTriggers.length > 0) {
            // Store in localStorage
            localStorage.setItem('bambiActiveTriggers', JSON.stringify(activeTriggers));
            
            // Send to server
            sendActiveTriggers();
        }
    }
}

// Call this when system controls are initialized
document.addEventListener('system-controls-loaded', initializeFromSystemControls);

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

// Simple error handling for audio handlers
function handleAudioPlay() {
    try {
        console.log('Audio is playing');
        const duration = audio?.duration ? audio.duration * 1000 : 2000;
        flashTrigger(text, duration);
        const messageElement = document.createElement('p');
        messageElement.textContent = text || '';
        console.log('Text reply: ', messageElement.textContent);
        if (response) {
            if (response.firstChild) {
                response.insertBefore(messageElement, response.firstChild);
            } else {
                response.appendChild(messageElement);
            }
            applyUppercaseStyle();
        }
    } catch (err) {
        console.log('Error in audio play handler:', err.message);
    }
}

function handleAudioEnded() {
    try {
        if (_textArray.length > 0) {
            state = false;
            text = _textArray.shift();
        } else if (_textArray.length === 0) {
            state = true;
            return;
        }
        arrayPush(_audioArray, text);
        do_tts(_audioArray);
    } catch (err) {
        console.log('Error in audio end handler:', err.message);
        // Try to recover state
        state = true;
    }
}

audio.addEventListener('ended', handleAudioEnded);
audio.addEventListener('play', handleAudioPlay);

// Listen for trigger toggle events
document.addEventListener('trigger-toggle', function(e) {
    if (e.detail) {
        const { trigger, active } = e.detail;
        
        // Update localStorage
        try {
            let activeTriggers = JSON.parse(localStorage.getItem('bambiActiveTriggers') || '[]');
            
            if (active && !activeTriggers.includes(trigger)) {
                activeTriggers.push(trigger);
            } else if (!active) {
                activeTriggers = activeTriggers.filter(t => t !== trigger);
            }
            
            localStorage.setItem('bambiActiveTriggers', JSON.stringify(activeTriggers));
            
            // Send updated triggers to server
            sendActiveTriggers();
        } catch (e) {
            console.error('Error updating active triggers:', e);
        }
    }
});