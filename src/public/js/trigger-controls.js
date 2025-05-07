// Trigger controls module for managing trigger toggles

(function() {
  // Initialize trigger controls
  function init() {
    initTriggerList();
    initTriggerButtons();
  }
  
  // Initialize trigger list
  function initTriggerList() {
    const triggerList = document.getElementById('trigger-list');
    
    // Clear any existing content to avoid duplicates
    if (triggerList) {
      triggerList.innerHTML = '';
      
      // Fetch triggers from the JSON file
      fetch('/config/triggers.json')
        .then(response => response.json())
        .then(data => {
          const triggers = data.triggers;
          var activeTriggers = [];
          
          if (typeof profileData !== 'undefined' && profileData.systemControls && profileData.systemControls.activeTriggers) {
            activeTriggers = profileData.systemControls.activeTriggers;
          }
          
          triggers.forEach((trigger, index) => {
            var triggerItem = document.createElement('div');
            triggerItem.className = 'trigger-toggle-item';
            
            var toggle = document.createElement('input');
            toggle.type = 'checkbox';
            toggle.id = `toggle-${index}`;
            toggle.className = 'toggle-input';
            toggle.setAttribute('data-trigger', trigger.name);
            toggle.setAttribute('data-description', trigger.description || '');
            toggle.title = trigger.description || '';
            toggle.checked = activeTriggers.includes(trigger.name);
            
            toggle.addEventListener('change', function() {
              // Award XP when enabling a trigger
              if (toggle.checked && window.socket && window.socket.connected) {
                socket.emit('award-xp', {
                  username: document.body.getAttribute('data-username') || window.username,
                  amount: 3,
                  action: 'trigger_used'
                });
                
                // Play trigger sound if available in triggers.js
                if (window.playTriggerSound && typeof window.playTriggerSound === 'function') {
                  window.playTriggerSound(trigger.name);
                }
              }
              
              // Save and broadcast the change
              saveTriggerState();
              sendTriggerUpdate();
            });
            
            var label = document.createElement('label');
            label.htmlFor = `toggle-${index}`;
            label.className = 'toggle-label';
            label.textContent = trigger.name;
            label.title = trigger.description || '';
            
            triggerItem.appendChild(toggle);
            triggerItem.appendChild(label);
            triggerList.appendChild(triggerItem);
          });
          
          // Initial sync of trigger state
          sendTriggerUpdate();
          
          // Dispatch trigger controls loaded event
          document.dispatchEvent(new Event('trigger-controls-loaded'));
        })
        .catch(error => {
          console.error('Error loading triggers:', error);
          triggerList.innerHTML = '<p>Failed to load triggers. Please refresh the page.</p>';
        });
    }
  }
  
  // Initialize trigger control buttons
  function initTriggerButtons() {
    const selectAllBtn = document.getElementById('select-all-triggers');
    const clearAllBtn = document.getElementById('clear-all-triggers');
    const playBtn = document.getElementById('play-triggers');
    const activateAllBtn = document.getElementById('activate-all');
    
    if (activateAllBtn) {
      let allActive = false;
      activateAllBtn.addEventListener('click', function() {
        allActive = !allActive;
        document.querySelectorAll('.toggle-input').forEach(toggle => {
          toggle.checked = allActive;
        });
        saveTriggerState();
        sendTriggerUpdate();
      });
    }
    
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', function() {
        document.querySelectorAll('.toggle-input').forEach(toggle => {
          toggle.checked = true;
        });
        saveTriggerState();
        sendTriggerUpdate();
      });
    }
    
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', function() {
        document.querySelectorAll('.toggle-input').forEach(toggle => {
          toggle.checked = false;
        });
        saveTriggerState();
        sendTriggerUpdate();
      });
    }
    
    if (playBtn) {
      playBtn.addEventListener('click', playActiveTriggers);
    }
  }
  
  // Save trigger state to profile
  function saveTriggerState() {
    var username = document.body.getAttribute('data-username') || window.username;
    if (!username) return;
    
    var activeTriggers = [];
    document.querySelectorAll('.toggle-input:checked').forEach(input => {
      activeTriggers.push(input.getAttribute('data-trigger'));
    });
    
    // Update profile via socket or fetch
    if (window.socket && window.socket.connected) {
      socket.emit('update-system-controls', {
        username: username,
        activeTriggers: activeTriggers
      });
    } else {
      fetch(`/profile/${username}/system-controls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeTriggers: activeTriggers })
      });
    }
  }
  
  // Send trigger info to LMStudio worker
  function sendTriggerUpdate() {
    const activeTriggers = Array.from(document.querySelectorAll('.toggle-input:checked')).map(toggle => ({
      name: toggle.getAttribute('data-trigger'),
      description: toggle.getAttribute('data-description') || ''
    })).filter(t => t.name);
    
    // Save to localStorage
    try {
      localStorage.setItem('bambiActiveTriggers', JSON.stringify(activeTriggers.map(t => t.name)));
    } catch(e) {}
    
    // Send to worker via socket
    if (window.socket && window.socket.connected) {
      socket.emit('triggers', {
        triggerNames: activeTriggers.map(t => t.name).join(','),
        triggerDetails: activeTriggers
      });
    }
    
    // Notify other components
    document.dispatchEvent(new CustomEvent('system-control-loaded', {
      detail: {
        type: 'triggers',
        activeTriggers: activeTriggers.map(t => t.name)
      }
    }));
  }
  
  // Play all active triggers in sequence
  function playActiveTriggers() {
    const activeTriggers = Array.from(document.querySelectorAll('.toggle-input:checked')).map(toggle => ({
      name: toggle.getAttribute('data-trigger'),
      description: toggle.getAttribute('data-description') || ''
    })).filter(t => t.name);
    
    if (activeTriggers.length === 0) {
      console.log("No triggers selected");
      return;
    }
    
    // Use playRandomPlaylist from triggers.js if available
    if (window.playRandomPlaylist && typeof window.playRandomPlaylist === 'function') {
      window.playRandomPlaylist();
      return;
    }
    
    // Simple fallback player
    const playNext = (index) => {
      if (index >= activeTriggers.length) return;
      
      const trigger = activeTriggers[index];
      
      // Use playTriggerSound from triggers.js if available
      if (window.playTriggerSound && typeof window.playTriggerSound === 'function') {
        window.playTriggerSound(trigger.name);
        
        // Play next after delay
        setTimeout(() => playNext(index + 1), 2000);
      }
    };
    
    // Start playing
    playNext(0);
  }
  
  // Export functions
  window.bambiTriggers = {
    init,
    saveTriggerState,
    sendTriggerUpdate,
    playActiveTriggers
  };
  
  // Auto-initialize on load
  document.addEventListener('DOMContentLoaded', init);
})();