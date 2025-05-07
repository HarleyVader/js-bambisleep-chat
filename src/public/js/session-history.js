// Session history module for managing session history functionality

(function() {
  // Initialize session history controls
  function init() {
    const loadHistoryBtn = document.getElementById('load-history-btn');
    const replayHistoryBtn = document.getElementById('replay-history-btn');
    
    if (loadHistoryBtn) {
      loadHistoryBtn.addEventListener('click', loadSessionHistory);
    }
    
    if (replayHistoryBtn) {
      replayHistoryBtn.addEventListener('click', replayRandomResponse);
    }
  }
  
  // Load session history
  function loadSessionHistory() {
    const username = document.body.getAttribute('data-username') || window.username;
    if (!username) {
      updateSessionHistoryStatus('Error: No username found', true);
      return;
    }
    
    const sessionHistoryStatus = document.getElementById('session-history-status');
    const sessionStatsContainer = document.querySelector('.session-stats-container');
    
    updateSessionHistoryStatus('Loading session history...', false);
    if (sessionStatsContainer) {
      sessionStatsContainer.style.display = 'none';
    }
    
    fetch(`/api/sessions/${username}`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load session history');
        }
        return response.json();
      })
      .then(data => {
        if (!data.sessions || data.sessions.length === 0) {
          updateSessionHistoryStatus('No session history found', true);
          return;
        }
        
        // Store sessions globally
        window.sessionHistories = data.sessions;
        
        // Calculate stats
        const sessionCount = data.sessions.length;
        let messageCount = 0;
        let wordCount = 0;
        
        data.sessions.forEach(session => {
          if (session.messages && Array.isArray(session.messages)) {
            messageCount += session.messages.length;
            
            // Count words in messages
            session.messages.forEach(msg => {
              if (msg.content) {
                wordCount += msg.content.split(/\s+/).length;
              }
            });
          }
        });
        
        // Update stats display
        updateSessionStats(sessionCount, messageCount, wordCount);
        
        // Enable replay button
        const replayHistoryBtn = document.getElementById('replay-history-btn');
        if (replayHistoryBtn) {
          replayHistoryBtn.disabled = false;
        }
        
        updateSessionHistoryStatus(`Loaded ${sessionCount} session(s)`, false);
        
        // Award XP for loading session history (+5 XP)
        if (typeof socket !== 'undefined' && socket.connected) {
          socket.emit('award-xp', {
            action: 'history_loaded'
          });
        }
      })
      .catch(error => {
        updateSessionHistoryStatus(`Error: ${error.message}`, true);
      });
  }
  
  // Update session stats display
  function updateSessionStats(sessionCount, messageCount, wordCount) {
    const sessionCountEl = document.getElementById('session-count');
    const messageCountEl = document.getElementById('message-count');
    const wordCountEl = document.getElementById('word-count');
    const sessionStatsContainer = document.querySelector('.session-stats-container');
    
    if (sessionCountEl) sessionCountEl.textContent = sessionCount;
    if (messageCountEl) messageCountEl.textContent = messageCount;
    if (wordCountEl) wordCountEl.textContent = wordCount;
    
    if (sessionStatsContainer) {
      sessionStatsContainer.style.display = 'flex';
    }
  }
  
  // Replay a random response from session history
  function replayRandomResponse() {
    if (!window.sessionHistories || window.sessionHistories.length === 0) {
      updateSessionHistoryStatus('No sessions to replay', true);
      return;
    }
    
    // Select a random session
    const randomIndex = Math.floor(Math.random() * window.sessionHistories.length);
    const session = window.sessionHistories[randomIndex];
    
    // Filter for only Bambi's responses
    const bambiResponses = session.messages.filter(msg => msg.sender === 'assistant');
    
    if (bambiResponses.length === 0) {
      updateSessionHistoryStatus('No Bambi responses in this session', true);
      return;
    }
    
    // Pick a random Bambi response
    const randomResponse = bambiResponses[Math.floor(Math.random() * bambiResponses.length)];
    
    // Display the response in the chat
    if (window.displayHistoricalMessage && typeof window.displayHistoricalMessage === 'function') {
      window.displayHistoricalMessage(randomResponse.content);
      updateSessionHistoryStatus('Playing a historical response from Bambi', false);
    } else {
      // Fallback if the display function isn't available
      updateSessionHistoryStatus('Bambi says: ' + randomResponse.content.substring(0, 50) + '...', false);
    }
    
    // Award XP for replaying session history (+10 XP)
    const username = document.body.getAttribute('data-username') || window.username;
    if (username && typeof socket !== 'undefined' && socket.connected) {
      socket.emit('award-xp', {
        username: username,
        amount: 10,
        action: 'history_replayed'
      });
    }
  }
  
  // Update session history status message
  function updateSessionHistoryStatus(message, isError = false) {
    const sessionHistoryStatus = document.getElementById('session-history-status');
    if (!sessionHistoryStatus) return;
    
    sessionHistoryStatus.textContent = message;
    sessionHistoryStatus.className = 'session-history-status' + (isError ? ' error' : ' success');
    
    // Clear success message after 5 seconds, but keep errors visible
    if (!isError) {
      setTimeout(() => {
        if (sessionHistoryStatus.textContent === message) {
          sessionHistoryStatus.textContent = 'Click "Load History" to view your session stats';
          sessionHistoryStatus.className = 'session-history-status';
        }
      }, 5000);
    }
  }
  
  // Export functions
  window.bambiHistory = {
    init,
    loadSessionHistory,
    replayRandomResponse,
    updateSessionHistoryStatus
  };
  
  // Auto-initialize on load
  document.addEventListener('DOMContentLoaded', init);
})();