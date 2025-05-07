// Session history module - handles loading and replaying chat history

(function() {
  // Initialize on page load
  document.addEventListener('DOMContentLoaded', init);
  
  function init() {
    // Set up event listeners
    const loadBtn = document.getElementById('load-history-btn');
    const replayBtn = document.getElementById('replay-history-btn');
    
    if (loadBtn) loadBtn.addEventListener('click', loadHistory);
    if (replayBtn) replayBtn.addEventListener('click', replayRandom);
  }
  
  function loadHistory() {
    const username = document.body.getAttribute('data-username') || window.username;
    if (!username) {
      showStatus('Error: No username found', true);
      return;
    }
    
    showStatus('Loading session history...', false);
    hideStats();
    
    // Fetch user's session history
    fetch(`/api/sessions/${username}`)
      .then(response => response.ok ? response.json() : Promise.reject('Failed to load sessions'))
      .then(data => {
        if (!data.sessions || data.sessions.length === 0) {
          showStatus('No session history found', true);
          return;
        }
        
        // Store sessions for replay feature
        window.sessionHistories = data.sessions;
        
        // Count messages and words
        let messages = 0, words = 0;
        data.sessions.forEach(session => {
          if (session.messages) {
            messages += session.messages.length;
            session.messages.forEach(msg => {
              if (msg.content) words += msg.content.split(/\s+/).length;
            });
          }
        });
        
        // Update stats display
        updateStats(data.sessions.length, messages, words);
        enableReplayButton();
        showStatus(`Loaded ${data.sessions.length} session(s)`, false);
        
        // Award XP
        awardXp(5, 'history_loaded');
      })
      .catch(error => showStatus(`Error: ${error}`, true));
  }
  
  function replayRandom() {
    if (!window.sessionHistories || !window.sessionHistories.length) {
      showStatus('No sessions to replay', true);
      return;
    }
    
    // Pick a random session
    const session = window.sessionHistories[Math.floor(Math.random() * window.sessionHistories.length)];
    
    // Find Bambi's responses
    const bambiResponses = session.messages.filter(msg => msg.sender === 'assistant');
    if (!bambiResponses.length) {
      showStatus('No Bambi responses in this session', true);
      return;
    }
    
    // Get a random response
    const response = bambiResponses[Math.floor(Math.random() * bambiResponses.length)];
    
    // Display in chat if possible
    if (window.displayHistoricalMessage) {
      window.displayHistoricalMessage(response.content);
      showStatus('Playing a historical response from Bambi', false);
    } else {
      // Fallback
      showStatus(`Bambi says: ${response.content.substring(0, 50)}...`, false);
    }
    
    // Award XP
    awardXp(10, 'history_replayed');
  }
  
  // Helper functions
  function showStatus(message, isError) {
    const status = document.getElementById('session-history-status');
    if (!status) return;
    
    status.textContent = message;
    status.className = 'session-history-status' + (isError ? ' error' : ' success');
    
    // Auto-clear success messages
    if (!isError) {
      setTimeout(() => {
        if (status.textContent === message) {
          status.textContent = 'Click "Load History" to view your session stats';
          status.className = 'session-history-status';
        }
      }, 5000);
    }
  }
  
  function updateStats(sessions, messages, words) {
    const sessionCount = document.getElementById('session-count');
    const messageCount = document.getElementById('message-count');
    const wordCount = document.getElementById('word-count');
    const container = document.querySelector('.session-stats-container');
    
    if (sessionCount) sessionCount.textContent = sessions;
    if (messageCount) messageCount.textContent = messages;
    if (wordCount) wordCount.textContent = words;
    if (container) container.style.display = 'flex';
  }
  
  function hideStats() {
    const container = document.querySelector('.session-stats-container');
    if (container) container.style.display = 'none';
  }
  
  function enableReplayButton() {
    const btn = document.getElementById('replay-history-btn');
    if (btn) btn.disabled = false;
  }
  
  function awardXp(amount, action) {
    const username = document.body.getAttribute('data-username') || window.username;
    if (username && window.socket && socket.connected) {
      socket.emit('award-xp', { username, amount, action });
    }
  }
  
  // Expose public API
  window.bambiHistory = { loadHistory, replayRandom, showStatus };
})();