// Session history module
window.bambiHistory = (function() {
  let sessionData = [];
  
  function init() {
    const loadBtn = document.getElementById('load-history-btn');
    const replayBtn = document.getElementById('replay-history-btn');
    const sessionSelect = document.getElementById('session-select');
    
    if (loadBtn) loadBtn.addEventListener('click', loadHistory);
    if (replayBtn) replayBtn.addEventListener('click', replayRandom);
    
    // Create a refresh button for loading history list
    const container = document.querySelector('.session-select-container');
    if (container) {
      const refreshBtn = document.createElement('button');
      refreshBtn.textContent = 'Refresh List';
      refreshBtn.className = 'refresh-history-btn';
      refreshBtn.addEventListener('click', refreshHistory);
      container.appendChild(refreshBtn);
    }
  }
  
  function loadHistory() {
    const status = document.getElementById('session-history-status');
    status.textContent = 'Loading sessions...';
    status.className = 'session-history-status';
    
    // Get current username
    const currentUsername = 
      (document.cookie.split('; ').find(row => row.startsWith('bambiname=')) || '').split('=')[1] || 
      document.querySelector('.user-profile-name')?.textContent || 
      'anonBambi';
    
    fetch(`/api/sessions/${currentUsername}`)
      .then(res => res.json())
      .then(data => {
        sessionData = data.sessions || [];
        updateStats(data);
        populateDropdown(sessionData);
        
        // Always show the dropdown
        document.querySelector('.session-select-container').style.display = 'block';
        document.querySelector('.session-stats-container').style.display = 'flex';
        
        if (sessionData.length > 0) {
          status.textContent = `${sessionData.length} sessions available`;
          status.className = 'session-history-status success';
          document.getElementById('replay-history-btn').disabled = false;
        } else {
          status.textContent = 'No sessions found';
        }
        
        // Change load button functionality
        const loadBtn = document.getElementById('load-history-btn');
        if (loadBtn) {
          loadBtn.removeEventListener('click', loadHistory);
          loadBtn.addEventListener('click', loadSession);
          loadBtn.textContent = 'Load Selected';
        }
      })
      .catch(err => {
        console.error(err);
        status.textContent = 'Error loading sessions';
        status.className = 'session-history-status error';
        
        sessionData = [];
        updateStats({totalSessions: 0, totalMessages: 0, totalWords: 0});
        populateDropdown([]);
      });
  }
  
  function refreshHistory() {
    // Reset the load button
    const loadBtn = document.getElementById('load-history-btn');
    if (loadBtn) {
      loadBtn.removeEventListener('click', loadSession);
      loadBtn.addEventListener('click', loadHistory);
      loadBtn.textContent = 'Load History';
    }
    
    // Load sessions list
    loadHistory();
  }
  
  function saveSession(sessionData) {
    const username = 
      (document.cookie.split('; ').find(row => row.startsWith('bambiname=')) || '').split('=')[1] || 
      document.querySelector('.user-profile-name')?.textContent || 
      'anonBambi';
      
    fetch(`/api/sessions/${username}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionData)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        console.log('Session saved successfully');
        // Reload history to show the new session
        loadHistory();
      } else {
        console.error('Failed to save session:', data.message);
      }
    })
    .catch(err => {
      console.error('Error saving session:', err);
    });
  }
  
  function deleteSession(sessionId) {
    if (!sessionId || !confirm('Are you sure you want to delete this session?')) return;
    
    const username = 
      (document.cookie.split('; ').find(row => row.startsWith('bambiname=')) || '').split('=')[1] || 
      document.querySelector('.user-profile-name')?.textContent || 
      'anonBambi';
      
    fetch(`/api/sessions/${username}/${sessionId}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        console.log('Session deleted successfully');
        // Reload history to update the list
        loadHistory();
      } else {
        console.error('Failed to delete session:', data.message);
      }
    })
    .catch(err => {
      console.error('Error deleting session:', err);
    });
  }
  
  function shareSession(sessionId) {
    if (!sessionId) return;
    
    const username = 
      (document.cookie.split('; ').find(row => row.startsWith('bambiname=')) || '').split('=')[1] || 
      document.querySelector('.user-profile-name')?.textContent || 
      'anonBambi';
      
    fetch(`/api/sessions/${username}/${sessionId}/share`, {
      method: 'POST'
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.token) {
        const shareUrl = `${window.location.origin}/shared-session/${data.token}`;
        // Show share dialog with the URL
        alert(`Share this link: ${shareUrl}`);
        
        // Copy to clipboard
        navigator.clipboard.writeText(shareUrl)
          .then(() => console.log('URL copied to clipboard'))
          .catch(err => console.error('Could not copy URL:', err));
      } else {
        console.error('Failed to generate share token:', data.message);
      }
    })
    .catch(err => {
      console.error('Error sharing session:', err);
    });
  }
  
  function loadSharedSession(token) {
    if (!token) return;
    
    fetch(`/api/shared-sessions/${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.session) {
          // Apply the shared session
          applySession(data.session);
        } else {
          console.error('Failed to load shared session:', data.message);
        }
      })
      .catch(err => {
        console.error('Error loading shared session:', err);
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
    if (!sessionId || sessionId === "default") {
      const status = document.getElementById('session-history-status');
      status.textContent = 'Please select a session';
      status.className = 'session-history-status';
      return;
    }
    
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
    collectSessionSettings,
    saveSession,
    deleteSession,
    shareSession,
    loadSharedSession
  };
})();

// Connect session history panel UI to backend functionality
document.addEventListener('DOMContentLoaded', function() {
  // Initialize session history module if available
  if (window.bambiHistory && typeof window.bambiHistory.init === 'function') {
    window.bambiHistory.init();
  } else {
    console.warn('BambiHistory module not available');
  }
  
  // Connect UI elements to functions
  const loadHistoryBtn = document.getElementById('load-history-btn');
  const replayHistoryBtn = document.getElementById('replay-history-btn');
  const sessionSelect = document.getElementById('session-select');
  const sessionHistoryStatus = document.getElementById('session-history-status');
  const sessionStatsContainer = document.querySelector('.session-stats-container');
  
  // Setup load history button
  if (loadHistoryBtn) {
    loadHistoryBtn.addEventListener('click', function() {
      // Show status
      if (sessionHistoryStatus) {
        sessionHistoryStatus.textContent = 'Loading sessions...';
        sessionHistoryStatus.className = 'session-history-status';
      }
      
      // Use existing bambiHistory.loadHistory function
      if (window.bambiHistory && typeof window.bambiHistory.loadHistory === 'function') {
        window.bambiHistory.loadHistory();
      } else {
        // Fallback to basic implementation
        loadSessions();
      }
    });
  }
  
  // Setup replay button
  if (replayHistoryBtn) {
    replayHistoryBtn.disabled = true; // Disabled by default until sessions loaded
    replayHistoryBtn.addEventListener('click', function() {
      if (window.bambiHistory && typeof window.bambiHistory.replayRandom === 'function') {
        window.bambiHistory.replayRandom();
      } else {
        // Fallback implementation
        replayRandomSession();
      }
    });
  }
  
  // Setup session select change handler
  if (sessionSelect) {
    sessionSelect.addEventListener('change', function() {
      const sessionId = this.value;
      if (!sessionId || sessionId === '') return;
      
      // Load the selected session
      loadSelectedSession(sessionId);
    });
  }
  
  // Fallback implementation if bambiHistory module isn't working
  function loadSessions() {
    const username = document.body.getAttribute('data-username');
    if (!username) {
      updateStatus('Please log in to view sessions', true);
      return;
    }
    
    fetch(`/api/sessions/${username}`)
      .then(res => res.json())
      .then(data => {
        if (!data.sessions || data.sessions.length === 0) {
          updateStatus('No sessions found', true);
          return;
        }
        
        // Populate select dropdown
        populateSessionSelect(data.sessions);
        
        // Show stats
        updateStats({
          totalSessions: data.sessions.length,
          totalMessages: data.sessions.reduce((sum, s) => sum + (s.messages?.length || 0), 0),
          totalWords: data.sessions.reduce((sum, s) => {
            if (!s.messages) return sum;
            return sum + s.messages.reduce((wSum, m) => wSum + (m.content?.split(/\s+/).length || 0), 0);
          }, 0)
        });
        
        // Show stats container
        if (sessionStatsContainer) {
          sessionStatsContainer.style.display = 'flex';
        }
        
        // Enable replay button
        if (replayHistoryBtn) {
          replayHistoryBtn.disabled = false;
        }
        
        updateStatus(`${data.sessions.length} sessions available`);
      })
      .catch(err => {
        console.error('Error loading sessions:', err);
        updateStatus('Error loading sessions', true);
      });
  }
  
  function populateSessionSelect(sessions) {
    if (!sessionSelect) return;
    
    // Clear existing options except first placeholder
    while (sessionSelect.options.length > 1) {
      sessionSelect.remove(1);
    }
    
    // Add session options
    sessions.forEach(session => {
      const date = new Date(session.createdAt || session.metadata?.lastActivity);
      const option = document.createElement('option');
      option.value = session._id;
      option.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()} (${session.messages?.length || 0} msgs)`;
      sessionSelect.appendChild(option);
    });
  }
  
  function updateStatus(message, isError = false) {
    if (!sessionHistoryStatus) return;
    
    sessionHistoryStatus.textContent = message;
    sessionHistoryStatus.className = 'session-history-status' + (isError ? ' error' : ' success');
  }
  
  function updateStats(data) {
    if (document.getElementById('session-count')) {
      document.getElementById('session-count').textContent = data.totalSessions || 0;
    }
    if (document.getElementById('message-count')) {
      document.getElementById('message-count').textContent = data.totalMessages || 0;
    }
    if (document.getElementById('word-count')) {
      document.getElementById('word-count').textContent = data.totalWords || 0;
    }
  }
  
  function loadSelectedSession(sessionId) {
    if (!sessionId) return;
    
    // Use socket if available for more efficient loading
    if (window.socket && window.socket.connected) {
      window.socket.emit('load-session', sessionId);
      updateStatus('Loading session...');
      return;
    }
    
    // Fallback to fetch
    fetch(`/sessions/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.session) {
          updateStatus('Failed to load session', true);
          return;
        }
        
        const session = data.session;
        
        // Notify other components
        document.dispatchEvent(new CustomEvent('session-loaded', {
          detail: { session, sessionId }
        }));
        
        updateStatus('Session loaded');
      })
      .catch(err => {
        console.error('Error loading session:', err);
        updateStatus('Error loading session', true);
      });
  }
  
  function replayRandomSession() {
    // Get all option values except the first placeholder
    const options = Array.from(sessionSelect.options).slice(1);
    if (!options.length) {
      updateStatus('No sessions available to replay', true);
      return;
    }
    
    // Pick a random option
    const randomIndex = Math.floor(Math.random() * options.length);
    const sessionId = options[randomIndex].value;
    
    // Select in dropdown to show what's playing
    sessionSelect.value = sessionId;
    
    // Load this session
    loadSelectedSession(sessionId);
  }
  
  // Auto-load history if panel is active
  const panel = document.getElementById('session-history-panel');
  if (panel && panel.classList.contains('active')) {
    setTimeout(() => {
      if (loadHistoryBtn) loadHistoryBtn.click();
    }, 500);
  }
});