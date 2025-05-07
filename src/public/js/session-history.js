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
    
    // Add view toggle listeners if on dashboard/list pages
    setupViewToggle();
  }
  
  // Setup view toggle between grid and list
  function setupViewToggle() {
    const gridBtn = document.getElementById('grid-view-btn');
    const listBtn = document.getElementById('list-view-btn');
    
    if (gridBtn && listBtn) {
      gridBtn.addEventListener('click', () => {
        document.getElementById('grid-view')?.classList.remove('d-none');
        document.getElementById('list-view')?.classList.add('d-none');
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
        localStorage.setItem('session-view', 'grid');
      });
      
      listBtn.addEventListener('click', () => {
        document.getElementById('grid-view')?.classList.add('d-none');
        document.getElementById('list-view')?.classList.remove('d-none');
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
        localStorage.setItem('session-view', 'list');
      });
      
      // Load previous preference
      const savedView = localStorage.getItem('session-view');
      if (savedView === 'list') listBtn.click();
    }
  }
  
  // Load all sessions
  function loadSessions() {
    const username = document.body.getAttribute('data-username') || window.username;
    if (!username) {
      showStatus('No username found', true);
      return;
    }
    
    showStatus('Loading sessions...', false);
    hideElements();
    
    fetch(`/api/sessions/${username}`)
      .then(response => response.ok ? response.json() : Promise.reject('Failed to load'))
      .then(data => {
        if (!data.sessions || !data.sessions.length) {
          showStatus('No saved sessions found', true);
          return;
        }
        
        // Store sessions globally
        window.sessionHistory = data.sessions;
        
        // Fill session dropdown
        fillSessionDropdown(data.sessions);
        
        // Count stats
        const stats = countStats(data.sessions);
        showStats(stats.sessions, stats.messages, stats.words);
        enableReplay();
        
        showStatus(`Loaded ${stats.sessions} sessions`, false);
        awardXp(5, 'history_loaded');
      })
      .catch(err => showStatus(err, true));
  }
  
  // Fill the session dropdown
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
      
      const triggerCount = session.metadata?.triggers?.length || 0;
      option.textContent = `${session.title || 'Untitled'} (${triggerCount} triggers) - ${date}`;
      
      select.appendChild(option);
    });
    
    container.style.display = 'block';
  }
  
  // Count messages and words in sessions
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
  
  // Load a specific session
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
    showStatus(`Loaded: ${session.title || 'Untitled'}`, false);
    
    // Store for replay
    window.currentSession = session;
    
    // Apply session settings
    applySessionSettings(session);
    
    // Send to LMStudio if available
    sendSessionToLMStudio(session);
  }
  
  // Send session data to LMStudio workers
  function sendSessionToLMStudio(session) {
    if (!session || !window.socket) return;
    
    // Send collar settings
    if (session.metadata?.collarActive && session.metadata?.collarText) {
      socket.emit('collar', {
        enabled: session.metadata.collarActive,
        data: session.metadata.collarText
      });
    }
    
    // Send trigger settings
    if (session.metadata?.triggers && session.metadata.triggers.length) {
      socket.emit('triggers', {
        triggerNames: session.metadata.triggers.join(','),
        triggerDetails: session.metadata.triggers.map(t => ({ name: t }))
      });
    }
    
    // Send message history for context
    if (session.messages && session.messages.length) {
      // Only send up to last 5 messages for context
      const contextMessages = session.messages.slice(-5);
      socket.emit('load-history', {
        messages: contextMessages
      });
    }
    
    showStatus('Session loaded into active chat', false);
  }
  
  // Apply session settings to UI
  function applySessionSettings(session) {
    if (!session) return;
    
    // Apply trigger settings if available
    if (session.metadata?.triggers) {
      applyTriggerState(session.metadata.triggers);
    }
    
    // Apply collar settings if available
    if (session.metadata?.collarActive !== undefined) {
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
  }
  
  // Restore chat from session
  function restoreChatFromSession(session) {
    if (!session.messages || !session.messages.length) return;
    
    // Clear existing chat
    const chatContainer = document.getElementById('response');
    if (chatContainer) chatContainer.innerHTML = '';
    
    // Display last 5 messages (or fewer if not available)
    const messagesToShow = session.messages.slice(-5);
    
    // Show the messages in order
    messagesToShow.forEach(msg => {
      if (msg.role === 'user' || msg.role === 'system') {
        const userPrompt = document.getElementById('user-prompt');
        if (userPrompt) userPrompt.textContent = msg.content;
      } else if (msg.role === 'assistant') {
        displayHistoricalMessage(msg.content);
      }
    });
  }
  
  // Replay a random message
  function replayRandom() {
    const session = window.currentSession || getRandomSession();
    if (!session) {
      showStatus('No sessions available', true);
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
          status.textContent = 'Click "Load History" to view your sessions';
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
  
  // Replace like buttons with thumbs up/down icons
  function setupThumbsForSessions() {
    document.querySelectorAll('.session-card, .session-list-item').forEach(item => {
      const likeBtn = item.querySelector('.btn-like');
      const dislikeBtn = item.querySelector('.btn-dislike');
      
      if (likeBtn) {
        const sessionId = likeBtn.getAttribute('data-id');
        const thumbUp = document.createElement('i');
        thumbUp.className = 'fas fa-thumbs-up';
        thumbUp.onclick = () => reactToSession(sessionId, 'like');
        likeBtn.parentNode.replaceChild(thumbUp, likeBtn);
      }
      
      if (dislikeBtn) {
        const sessionId = dislikeBtn.getAttribute('data-id');
        const thumbDown = document.createElement('i');
        thumbDown.className = 'fas fa-thumbs-down';
        thumbDown.onclick = () => reactToSession(sessionId, 'dislike');
        dislikeBtn.parentNode.replaceChild(thumbDown, dislikeBtn);
      }
    });
  }
  
  // React to a session (like/dislike)
  function reactToSession(sessionId, action) {
    if (!sessionId) return;
    
    fetch(`/sessions/${sessionId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Update the UI
        const likeCount = document.querySelector(`[data-id="${sessionId}"] .like-count`);
        const dislikeCount = document.querySelector(`[data-id="${sessionId}"] .dislike-count`);
        
        if (likeCount) likeCount.textContent = data.likes;
        if (dislikeCount) dislikeCount.textContent = data.dislikes;
        
        // Update active state
        if (data.yourReaction === 'like') {
          document.querySelector(`[data-id="${sessionId}"] .fa-thumbs-up`)?.classList.add('active');
          document.querySelector(`[data-id="${sessionId}"] .fa-thumbs-down`)?.classList.remove('active');
        } else if (data.yourReaction === 'dislike') {
          document.querySelector(`[data-id="${sessionId}"] .fa-thumbs-down`)?.classList.add('active');
          document.querySelector(`[data-id="${sessionId}"] .fa-thumbs-up`)?.classList.remove('active');
        }
      }
    })
    .catch(error => console.error('Error reacting to session:', error));
  }
  
  // Global display function
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
  };
  
  // Public API
  window.bambiHistory = { 
    load: loadSessions, 
    replay: replayRandom,
    loadSession,
    setupThumbsForSessions
  };
})();