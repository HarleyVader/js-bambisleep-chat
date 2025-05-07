// Session history module for handling session history functionality

(function() {
  // Initialize session history controls
  function init() {
    createSessionHistoryUI();
    setupEventListeners();
  }
  
  // Create session history UI if it doesn't exist
  function createSessionHistoryUI() {
    const panel = document.getElementById('session-history-panel');
    if (!panel || panel.querySelector('.session-stats-container')) return;
    
    // Create basic structure
    const content = `
      <h3>Session History</h3>
      
      <div id="session-history-status" class="session-history-status">
        No sessions loaded yet
      </div>
      
      <div class="session-stats-container" style="display: none;">
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
    
    // Replace existing content or append
    if (panel.children.length === 0) {
      panel.innerHTML = content;
    } else if (!panel.querySelector('#session-history-status')) {
      panel.innerHTML += content;
    }
  }
  
  // Set up event listeners for buttons
  function setupEventListeners() {
    const loadHistoryBtn = document.getElementById('load-history-btn');
    const replayHistoryBtn = document.getElementById('replay-history-btn');
    
    if (loadHistoryBtn) {
      loadHistoryBtn.addEventListener('click', loadSessionHistory);
    }
    
    if (replayHistoryBtn) {
      replayHistoryBtn.addEventListener('click', replayRandomResponse);
    }
  }
  
  // Load session history from the server
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
    
    // Fetch session history from API
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
        const replayBtn = document.getElementById('replay-history-btn');
        if (replayBtn) {
          replayBtn.disabled = false;
        }
        
        updateSessionHistoryStatus(`Loaded ${sessionCount} session(s)`, false);
        
        // Award XP for loading session history
        if (typeof socket !== 'undefined' && socket.connected) {
          socket.emit('award-xp', {
            username: username,
            amount: 5,
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
    
    // Award XP for replaying session history
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
    const statusEl = document.getElementById('session-history-status');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = 'session-history-status' + (isError ? ' error' : ' success');
    
    // Clear success message after 5 seconds, but keep errors visible
    if (!isError) {
      setTimeout(() => {
        if (statusEl.textContent === message) {
          statusEl.textContent = 'Click "Load History" to view your session stats';
          statusEl.className = 'session-history-status';
        }
      }, 5000);
    }
  }
  
  // Mock data for testing - remove in production
  function loadMockData() {
    updateSessionStats(69, 8954, 42069);
    document.getElementById('replay-history-btn').disabled = false;
    updateSessionHistoryStatus('Loaded 69 sessions', false);
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