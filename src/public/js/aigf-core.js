/**
 * AIGF Core module for BambiSleep Chat
 * Handles AI chat functionality and trigger word processing
 */
window.bambiAIGF = (function() {
  // Private variables
  let _textArray = [];
  let currentMessage = '';
  let debounceTimeout;
  let activeTriggers = [];
  
  // DOM elements
  let textarea, submit, response, userPrompt;
  
  // Initialize module
  function init() {
    try {
      // Get DOM elements
      textarea = document.getElementById('textarea');
      submit = document.getElementById('submit');
      response = document.getElementById('response');
      userPrompt = document.getElementById('user-prompt');
      
      // Set up event listeners
      setupEventListeners();
      
      // Load triggers from central state
      loadTriggersFromState();
      
      console.log('AIGF Core initialized');
      
      // Listen for system controls loaded
      document.addEventListener('system-controls-loaded', loadTriggersFromState);
    } catch (error) {
      console.error('Error initializing AIGF Core:', error);
    }
  }
  
  // Set up event listeners
  function setupEventListeners() {
    if (submit) {
      submit.addEventListener('click', handleSubmitClick);
    }
    
    // Socket events
    if (window.socket) {
      window.socket.on('response', handleResponse);
      window.socket.on('detected-triggers', handleDetectedTriggers);
      window.socket.on('connect', sendActiveTriggers);
      window.socket.on('reconnect', sendActiveTriggers);
    }
    
    // Audio events
    if (window.audio) {
      window.audio.addEventListener('ended', handleAudioEnded);
      window.audio.addEventListener('play', handleAudioPlay);
    }
    
    // System events for triggers
    document.addEventListener('trigger-toggle', handleTriggerToggle);
  }
  
  // Clean up event listeners when module is unloaded
  function tearDown() {
    try {
      if (submit) {
        submit.removeEventListener('click', handleSubmitClick);
      }
      
      // Socket events
      if (window.socket) {
        window.socket.off('response', handleResponse);
        window.socket.off('detected-triggers', handleDetectedTriggers);
      }
      
      // Audio events
      if (window.audio) {
        window.audio.removeEventListener('ended', handleAudioEnded);
        window.audio.removeEventListener('play', handleAudioPlay);
      }
      
      // System events
      document.removeEventListener('trigger-toggle', handleTriggerToggle);
      document.removeEventListener('system-controls-loaded', loadTriggersFromState);
      
      // Clear any pending timeouts
      clearTimeout(debounceTimeout);
      
      console.log('AIGF Core teardown complete');
    } catch (error) {
      console.error('Error during AIGF Core teardown:', error);
    }
  }
  
  // Handle submit button click
  function handleSubmitClick(event) {
    event.preventDefault();
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      handleClick();
    }, 200);
  }
  
  // Process user message submission
  function handleClick() {
    const message = textarea.value.trim();
    
    if (message === '') {
      alert('Message cannot be empty');
      return;
    }
    
    userPrompt.textContent = message;
    
    if (window.socket) {
      window.socket.emit('message', message);
    }
    
    textarea.value = '';
    textarea.style.height = 'inherit';
  }
  
  // Handle AI response
  function handleResponse(message) {
    const messageText = message;
    const sentences = messageText.split(/(?<=[:;,.!?]["']?)\s+/g);
    
    for (let sentence of sentences) {
      _textArray.push(sentence);
      
      if (window.state) {
        handleAudioEnded();
      }
    }
    
    applyUppercaseStyle();
    detectAndPlayTriggers(messageText);
  }
  
  // Handle detected triggers from server
  function handleDetectedTriggers(data) {
    if (data && data.triggers && data.triggers.length) {
      console.log('Server detected triggers:', data.triggers);
      
      data.triggers.forEach((trigger, index) => {
        setTimeout(() => {
          const triggerObj = typeof trigger === 'string' ? { name: trigger } : trigger;
          playTriggerAudio(triggerObj);
        }, index * 350);
      });
    }
  }
  
  // Load triggers from bambiSystem
  function loadTriggersFromState() {
    try {
      // Get triggers from central state if available
      if (window.bambiSystem) {
        const state = window.bambiSystem.getState('triggers');
        
        if (state && state.activeTriggers) {
          activeTriggers = state.activeTriggers;
          console.log('Loaded triggers from bambiSystem:', activeTriggers);
          sendActiveTriggers();
        }
      } else {
        // Fall back to legacy method
        const toggles = document.querySelectorAll('.trigger-toggle');
        
        if (toggles.length > 0) {
          activeTriggers = Array.from(toggles)
            .filter(toggle => toggle.checked)
            .map(toggle => toggle.getAttribute('data-trigger'))
            .filter(Boolean);
            
          // Store in bambiSystem when it becomes available
          if (window.bambiSystem) {
            window.bambiSystem.saveState('triggers', { activeTriggers });
          }
          
          sendActiveTriggers();
        }
      }
    } catch (error) {
      console.error('Error loading triggers from state:', error);
    }
  }
  
  // Detect and play triggers in text
  function detectAndPlayTriggers(text) {
    if (!text) return;
    
    fetch('/config/triggers.json')
      .then(response => response.json())
      .then(data => {
        console.log(`Found ${data.triggers.length} triggers in config`);
        processTriggersInText(text, data.triggers, activeTriggers);
      })
      .catch(error => {
        console.warn('Could not load triggers from server, falling back to bambiAudio API');
        
        if (typeof window.bambiAudio !== 'undefined') {
          const allTriggers = window.bambiAudio.getAllTriggers();
          
          if (allTriggers && allTriggers.length) {
            processTriggersInText(text, allTriggers, activeTriggers);
          }
        }
      });
  }
  
  // Process triggers in text and play matching ones
  function processTriggersInText(text, allTriggers, activeTriggers) {
    const uppercaseText = text.toUpperCase();
    const matchedTriggers = [];
    
    allTriggers.forEach(trigger => {
      if (!trigger.name && typeof trigger !== 'string') return;
      
      const triggerName = typeof trigger === 'string' ? trigger : trigger.name;
      
      if (activeTriggers.length > 0 && !activeTriggers.includes(triggerName)) {
        return;
      }
      
      const escapedName = triggerName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const triggerRegex = new RegExp(`\\b${escapedName}\\b`, 'i');
      
      if (triggerRegex.test(uppercaseText) && !matchedTriggers.includes(triggerName)) {
        console.log(`Detected trigger: ${triggerName}`);
        matchedTriggers.push(triggerName);
        
        setTimeout(() => {
          playTriggerAudio(trigger);
        }, matchedTriggers.length * 350);
      }
    });
    
    // Track trigger events for profile
    if (matchedTriggers.length > 0 && window.socket && window.socket.connected) {
      const username = document.body.getAttribute('data-username') || window.username;
      
      if (username) {
        window.socket.emit('trigger-event', {
          username,
          triggers: matchedTriggers,
          source: 'chat'
        });
      }
    }
    
    // Format trigger details
    const triggerDetails = matchedTriggers.map(name => {
      const triggerObj = allTriggers.find(t => 
        (typeof t === 'string' && t === name) || 
        (typeof t === 'object' && t.name === name)
      );
      
      if (triggerObj && typeof triggerObj === 'object') {
        return triggerObj;
      }
      
      return { name };
    });
    
    // Send to worker
    if (window.socket) {
      window.socket.emit('triggers', {
        triggerNames: activeTriggers.join(','),
        triggerDetails: triggerDetails
      });
    }
  }
  
  // Handle trigger toggle event
  function handleTriggerToggle(e) {
    if (e.detail) {
      const { trigger, active } = e.detail;
      
      if (active && !activeTriggers.includes(trigger)) {
        activeTriggers.push(trigger);
      } else if (!active) {
        activeTriggers = activeTriggers.filter(t => t !== trigger);
      }
      
      // Save to central state
      if (window.bambiSystem) {
        window.bambiSystem.saveState('triggers', { activeTriggers });
      }
      
      sendActiveTriggers();
    }
  }
  
  // Send active triggers to server
  function sendActiveTriggers() {
    if (!activeTriggers.length || !window.socket) return;
    
    // Format trigger objects with descriptions
    const triggerDetails = activeTriggers.map(name => {
      let description = '';
      
      try {
        if (window.bambiSystem) {
          const triggerState = window.bambiSystem.getState('triggerDescriptions');
          description = triggerState && triggerState[name] ? triggerState[name] : '';
        }
      } catch (e) {}
      
      return {
        name: name,
        description: description
      };
    });
    
    // Send to server
    if (window.socket && window.socket.connected) {
      window.socket.emit('triggers', {
        triggerNames: activeTriggers.join(','),
        triggerDetails: triggerDetails
      });
      
      console.log('Sent active triggers to server:', activeTriggers);
    }
  }
  
  // Flash trigger on screen
  function flashTrigger(trigger, duration) {
    try {
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
    } catch (error) {
      console.error('Error flashing trigger:', error);
    }
  }
  
  // Play trigger audio
  function playTriggerAudio(trigger) {
    // Use bambiAudio API if available
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
    
    const audio = new Audio(`/audio/triggers/${filename}`);
    audio.volume = 0.8;
    
    audio.onerror = () => {
      console.warn(`Could not load trigger from /audio/triggers/${filename}, trying alternate path`);
      audio.src = `/audio/${filename}`;
      
      audio.onerror = () => {
        console.warn(`Could not load trigger from /audio/${filename} either`);
        flashTrigger(triggerName, 2000);
      };
      
      audio.play().catch(err => console.warn('Could not play trigger:', err.message));
    };
    
    audio.play().catch(err => console.warn('Could not play trigger:', err.message));
    flashTrigger(triggerName, 2000);
  }
  
  // Handle audio ended event
  function handleAudioEnded() {
    if (_textArray.length > 0) {
      window.state = false;
      text = _textArray.shift();
    } else if (_textArray.length === 0) {
      window.state = true;
      return;
    }
    
    if (window.arrayPush && window._audioArray) {
      window.arrayPush(window._audioArray, text);
    }
    
    if (window.do_tts && window._audioArray) {
      window.do_tts(window._audioArray);
    }
  }
  
  // Handle audio play event
  function handleAudioPlay() {
    console.log('Audio is playing');
    
    if (window.audio && window.audio.duration) {
      const duration = window.audio.duration * 1000;
      flashTrigger(text, duration);
    }
    
    const messageElement = document.createElement('p');
    messageElement.textContent = text;
    
    if (response.firstChild) {
      response.insertBefore(messageElement, response.firstChild);
    } else {
      response.appendChild(messageElement);
    }
    
    applyUppercaseStyle();
  }
  
  // Apply styling to trigger words in response
  function applyUppercaseStyle() {
    try {
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
      
      // Get all trigger names
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
      const triggerPattern = triggerNames.map(name => 
        name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
      const triggerRegex = new RegExp(`\\b(${triggerPattern})\\b`, 'gi');
      
      // Apply to all response elements
      const responseElements = document.querySelectorAll('#response p');
      
      responseElements.forEach(element => {
        const text = element.textContent;
        const formattedText = text.replace(triggerRegex, match => {
          return `<span class="trigger-word">${match}</span>`;
        });
        
        if (formattedText !== text) {
          element.innerHTML = formattedText;
        }
      });
    } catch (error) {
      console.error('Error applying trigger word styling:', error);
    }
  }
  
  // Public API
  return {
    init,
    tearDown,
    getActiveTriggers: () => activeTriggers,
    detectAndPlayTriggers
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.bambiAIGF.init);