// Central session management for BambiSleep
window.bambiSessions = (function() {
  // Session data storage
  let sessions = [];
  let activeSessionId = null;

  // Init module
  function init() {
    setupEventListeners();
    checkUrlParams();
  }

  // Set up event listeners
  function setupEventListeners() {
    // Session controls
    const loadBtn = document.getElementById('load-history-btn');
    if (loadBtn) loadBtn.addEventListener('click', loadSessions);
    
    const replayBtn = document.getElementById('replay-history-btn');
    if (replayBtn) replayBtn.addEventListener('click', replayRandom);
    
    const saveBtn = document.getElementById('save-session-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveSession);
    
    const deleteBtn = document.getElementById('delete-session-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', deleteSession);
    
    const shareBtn = document.getElementById('share-session-btn');
    if (shareBtn) shareBtn.addEventListener('click', shareSession);
    
    // Add refresh button to session container
    addRefreshButton();
  }

  // Add refresh button to session container
  function addRefreshButton() {
    const container = document.querySelector('.session-select-container');
    if (!container) return;
    
    if (!container.querySelector('.refresh-btn')) {
      const btn = document.createElement('button');
      btn.textContent = 'Refresh';
      btn.className = 'refresh-btn';
      btn.addEventListener('click', loadSessions);
      container.appendChild(btn);
    }
  }

  // Check URL for shared session
  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const sessionToken = params.get('session');
    
    if (sessionToken) loadSharedSession(sessionToken);
  }

  // Load sessions list
  function loadSessions() {
    const username = document.body.getAttribute('data-username');
    if (!username) {
      showToast('Please log in to view sessions');
      return;
    }
    
    fetch(`/sessions/api/sessions/${username}`)
      .then(res => res.json())
      .then(data => {
        if (!data.success) return;
        
        sessions = data.sessions || [];
        
        // Update session dropdown
        const select = document.getElementById('session-select');
        if (!select) return;
        
        // Clear existing options
        while (select.options.length > 1) select.remove(1);
        
        // Add session options
        sessions.forEach(s => {
          const date = new Date(s.createdAt);
          const option = document.createElement('option');
          option.value = s._id;
          option.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()} (${s.messages?.length || 0} msgs)`;
          select.appendChild(option);
        });
        
        // Show session select container
        const container = document.querySelector('.session-select-container');
        if (container) container.style.display = 'block';
        
        // Enable buttons
        enableButton('load-selected-btn');
        enableButton('replay-history-btn');
        
        showToast(`Loaded ${sessions.length} sessions`);
      })
      .catch(err => {
        console.error('Error loading sessions:', err);
        showToast('Error loading sessions');
      });
  }

  // Load a shared session by token
  function loadSharedSession(token) {
    fetch(`/sessions/shared/${token}`)
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.session) return;
        
        const session = data.session;
        activeSessionId = session._id;
        
        // Apply session settings to UI
        applySessionSettings(session);
        
        // Notify other components
        document.dispatchEvent(new CustomEvent('session-loaded', {
          detail: { session, sessionId: session._id }
        }));
        
        showToast('Shared session loaded');
      })
      .catch(err => {
        console.error('Error loading shared session:', err);
        showToast('Error loading shared session');
      });
  }

  // Load selected session
  function loadSelectedSession() {
    const select = document.getElementById('session-select');
    if (!select || select.value === 'default') {
      showToast('Select a session first');
      return;
    }
    
    const sessionId = select.value;
    
    // Using socket is more efficient than fetch
    if (socket && socket.connected) {
      socket.emit('load-session', sessionId);
      return;
    }
    
    // Fallback to fetch
    fetch(`/sessions/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.session) return;
        
        const session = data.session;
        activeSessionId = sessionId;
        
        // Apply session settings to UI
        applySessionSettings(session);
        
        // Notify other components
        document.dispatchEvent(new CustomEvent('session-loaded', {
          detail: { session, sessionId }
        }));
        
        showToast('Session loaded');
      })
      .catch(err => {
        console.error('Error loading session:', err);
        showToast('Error loading session');
      });
  }

  // Apply session settings to UI elements
function applySessionSettings(session) {
  // Apply triggers
  const triggers = session.activeTriggers || session.metadata?.triggers || [];
  document.querySelectorAll('.toggle-input').forEach(input => {
    const trigger = input.getAttribute('data-trigger');
    if (trigger) {
      input.checked = triggers.includes(trigger);
    }
  });
  
  // Send triggers to server using standard format
  if (window.socket && window.socket.connected) {
    const username = document.body.getAttribute('data-username');
    if (username) {
      const triggerObjects = triggers.map(t => {
        return typeof t === 'string' 
          ? { name: t, description: 'Trigger effect' } 
          : t;
      });
      
      window.socket.emit('triggers', {
        triggerNames: triggerObjects.map(t => t.name).join(','),
        triggerDetails: triggerObjects,
        username: username
      });
    }
  }
  
  // Apply collar settings
  const collarEnabled = session.collarSettings?.enabled || session.metadata?.collarActive || false;
  const collarText = session.collarSettings?.text || session.metadata?.collarText || '';
  
  const collarEnable = document.getElementById('collar-enable');
  const collarTextarea = document.getElementById('textarea-collar');
  
  if (collarEnable) collarEnable.checked = collarEnabled;
  if (collarTextarea) collarTextarea.value = collarText;
  
  // Apply spiral settings
  const spiralSettings = session.spiralSettings || session.metadata?.spiralSettings || {};
  const spiralEnable = document.getElementById('spirals-enable');
  
  if (spiralEnable) spiralEnable.checked = spiralSettings.enabled || false;
  
  // Update directly through system modules if available
  if (window.bambiSystem) {
    // Update triggers
    window.bambiSystem.saveState('triggers', { 
      triggers: triggers.map(t => ({
        name: typeof t === 'string' ? t : t.name,
        description: typeof t === 'string' ? 'Trigger effect' : (t.description || 'Trigger effect')
      }))
    });
    
    // Update collar
    window.bambiSystem.saveState('collar', {
      enabled: collarEnabled,
      text: collarText
    });
    
    // Update spirals
    window.bambiSystem.saveState('spirals', spiralSettings);
  }
}

  // Get current settings for saving
  function collectSettings() {
    if (window.bambiSystem) {
      return window.bambiSystem.collectSettings();
    }
    
    // Fallback if bambiSystem isn't available
    return {
      activeTriggers: Array.from(document.querySelectorAll('.toggle-input:checked'))
        .map(input => input.getAttribute('data-trigger'))
        .filter(Boolean),
      
      collarSettings: {
        enabled: document.getElementById('collar-enable')?.checked || false,
        text: document.getElementById('textarea-collar')?.value || ''
      },
      
      spiralSettings: {
        enabled: document.getElementById('spirals-enable')?.checked || false,
        spiral1Width: parseFloat(document.getElementById('spiral1-width')?.value || 5),
        spiral2Width: parseFloat(document.getElementById('spiral2-width')?.value || 3),
        spiral1Speed: parseInt(document.getElementById('spiral1-speed')?.value || 20),
        spiral2Speed: parseInt(document.getElementById('spiral2-speed')?.value || 15)
      }
    };
  }

  // Save current session
  function saveSession() {
    const username = document.body.getAttribute('data-username');
    if (!username) {
      showToast('Please log in to save sessions');
      return;
    }
    
    // Get current settings
    const settings = collectSettings();
    
    // Get chat history if available
    let messages = [];
    if (window.chatHistory && Array.isArray(window.chatHistory)) {
      messages = window.chatHistory;
    }
    
    const sessionData = {
      username,
      settings,
      messages,
      sessionId: activeSessionId,
      title: `Session ${new Date().toLocaleString()}`
    };
    
    socket.emit('save-session', sessionData);
    showToast('Session saving...');
  }

  // Delete current session
  function deleteSession() {
    if (!activeSessionId) {
      showToast('No active session to delete');
      return;
    }
    
    if (!confirm('Delete this session?')) return;
    
    fetch(`/sessions/${activeSessionId}`, {
      method: 'DELETE'
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          activeSessionId = null;
          const select = document.getElementById('session-select');
          if (select) select.value = 'default';
          
          loadSessions();
          showToast('Session deleted');
        }
      })
      .catch(err => {
        console.error('Error deleting session:', err);
        showToast('Error deleting session');
      });
  }

  // Share current session
  function shareSession() {
    if (!activeSessionId) {
      showToast('No active session to share');
      return;
    }
    
    fetch(`/sessions/${activeSessionId}/share`, {
      method: 'POST'
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.shareUrl) return;
        
        // Copy to clipboard
        navigator.clipboard.writeText(data.shareUrl);
        
        showToast('Share link copied to clipboard');
      })
      .catch(err => {
        console.error('Error sharing session:', err);
        showToast('Error sharing session');
      });
  }

  // Play random session
  function replayRandom() {
    if (!sessions.length) {
      showToast('No sessions available');
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * sessions.length);
    const session = sessions[randomIndex];
    
    // Select in dropdown
    const select = document.getElementById('session-select');
    if (select) select.value = session._id;
    
    // Load session
    socket.emit('load-session', session._id);
  }

  // Show toast message
  function showToast(message) {
    let toast = document.getElementById('bambi-toast');
    
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'bambi-toast';
      document.body.appendChild(toast);
      
      const style = document.createElement('style');
      style.textContent = `
        #bambi-toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 10px 20px;
          border-radius: 4px;
          z-index: 9999;
          transition: opacity 0.3s;
          opacity: 0;
        }
        #bambi-toast.show {
          opacity: 1;
        }
      `;
      document.head.appendChild(style);
    }
    
    toast.textContent = message;
    toast.className = 'show';
    
    setTimeout(() => {
      toast.className = '';
    }, 3000);
  }

  // Enable a button by ID
  function enableButton(id) {
    const button = document.getElementById(id);
    if (button) button.disabled = false;
  }

  // Set active session ID
  function setActiveSessionId(id) {
    activeSessionId = id;
  }

  // Public API
  return {
    init,
    loadSessions,
    saveSession,
    deleteSession,
    shareSession,
    loadSharedSession,
    setActiveSessionId,
    collectSettings
  };
})();

document.addEventListener('DOMContentLoaded', window.bambiSessions.init);