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
    
    if (triggerList && !triggerList.hasChildNodes()) {
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
            
            // Set tooltip with description
            if (trigger.description) {
              toggle.title = trigger.description;
            }
            
            if (activeTriggers.includes(trigger.name)) {
              toggle.checked = true;
            }
            
            toggle.addEventListener('change', function() {
              saveTriggerState();
              
              // Award XP for using a trigger (+3 XP per trigger use)
              if (typeof socket !== 'undefined' && socket.connected && toggle.checked) {
                socket.emit('award-xp', {
                  username: document.body.getAttribute('data-username') || window.username,
                  amount: 3,
                  action: 'trigger_used'
                });
              }
              
              // Dispatch trigger toggle event
              document.dispatchEvent(new Event('trigger-toggle'));
            });
            
            var label = document.createElement('label');
            label.htmlFor = `toggle-${index}`;
            label.className = 'toggle-label';
            label.textContent = trigger.name;
            
            // Add tooltip to label too
            if (trigger.description) {
              label.title = trigger.description;
            }
            
            triggerItem.appendChild(toggle);
            triggerItem.appendChild(label);
            triggerList.appendChild(triggerItem);
          });
          
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
    const activateAllBtn = document.getElementById('activate-all');
    
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', function() {
        const triggerToggles = document.querySelectorAll('.toggle-input');
        triggerToggles.forEach(toggle => {
          toggle.checked = true;
        });
        
        saveTriggerState();
      });
    }
    
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', function() {
        const triggerToggles = document.querySelectorAll('.toggle-input');
        triggerToggles.forEach(toggle => {
          toggle.checked = false;
        });
        
        saveTriggerState();
      });
    }
    
    if (activateAllBtn) {
      activateAllBtn.addEventListener('click', function() {
        if (window.bambiAudio && typeof window.bambiAudio.toggleAllTriggers === 'function') {
          window.bambiAudio.toggleAllTriggers();
        } else {
          // Fallback toggle behavior
          const triggerToggles = document.querySelectorAll('.toggle-input');
          let allChecked = true;
          
          // Check if all are checked
          triggerToggles.forEach(toggle => {
            if (!toggle.checked) allChecked = false;
          });
          
          // Toggle all based on current state
          triggerToggles.forEach(toggle => {
            toggle.checked = !allChecked;
          });
          
          saveTriggerState();
        }
      });
    }
  }
  
  // Save trigger state
  function saveTriggerState() {
    var username = document.body.getAttribute('data-username') || window.username;
    if (!username) return;
    
    var toggleInputs = document.querySelectorAll('.toggle-input');
    var activeTriggers = [];
    
    toggleInputs.forEach(input => {
      if (input.checked) {
        const triggerName = input.getAttribute('data-trigger');
        activeTriggers.push(triggerName);
      }
    });
    
    if (typeof socket !== 'undefined' && socket.connected) {
      socket.emit('update-system-controls', {
        username: username,
        activeTriggers: activeTriggers
      });
    } else {
      fetch(`/profile/${username}/system-controls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activeTriggers: activeTriggers
        })
      });
    }
  }
  
  // Add this function to consolidate trigger handling
  function sendTriggerUpdate() {
    // Get all active triggers
    const triggerToggles = document.querySelectorAll('.toggle-input:checked');
    const activeTriggers = Array.from(triggerToggles).map(toggle => {
      return {
        name: toggle.getAttribute('data-trigger'),
        description: toggle.getAttribute('data-description') || ''
      };
    }).filter(t => t.name);
    
    // Save to localStorage for persistence
    try {
      localStorage.setItem('bambiActiveTriggers', 
        JSON.stringify(activeTriggers.map(t => t.name)));
    } catch(e) {}
    
    // Send via socket if available
    if (window.socket && window.socket.connected) {
      window.socket.emit('triggers', {
        triggerNames: activeTriggers.map(t => t.name).join(','),
        triggerDetails: activeTriggers
      });
    }
    
    // Dispatch event for other components
    document.dispatchEvent(new CustomEvent('system-control-loaded', {
      detail: {
        type: 'triggers',
        activeTriggers: activeTriggers.map(t => t.name)
      }
    }));
  }
  
  // Call this function after initializing triggers
  document.addEventListener('trigger-controls-loaded', sendTriggerUpdate);
  
  // Call this when any trigger is toggled
  document.addEventListener('trigger-toggle', function() {
    // Debounce to avoid too many updates
    clearTimeout(window.triggerUpdateTimeout);
    window.triggerUpdateTimeout = setTimeout(sendTriggerUpdate, 300);
  });
  
  // Export functions
  window.bambiTriggers = {
    init,
    saveTriggerState
  };
  
  // Auto-initialize on load
  document.addEventListener('DOMContentLoaded', init);
})();