// Session history module for handling chat history
(function() {
  // Initialize module
  function init() {
    setupListeners();
    console.log("Session history module initialized");
  }
  
  // Set up event listeners
  function setupListeners() {
    const loadBtn = document.getElementById('load-history-btn');
    const replayBtn = document.getElementById('replay-history-btn');
    
    if (loadBtn) {
      loadBtn.addEventListener('click', loadHistory);
    }
    
    if (replayBtn) {
      replayBtn.addEventListener('click', replayRandom);
    }
  }
  
  // Load session history
  function loadHistory() {
    const status = document.getElementById('session-history-status');
    if (status) status.textContent = "Loading history...";
    
    const username = document.body.getAttribute('data-username');
    
    // Fetch user's session history
    fetch(`/api/sessions/${username}`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.sessions && data.sessions.length > 0) {
          // Save sessions globally
          window.sessionHistory = data.sessions;
          
          // Update status
          if (status) status.textContent = `Loaded ${data.sessions.length} sessions!`;
          
          // Show stats
          showStats(data.sessions);
          
          // Enable replay button
          document.getElementById('replay-history-btn').disabled = false;
        } else {
          if (status) status.textContent = "No sessions found";
        }
      })
      .catch(err => {
        console.error("Error loading history:", err);
        if (status) status.textContent = "Error loading history";
      });
  }
  
  // Show stats in UI
  function showStats(sessions) {
    // Count messages and words
    let messageCount = 0;
    let wordCount = 0;
    
    sessions.forEach(session => {
      if (session.messages) {
        messageCount += session.messages.length;
        session.messages.forEach(msg => {
          if (msg.content) {
            wordCount += msg.content.split(/\s+/).length;
          }
        });
      }
    });
    
    // Update stats display
    document.getElementById('session-count').textContent = sessions.length;
    document.getElementById('message-count').textContent = messageCount;
    document.getElementById('word-count').textContent = wordCount;
    
    // Show stats container
    document.querySelector('.session-stats-container').style.display = 'flex';
  }
  
  // Replay a random message
  function replayRandom() {
    if (!window.sessionHistory || window.sessionHistory.length === 0) {
      return;
    }
    
    // Get a random session
    const randomSession = window.sessionHistory[Math.floor(Math.random() * window.sessionHistory.length)];
    
    // Get assistant messages
    const assistantMessages = randomSession.messages.filter(msg => msg.role === 'assistant');
    
    if (assistantMessages.length === 0) return;
    
    // Get a random message
    const randomMessage = assistantMessages[Math.floor(Math.random() * assistantMessages.length)];
    
    // Display in chat area
    const chatArea = document.getElementById('response');
    if (chatArea) {
      const messageEl = document.createElement('div');
      messageEl.className = 'bambi-response historical';
      messageEl.textContent = randomMessage.content;
      chatArea.prepend(messageEl);
    }
  }
  
  // Make public API
  window.bambiHistory = {
    init,
    loadHistory,
    replayRandom
  };
})();