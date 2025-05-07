document.addEventListener('DOMContentLoaded', function() {
  const loadHistoryBtn = document.getElementById('load-history-btn');
  const replayHistoryBtn = document.getElementById('replay-history-btn');
  const sessionSelect = document.getElementById('session-select');
  const sessionHistoryStatus = document.getElementById('session-history-status');
  const sessionSelectContainer = document.querySelector('.session-select-container');
  const sessionStatsContainer = document.querySelector('.session-stats-container');

  let sessionData = [];

  if (loadHistoryBtn) {
    loadHistoryBtn.addEventListener('click', loadSessionHistory);
  }

  if (replayHistoryBtn) {
    replayHistoryBtn.addEventListener('click', replayRandomSession);
  }

  if (sessionSelect) {
    sessionSelect.addEventListener('change', loadSelectedSession);
  }

  function loadSessionHistory() {
    sessionHistoryStatus.textContent = 'Loading sessions...';
    sessionHistoryStatus.className = 'session-history-status';
    
    fetch('/api/sessions')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load sessions');
        }
        return response.json();
      })
      .then(data => {
        sessionData = data.sessions || [];
        updateSessionStats(data);
        populateSessionDropdown(sessionData);
        
        sessionSelectContainer.style.display = 'block';
        sessionStatsContainer.style.display = 'flex';
        
        if (sessionData.length > 0) {
          sessionHistoryStatus.textContent = `${sessionData.length} sessions loaded successfully`;
          sessionHistoryStatus.className = 'session-history-status success';
          replayHistoryBtn.disabled = false;
        } else {
          sessionHistoryStatus.textContent = 'No sessions found';
          sessionHistoryStatus.className = 'session-history-status';
          replayHistoryBtn.disabled = true;
        }
      })
      .catch(error => {
        console.error('Error:', error);
        sessionHistoryStatus.textContent = 'Error loading sessions: ' + error.message;
        sessionHistoryStatus.className = 'session-history-status error';
      });
  }

  function populateSessionDropdown(sessions) {
    // Clear existing options except the first one
    while (sessionSelect.options.length > 1) {
      sessionSelect.remove(1);
    }
    
    // Add options for each session
    sessions.forEach(session => {
      const date = new Date(session.createdAt || session.date);
      const formattedDate = date.toLocaleString();
      const option = document.createElement('option');
      option.value = session._id;
      option.textContent = `${formattedDate} (${session.messages?.length || 0} messages)`;
      sessionSelect.appendChild(option);
    });
  }

  function updateSessionStats(data) {
    const sessionCount = document.getElementById('session-count');
    const messageCount = document.getElementById('message-count');
    const wordCount = document.getElementById('word-count');
    
    if (sessionCount) sessionCount.textContent = data.totalSessions || 0;
    if (messageCount) messageCount.textContent = data.totalMessages || 0;
    if (wordCount) wordCount.textContent = data.totalWords || 0;
  }

  function loadSelectedSession() {
    const sessionId = sessionSelect.value;
    
    if (!sessionId) return;
    
    // Find the selected session
    const selectedSession = sessionData.find(session => session._id === sessionId);
    if (!selectedSession) return;
    
    // Update status
    sessionHistoryStatus.textContent = `Loaded session from ${new Date(selectedSession.createdAt || selectedSession.date).toLocaleString()}`;
    sessionHistoryStatus.className = 'session-history-status success';
    
    // Activate triggers from the session
    if (selectedSession.triggers && Array.isArray(selectedSession.triggers)) {
      activateSessionTriggers(selectedSession.triggers);
    }
    
    // Set collar settings if available
    if (selectedSession.collarSettings) {
      applyCollarSettings(selectedSession.collarSettings);
    }
  }

  function activateSessionTriggers(triggers) {
    // Get all trigger toggles
    const triggerToggles = document.querySelectorAll('.trigger-toggle-item input[type="checkbox"]');
    
    // First, deactivate all triggers
    triggerToggles.forEach(toggle => {
      toggle.checked = false;
    });
    
    // Then activate the ones from the session
    triggerToggles.forEach(toggle => {
      const triggerName = toggle.id.replace('-toggle', '');
      if (triggers.includes(triggerName)) {
        toggle.checked = true;
      }
    });
    
    // Navigate to the triggers panel to show changes
    const triggersBtn = document.getElementById('triggers-btn');
    if (triggersBtn) {
      triggersBtn.click();
    }
  }
  
  function applyCollarSettings(collarSettings) {
    const collarEnable = document.getElementById('collar-enable');
    const collarText = document.getElementById('textarea-collar');
    
    if (collarEnable && collarSettings.hasOwnProperty('enabled')) {
      collarEnable.checked = collarSettings.enabled;
    }
    
    if (collarText && collarSettings.text) {
      collarText.value = collarSettings.text;
    }
    
    // Update collar message display
    const collarMessages = document.querySelector('.collar-messages');
    if (collarMessages) {
      collarMessages.innerHTML = `<div class="collar-message success">Collar settings loaded from session</div>`;
      
      // Clear message after a few seconds
      setTimeout(() => {
        collarMessages.innerHTML = '';
      }, 5000);
    }
  }

  function replayRandomSession() {
    if (sessionData.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * sessionData.length);
    const randomSession = sessionData[randomIndex];
    
    // Set the dropdown to the random session
    sessionSelect.value = randomSession._id;
    
    // Load the selected session
    loadSelectedSession();
  }
});