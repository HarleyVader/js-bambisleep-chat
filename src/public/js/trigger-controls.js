/**
 * Trigger controls module for BambiSleep Chat
 * Handles activation/deactivation of trigger words
 */
window.triggerControls = (function() {
  // Private variables
  let activeTriggers = [];
  let triggerButtons = [];
  
  // Init module
  function init() {
    setupEventListeners();
    loadTriggerWords();
    loadSavedTriggers();
    
    // Notify system that trigger controls are ready
    document.dispatchEvent(new CustomEvent('trigger-controls-loaded'));
  }
  
  // Set up event listeners
  function setupEventListeners() {
    const toggleAllBtn = document.getElementById('activate-all');
    if (toggleAllBtn) toggleAllBtn.addEventListener('click', toggleAllTriggers);
    
    const playTriggersBtn = document.getElementById('play-triggers');
    if (playTriggersBtn) playTriggersBtn.addEventListener('click', playTriggerAudio);
    
    // Listen for system state changes
    document.addEventListener('system-update', handleSystemUpdate);
  }
  
  // Clean up event listeners
  function tearDown() {
    const toggleAllBtn = document.getElementById('activate-all');
    if (toggleAllBtn) toggleAllBtn.removeEventListener('click', toggleAllTriggers);
    
    const playTriggersBtn = document.getElementById('play-triggers');
    if (playTriggersBtn) playTriggersBtn.removeEventListener('click', playTriggerAudio);
    
    document.removeEventListener('system-update', handleSystemUpdate);
    
    // Remove trigger toggle listeners
    document.querySelectorAll('.toggle-input').forEach(toggle => {
      toggle.removeEventListener('change', handleTriggerToggle);
    });
  }
  
  // Load trigger words from server (or use defaults)
  function loadTriggerWords() {
    const triggerList = document.getElementById('trigger-list');
    if (!triggerList) return;
    
    // First check if the list is already populated
    if (triggerList.children.length > 0) {
      // Connect event listeners to existing triggers
      connectExistingTriggers();
      return;
    }
    
    // Otherwise, fetch trigger words from server
    fetch('/config/triggers.json')
      .then(response => response.json())
      .then(data => {
        if (data && data.triggers && Array.isArray(data.triggers)) {
          renderTriggerList(data.triggers, triggerList);
        }
      })
      .catch(error => {
        console.error('Error loading triggers:', error);
        // Use default triggers as fallback
        const defaultTriggers = [
          { name: "BAMBI SLEEP", description: "triggers deep trance" },
          { name: "GOOD GIRL", description: "reinforces obedience" },
          { name: "LISTEN AND OBEY", description: "increases suggestibility" }
        ];
        renderTriggerList(defaultTriggers, triggerList);
      });
  }
  
  // Connect event listeners to existing triggers
  function connectExistingTriggers() {
    document.querySelectorAll('.toggle-input').forEach(toggle => {
      toggle.addEventListener('change', handleTriggerToggle);
    });
  }
  
  // Award XP for trigger usage
  function awardTriggerXp() {
    const username = document.body.getAttribute('data-username') || window.username;
    
    if (!username || username === 'anonBambi' || !window.socket) {
      return;
    }
    
    // Count active triggers
    const activeCount = document.querySelectorAll('.toggle-input:checked').length;
    
    // Base amount for single trigger
    let amount = 3;
    
    // Bonus for multiple triggers (max +7 for 8+ triggers)
    if (activeCount > 1) {
      amount += Math.min(activeCount - 1, 7);
    }
    
    // Send XP award event
    window.socket.emit('award-xp', {
      username: username,
      amount: amount,
      action: 'trigger_activated'
    });
    
    // Show notification if function exists
    if (typeof showXPNotification === 'function') {
      showXPNotification(amount);
    }
  }
  
  // Handle trigger toggle change
  function handleTriggerToggle() {
    // Save state
    saveTriggerState();
    
    // Award XP when enabling a trigger
    if (this.checked) {
      awardTriggerXp();
    }
  }
  
  // Render the trigger list in the UI
  function renderTriggerList(triggers, container) {
    if (!container) return;
    
    // Clear existing content
    container.innerHTML = '';
    
    // Render each trigger
    triggers.forEach(trigger => {
      const triggerDiv = document.createElement('div');
      triggerDiv.className = 'trigger-toggle-item';
      
      const id = `trigger-${trigger.name.replace(/\s+/g, '-').toLowerCase()}`;
      
      triggerDiv.innerHTML = `
        <input type="checkbox" id="${id}" class="toggle-input" data-trigger="${trigger.name}" data-description="${trigger.description || 'Trigger effect'}">
        <label for="${id}" class="toggle-label">${trigger.name}</label>
        <span class="trigger-description">${trigger.description || 'Trigger effect'}</span>
      `;
      
      container.appendChild(triggerDiv);
      
      // Add event listener
      const input = triggerDiv.querySelector('.toggle-input');
      if (input) {
        input.addEventListener('change', handleTriggerToggle);
      }
    });
    
    // Now apply saved triggers
    loadSavedTriggers();
  }
  
  // Toggle all triggers
  function toggleAllTriggers() {
    // Get current state to determine if we should check or uncheck all
    const toggles = document.querySelectorAll('.toggle-input');
    const checkCount = Array.from(toggles).filter(t => t.checked).length;
    const shouldCheck = checkCount <= toggles.length / 2;
    
    // Set all toggles to the new state
    toggles.forEach(toggle => {
      toggle.checked = shouldCheck;
    });
    
    // Save the changes
    saveTriggerState();
  }
  
  // Play trigger audio if available
  function playTriggerAudio() {
    if (window.bambiAudio && typeof window.bambiAudio.playRandomPlaylist === 'function') {
      window.bambiAudio.playRandomPlaylist();
    }
  }
  
  // Load saved triggers from central state
  function loadSavedTriggers() {
    let triggers = [];
    
    // Try loading from bambiSystem first
    if (window.bambiSystem && typeof window.bambiSystem.collectSettings === 'function') {
      const settings = window.bambiSystem.collectSettings();
      if (settings && settings.activeTriggers) {
        triggers = settings.activeTriggers;
      }
    }
    
    // Fallback to localStorage
    if (!triggers.length) {
      try {
        const saved = localStorage.getItem('bambiActiveTriggers');
        if (saved) {
          const parsed = JSON.parse(saved);
          triggers = Array.isArray(parsed) ? parsed : [];
        }
      } catch (e) {
        console.error('Error loading triggers:', e);
      }
    }
    
    // Apply to UI
    if (triggers.length > 0) {
      document.querySelectorAll('.toggle-input').forEach(toggle => {
        const name = toggle.getAttribute('data-trigger');
        if (name && triggers.includes(name)) {
          toggle.checked = true;
        }
      });
    }
  }
  
  // Handle system state updates
  function handleSystemUpdate(event) {
    // Only update if it's a triggers update
    if (event.detail && (event.detail.section === 'triggers' || event.detail.section === 'all')) {
      loadSavedTriggers();
    }
  }
  
  // Save trigger state
  function saveTriggerState() {
    // Get active triggers
    const triggers = [];
    document.querySelectorAll('.toggle-input:checked').forEach(toggle => {
      const name = toggle.getAttribute('data-trigger');
      const desc = toggle.getAttribute('data-description') || 'Trigger effect';
      
      if (name) triggers.push({ name, description: desc });
    });
    
    // Store active triggers locally
    activeTriggers = triggers.map(t => t.name);
    
    // Save with centralized system if available
    if (window.bambiSystem && typeof window.bambiSystem.saveState === 'function') {
      window.bambiSystem.saveState('triggers', { triggers });
    } else {
      // Fallback to localStorage
      localStorage.setItem('bambiActiveTriggers', JSON.stringify(activeTriggers));
    }
    
    // Send to server
    syncWithServer(triggers);
  }
  
  // Sync with server
  function syncWithServer(triggers) {
    if (window.socket && window.socket.connected) {
      const username = document.body.getAttribute('data-username') || window.username;
      
      if (username) {
        window.socket.emit('triggers', {
          triggerNames: triggers.map(t => t.name).join(','),
          triggerDetails: triggers,
          username: username
        });
      }
    }
  }
  
  // Refresh triggers based on current DOM values
  function refreshTriggers() {
    const triggers = [];
    document.querySelectorAll('.toggle-input:checked').forEach(toggle => {
      const name = toggle.getAttribute('data-trigger');
      if (name) triggers.push(name);
    });
    
    activeTriggers = triggers;
  }
  
  // Get active triggers
  function getActiveTriggers() {
    return activeTriggers;
  }
  
  // Public API
  return {
    init,
    tearDown,
    saveTriggerState,
    refreshTriggers,
    getActiveTriggers
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.triggerControls.init);