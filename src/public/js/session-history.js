// Session history module - handles loading and replaying chat history

(function() {
  // Init when page loads
  document.addEventListener('DOMContentLoaded', init);
  
  function init() {
    createUI();
    setupListeners();
  }
  
  // Create UI if not already present
  function createUI() {
    const panel = document.getElementById('session-history-panel');
    if (!panel || panel.querySelector('h3')) return;
    
    panel.innerHTML = `
      <h3>Session History</h3>
      
      <div id="session-history-status" class="session-history-status">
        No sessions loaded yet
      </div>
      
      <div class="session-select-container" style="display: none">
        <select id="session-select">
          <option value="">Select a session...</option>
        </select>
      </div>
      
      <div class="session-stats-container" style="display: none">
        <div class="session-stat">
          <div class="stat-value" id="session-count">0</div>
          <div class="stat-label">Sessions</div>
        </div>
        <div class="session-stat">
          <div class="stat-value" id="message-count">0</div>
          <div class="stat-label">Messages</div>
        </div>
        <div class="session-stat">
          <div class="stat-value" id="word-count">0</div>
          <div class="stat-label">Words</div>
        </div>
      </div>
      
      <div class="session-history-actions">
        <button id="load-history-btn" class="control-btn">Load History</button>
        <button id="replay-history-btn" class="control-btn" disabled>Replay Random</button>
      </div>
    `;
  }
  
  // Set up event listeners
  function setupListeners() {
    const loadBtn = document.getElementById('load-history-btn');
    const replayBtn = document.getElementById('replay-history-btn');
    const sessionSelect = document.getElementById('session-select');
    
    if (loadBtn) loadBtn.addEventListener('click', loadSessions);
    if (replayBtn) replayBtn.addEventListener('click', replayRandom);
    if (sessionSelect) sessionSelect.addEventListener('change', loadSession);
  }
  
  // Load all sessions - game save functionality
  function loadSessions() {
    const username = document.body.getAttribute('data-username') || window.username;
    if (!username) {
      showStatus('No username found', true);
      return;
    }
    
    showStatus('Loading save data...', false);
    hideElements();
    
    fetch(`/api/sessions/${username}`)
      .then(response => response.ok ? response.json() : Promise.reject('Failed to load'))
      .then(data => {
        if (!data.sessions || !data.sessions.length) {
          showStatus('No saved sessions found', true);
          return;
        }
        
        // Store sessions globally for other modules to access
        window.sessionHistory = data.sessions;
        
        // Fill session dropdown - like save slots
        fillSessionDropdown(data.sessions);
        
        // Count stats
        const stats = countStats(data.sessions);
        showStats(stats.sessions, stats.messages, stats.words);
        enableReplay();
        
        // Restore triggers from last session if exists
        restoreTriggersFromLastSession(data.sessions);
        
        showStatus(`Loaded ${stats.sessions} save files`, false);
        awardXp(5, 'history_loaded');
      })
      .catch(err => showStatus(err, true));
  }
  
  // Restore trigger states from most recent session
  function restoreTriggersFromLastSession(sessions) {
    if (!sessions || !sessions.length) return;
    
    // Sort by date to get the most recent session
    const sortedSessions = [...sessions].sort((a, b) => 
      new Date(b.metadata.lastActivity) - new Date(a.metadata.lastActivity));
    
    const lastSession = sortedSessions[0];
    
    // Check if the session has trigger data
    if (lastSession.metadata && lastSession.metadata.triggers && lastSession.metadata.triggers.length) {
      // Apply these triggers to the UI
      applyTriggerState(lastSession.metadata.triggers);
    }
  }
  
  // Apply trigger state to checkboxes
  function applyTriggerState(triggers) {
    if (!triggers || !triggers.length) return;
    
    const toggles = document.querySelectorAll('.toggle-input[data-trigger]');
    toggles.forEach(toggle => {
      const triggerName = toggle.getAttribute('data-trigger');
      toggle.checked = triggers.includes(triggerName);
    });
    
    // Save the restored state
    if (window.bambiTriggers && typeof window.bambiTriggers.saveTriggerState === 'function') {
      window.bambiTriggers.saveTriggerState();
    }
    
    showStatus('Restored triggers from last session', false);
  }
  
  // Fill the session dropdown like save slots
  function fillSessionDropdown(sessions) {
    const select = document.getElementById('session-select');
    const container = document.querySelector('.session-select-container');
    if (!select || !container) return;
    
    // Clear old options
    while (select.options.length > 1) select.remove(1);
    
    // Add new options
    sessions.forEach(session => {
      const date = new Date(session.metadata.createdAt).toLocaleDateString();
      const time = new Date(session.metadata.createdAt).toLocaleTimeString();
      const option = document.createElement('option');
      option.value = session._id;
      option.textContent = `${session.title || 'Untitled Save'} (${date} ${time})`;
      select.appendChild(option);
    });
    
    container.style.display = 'block';
  }
  
  // Count messages and words in all sessions
  function countStats(sessions) {
    let messages = 0, words = 0;
    
    sessions.forEach(session => {
      if (session.messages) {
        messages += session.messages.length;
        session.messages.forEach(msg => {
          if (msg.content) words += msg.content.split(/\s+/).length;
        });
      }
    });
    
    return { sessions: sessions.length, messages, words };
  }
  
  // Load a specific session save
  function loadSession(e) {
    const id = e.target.value;
    if (!id || !window.sessionHistory) return;
    
    const session = window.sessionHistory.find(s => s._id === id);
    if (!session) return;
    
    // Count stats for just this session
    let messages = 0, words = 0;
    if (session.messages) {
      messages = session.messages.length;
      session.messages.forEach(msg => {
        if (msg.content) words += msg.content.split(/\s+/).length;
      });
    }
    
    // Update UI
    showStats(1, messages, words);
    showStatus(`Loaded save: ${session.title || 'Untitled Save'}`, false);
    
    // Store for replay
    window.currentSession = session;
    
    // Apply session-specific settings
    applySessionSettings(session);
  }
  
  // Apply settings from saved session
  function applySessionSettings(session) {
    if (!session) return;
    
    // Apply trigger settings if available
    if (session.metadata && session.metadata.triggers) {
      applyTriggerState(session.metadata.triggers);
    }
    
    // Apply collar settings if available
    if (session.metadata && session.metadata.collarActive !== undefined) {
      const collarEnable = document.getElementById('collar-enable');
      if (collarEnable) collarEnable.checked = session.metadata.collarActive;
      
      const textareaCollar = document.getElementById('textarea-collar');
      if (textareaCollar && session.metadata.collarText) {
        textareaCollar.value = session.metadata.collarText;
      }
      
      // Save collar state
      if (window.bambiCollar && typeof window.bambiCollar.saveCollarSettings === 'function') {
        window.bambiCollar.saveCollarSettings();
      }
    }
    
    // Restore chat if available
    if (session.messages && session.messages.length) {
      restoreChatFromSession(session);
    }
  }
  
  // Restore chat from session
  function restoreChatFromSession(session) {
    if (!session.messages || !session.messages.length) return;
    
    // Clear existing chat
    const chatContainer = document.getElementById('response');
    if (chatContainer) chatContainer.innerHTML = '';
    
    // Display last 5 messages (or fewer if not available)
    const messagesToShow = session.messages.slice(-5);
    
    // Show the messages in reverse order (oldest first)
    messagesToShow.forEach(msg => {
      if (msg.role === 'user') {
        const userPrompt = document.getElementById('user-prompt');
        if (userPrompt) userPrompt.textContent = msg.content;
      } else if (msg.role === 'assistant') {
        displayHistoricalMessage(msg.content);
      }
    });
    
    showStatus('Restored chat from save', false);
  }
  
  // Replay a random message from history
  function replayRandom() {
    const session = window.currentSession || getRandomSession();
    if (!session) {
      showStatus('No saves available', true);
      return;
    }
    
    const bambiMsg = getBambiMessage(session);
    if (!bambiMsg) {
      showStatus('No Bambi messages found', true);
      return;
    }
    
    // Display the message in chat
    displayHistoricalMessage(bambiMsg.content);
    showStatus('Playing Bambi response', false);
    
    // Award XP
    awardXp(10, 'history_replayed');
  }
  
  // Get a random session
  function getRandomSession() {
    if (!window.sessionHistory || !window.sessionHistory.length) return null;
    const index = Math.floor(Math.random() * window.sessionHistory.length);
    return window.sessionHistory[index];
  }
  
  // Get a random Bambi message from a session
  function getBambiMessage(session) {
    if (!session.messages) return null;
    
    const bambiMsgs = session.messages.filter(msg => 
      msg.role === 'assistant' || msg.sender === 'assistant');
    
    if (!bambiMsgs.length) return null;
    
    const index = Math.floor(Math.random() * bambiMsgs.length);
    return bambiMsgs[index];
  }
  
  // Display historical message in chat
  function displayHistoricalMessage(content) {
    // If the global function exists, use it
    if (window.displayHistoricalMessage) {
      window.displayHistoricalMessage(content);
      return;
    }
    
    // Otherwise use our own implementation
    const response = document.getElementById('response');
    if (!response) return;
    
    const messageElement = document.createElement('p');
    messageElement.textContent = content;
    messageElement.className = 'historical-message';
    
    if (response.firstChild) {
      response.insertBefore(messageElement, response.firstChild);
    } else {
      response.appendChild(messageElement);
    }
    
    // Process triggers in the message
    processTriggers(content);
  }
  
  // Process triggers in message content
  function processTriggers(content) {
    if (!content) return;
    
    // Look for capitalized words that might be triggers
    const matches = content.match(/\b[A-Z]{2,}(?:\s+[A-Z]+)*\b/g);
    if (!matches) return;
    
    // Check if any matches are valid triggers
    matches.forEach(match => {
      if (window.bambiAudio && typeof window.bambiAudio.playTrigger === 'function') {
        window.bambiAudio.playTrigger(match);
      }
    });
  }
  
  // Show stats in the UI
  function showStats(sessions, messages, words) {
    const sessCount = document.getElementById('session-count');
    const msgCount = document.getElementById('message-count');
    const wordCount = document.getElementById('word-count');
    const container = document.querySelector('.session-stats-container');
    
    if (sessCount) sessCount.textContent = sessions;
    if (msgCount) msgCount.textContent = messages;
    if (wordCount) wordCount.textContent = words;
    if (container) container.style.display = 'flex';
  }
  
  // Hide container elements
  function hideElements() {
    const statsContainer = document.querySelector('.session-stats-container');
    const selectContainer = document.querySelector('.session-select-container');
    
    if (statsContainer) statsContainer.style.display = 'none';
    if (selectContainer) selectContainer.style.display = 'none';
  }
  
  // Update status message
  function showStatus(message, isError) {
    const status = document.getElementById('session-history-status');
    if (!status) return;
    
    status.textContent = message;
    status.className = 'session-history-status' + (isError ? ' error' : ' success');
    
    if (!isError) {
      setTimeout(() => {
        if (status.textContent === message) {
          status.textContent = 'Click "Load History" to view your saves';
          status.className = 'session-history-status';
        }
      }, 5000);
    }
  }
  
  // Enable the replay button
  function enableReplay() {
    const btn = document.getElementById('replay-history-btn');
    if (btn) btn.disabled = false;
  }
  
  // Award XP points
  function awardXp(amount, action) {
    const username = document.body.getAttribute('data-username') || window.username;
    if (username && window.socket && socket.connected) {
      socket.emit('award-xp', { username, amount, action });
    }
  }
  
  // Extend AIGF core with our historical message display
  window.displayHistoricalMessage = function(content) {
    const response = document.getElementById('response');
    if (!response) return;
    
    const messageElement = document.createElement('p');
    messageElement.textContent = content;
    messageElement.className = 'bambi-response historical';
    
    if (response.firstChild) {
      response.insertBefore(messageElement, response.firstChild);
    } else {
      response.appendChild(messageElement);
    }
    
    // Process triggers in the message
    processTriggers(content);
  };
  
  // Public API
  window.bambiHistory = { 
    load: loadSessions, 
    replay: replayRandom,
    loadSession
  };
})();