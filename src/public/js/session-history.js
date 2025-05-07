// Session history module
window.bambiHistory = (function() {
  let sessionData = [];
  
  function init() {
    const loadBtn = document.getElementById('load-history-btn');
    const replayBtn = document.getElementById('replay-history-btn');
    const sessionSelect = document.getElementById('session-select');
    
    if (loadBtn) loadBtn.addEventListener('click', loadHistory);
    if (replayBtn) replayBtn.addEventListener('click', replayRandom);
    if (sessionSelect) sessionSelect.addEventListener('change', loadSession);
  }
  
  function loadHistory() {
    const status = document.getElementById('session-history-status');
    status.textContent = 'Loading sessions...';
    status.className = 'session-history-status';
    
    fetch('/api/sessions')
      .then(res => res.json())
      .then(data => {
        sessionData = data.sessions || [];
        updateStats(data);
        populateDropdown(sessionData);
        
        document.querySelector('.session-select-container').style.display = 'block';
        document.querySelector('.session-stats-container').style.display = 'flex';
        
        if (sessionData.length > 0) {
          status.textContent = `${sessionData.length} sessions loaded`;
          status.className = 'session-history-status success';
          document.getElementById('replay-history-btn').disabled = false;
        } else {
          status.textContent = 'No sessions found';
        }
      })
      .catch(err => {
        status.textContent = 'Error loading sessions';
        status.className = 'session-history-status error';
        console.error(err);
      });
  }
  
  function populateDropdown(sessions) {
    const select = document.getElementById('session-select');
    
    // Clear options except first placeholder
    while (select.options.length > 1) {
      select.remove(1);
    }
    
    sessions.forEach(session => {
      const date = new Date(session.createdAt || session.date);
      const option = document.createElement('option');
      option.value = session._id;
      option.textContent = `${date.toLocaleString()} (${session.messages?.length || 0} msgs)`;
      select.appendChild(option);
    });
  }
  
  function updateStats(data) {
    if (document.getElementById('session-count'))
      document.getElementById('session-count').textContent = data.totalSessions || 0;
    if (document.getElementById('message-count'))
      document.getElementById('message-count').textContent = data.totalMessages || 0;
    if (document.getElementById('word-count'))
      document.getElementById('word-count').textContent = data.totalWords || 0;
  }
  
  function loadSession() {
    const sessionId = document.getElementById('session-select').value;
    if (!sessionId) return;
    
    const session = sessionData.find(s => s._id === sessionId);
    if (!session) return;
    
    // Show which session was loaded
    const status = document.getElementById('session-history-status');
    const date = new Date(session.createdAt || session.date).toLocaleString();
    status.textContent = `Loaded session from ${date}`;
    status.className = 'session-history-status success';
    
    // Set collar settings if available
    if (session.collarSettings) {
      const collarEnable = document.getElementById('collar-enable');
      const collarText = document.getElementById('textarea-collar');
      
      if (collarEnable) collarEnable.checked = session.collarSettings.enabled;
      if (collarText) collarText.value = session.collarSettings.text || '';
      
      // Show message
      const collarMsg = document.querySelector('.collar-messages');
      if (collarMsg) {
        collarMsg.innerHTML = '<div class="success">Collar settings loaded from session</div>';
        setTimeout(() => collarMsg.innerHTML = '', 3000);
      }
    }
    
    // Load spiral settings if available
    if (session.spiralSettings) {
      loadSpiralSettings(session.spiralSettings);
    }
    
    // Activate triggers
    if (session.activeTriggers && Array.isArray(session.activeTriggers)) {
      activateTriggers(session.activeTriggers);
    }
  }
  
  function loadSpiralSettings(settings) {
    if (!settings) return;
    
    const spiralsEnable = document.getElementById('spirals-enable');
    const spiral1Width = document.getElementById('spiral1-width');
    const spiral2Width = document.getElementById('spiral2-width');
    const spiral1Speed = document.getElementById('spiral1-speed');
    const spiral2Speed = document.getElementById('spiral2-speed');
    
    // Set values from saved settings
    if (spiralsEnable && 'enabled' in settings) {
      spiralsEnable.checked = settings.enabled;
      spiralsEnable.dispatchEvent(new Event('change'));
    }
    
    if (spiral1Width && settings.spiral1Width) {
      spiral1Width.value = settings.spiral1Width;
      document.getElementById('spiral1-width-value').textContent = settings.spiral1Width;
    }
    
    if (spiral2Width && settings.spiral2Width) {
      spiral2Width.value = settings.spiral2Width;
      document.getElementById('spiral2-width-value').textContent = settings.spiral2Width;
    }
    
    if (spiral1Speed && settings.spiral1Speed) {
      spiral1Speed.value = settings.spiral1Speed;
      document.getElementById('spiral1-speed-value').textContent = settings.spiral1Speed;
    }
    
    if (spiral2Speed && settings.spiral2Speed) {
      spiral2Speed.value = settings.spiral2Speed;
      document.getElementById('spiral2-speed-value').textContent = settings.spiral2Speed;
    }
  }
  
  function activateTriggers(triggers) {
    // Get all trigger toggles
    const allToggles = document.querySelectorAll('.trigger-toggle-item input[type="checkbox"]');
    
    // Reset all triggers first
    allToggles.forEach(toggle => toggle.checked = false);
    
    // Activate the ones from the session
    triggers.forEach(triggerName => {
      // Find toggle by looking at data-trigger attribute
      const toggle = Array.from(allToggles).find(t => 
        t.getAttribute('data-trigger') === triggerName || 
        t.getAttribute('data-trigger-name') === triggerName);
      
      if (toggle) toggle.checked = true;
    });
    
    // Navigate to triggers panel to show changes
    const triggersBtn = document.getElementById('triggers-btn');
    if (triggersBtn) triggersBtn.click();
    
    // Save the trigger state
    if (window.bambiTriggers && typeof window.bambiTriggers.saveTriggerState === 'function') {
      window.bambiTriggers.saveTriggerState();
    }
  }
  
  function replayRandom() {
    if (sessionData.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * sessionData.length);
    const select = document.getElementById('session-select');
    select.value = sessionData[randomIndex]._id;
    loadSession();
  }
  
  // Function to collect current settings for saving
  function collectSessionSettings() {
    // Get active triggers from all trigger toggles
    const activeTriggers = [];
    const triggerToggles = document.querySelectorAll('.trigger-toggle-item input[type="checkbox"]:checked');
    
    triggerToggles.forEach(toggle => {
      // Try to get trigger name from data attributes
      const triggerName = toggle.getAttribute('data-trigger') || toggle.getAttribute('data-trigger-name');
      if (triggerName) {
        activeTriggers.push(triggerName);
      }
    });
    
    // Get collar settings
    const collarEnabled = document.getElementById('collar-enable');
    const collarText = document.getElementById('textarea-collar');
    const collarSettings = {
      enabled: collarEnabled ? collarEnabled.checked : false,
      text: collarText ? collarText.value : ''
    };
    
    // Get spiral settings
    const spiralSettings = window.bambiSpirals && typeof window.bambiSpirals.getCurrentSettings === 'function' ?
      window.bambiSpirals.getCurrentSettings() : 
      { enabled: false };
    
    return {
      activeTriggers,
      collarSettings,
      spiralSettings
    };
  }
  
  return {
    init,
    collectSessionSettings
  };
})();