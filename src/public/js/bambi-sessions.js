// Central session management for BambiSleep
window.bambiSessions = (function() {
  // Session data storage
  let sessions = [];
  let activeSessionId = null;

  // DOM references (lazy loaded when needed)
  const el = {};

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
    
    // Central event listener for system settings updates
    document.addEventListener('system-update', function(e) {
      const sessionSettings = collectSettings();
      if (activeSessionId) {
        updateActiveSession(sessionSettings);
      }
    });
    
    // Create refresh button
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
    const urlParams = new URLSearchParams(window.location.search);
    const shareToken = urlParams.get('session');
    
    if (shareToken) loadSharedSession(shareToken);
  }

  // Load sessions list
  function loadSessions() {
    updateStatus('Loading sessions...');
    
    const username = getUsername();
    if (!username) {
      updateStatus('Not logged in');
      return;
    }
    
    fetch(`/sessions/api/sessions/${username}`)
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.message || 'Failed to load sessions');
        
        sessions = data.sessions || [];
        populateSessionDropdown(sessions);
        
        // Show UI elements
        showElement('.session-select-container');
        showElement('.session-stats-container');
        
        // Update stats
        updateSessionStats(sessions);
        
        // Update status
        if (sessions.length > 0) {
          updateStatus(`${sessions.length} sessions loaded`, 'success');
          enableElement('#replay-history-btn');
          
          // Change load button behavior
          const loadBtn = document.getElementById('load-history-btn');
          if (loadBtn) {
            loadBtn.removeEventListener('click', loadSessions);
            loadBtn.addEventListener('click', loadSelectedSession);
            loadBtn.textContent = 'Load Selected';
          }
        } else {
          updateStatus('No sessions found');
        }
      })
      .catch(err => {
        console.error('Error loading sessions:', err);
        updateStatus('Error loading sessions', 'error');
      });
  }

  // Show element by selector
  function showElement(selector) {
    const el = document.querySelector(selector);
    if (el) el.style.display = 'block';
  }

  // Enable element by selector
  function enableElement(selector) {
    const el = document.querySelector(selector);
    if (el) el.disabled = false;
  }

  // Update session stats display
  function updateSessionStats(sessions) {
    // Calculate totals
    const totalMessages = sessions.reduce((sum, s) => sum + (s.messages?.length || 0), 0);
    const totalWords = sessions.reduce((sum, s) => {
      return sum + (s.messages || []).reduce((msgSum, msg) => {
        return msgSum + (msg.content?.split(/\s+/).length || 0);
      }, 0);
    }, 0);
    
    // Update UI elements
    updateElement('#session-count', sessions.length);
    updateElement('#message-count', totalMessages);
    updateElement('#word-count', totalWords);
  }

  // Update element content by selector
  function updateElement(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  // Populate session dropdown
  function populateSessionDropdown(sessions) {
    const select = document.getElementById('session-select');
    if (!select) return;
    
    // Clear existing options except first
    while (select.options.length > 1) select.remove(1);
    
    sessions.forEach(session => {
      const date = new Date(session.createdAt || session.metadata?.createdAt || Date.now());
      const option = document.createElement('option');
      option.value = session._id;
      
      // Format date: MM/DD HH:MM
      const dateStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
      option.textContent = `${dateStr} (${session.messages?.length || 0} msgs)`;
      
      select.appendChild(option);
    });
  }

  // Update status message
  function updateStatus(message, type) {
    const status = document.getElementById('session-history-status');
    if (!status) return;
    
    status.textContent = message;
    status.className = 'session-history-status';
    
    if (type) status.classList.add(type);
  }

  // Load selected session
  function loadSelectedSession() {
    const select = document.getElementById('session-select');
    if (!select || !select.value || select.value === 'default') {
      updateStatus('Please select a session');
      return;
    }
    
    const sessionId = select.value;
    const session = sessions.find(s => s._id === sessionId);
    
    if (!session) {
      updateStatus('Session not found');
      return;
    }
    
    activeSessionId = sessionId;
    
    // Update status
    const date = new Date(session.createdAt || session.metadata?.createdAt || Date.now());
    updateStatus(`Loaded session from ${date.toLocaleString()}`, 'success');
    
    // Apply settings
    applySessionSettings(session);
    
    // Notify system
    document.dispatchEvent(new CustomEvent('session-loaded', {
      detail: { session, sessionId }
    }));
  }

  // Apply session settings to UI
  function applySessionSettings(session) {
    // Apply collar settings
    applyCollarSettings(session);
    
    // Apply spiral settings
    applySpiralSettings(session);
    
    // Apply trigger settings
    applyTriggerSettings(session);
  }

  // Apply collar settings
  function applyCollarSettings(session) {
    const collarSettings = session.collarSettings || {
      enabled: session.metadata?.collarActive || false,
      text: session.metadata?.collarText || ''
    };
    
    const enable = document.getElementById('collar-enable');
    const text = document.getElementById('textarea-collar');
    
    if (enable) enable.checked = collarSettings.enabled;
    if (text) text.value = collarSettings.text || '';
    
    // Use bambiSystem if available
    if (window.bambiSystem) {
      window.bambiSystem.saveState('collar', {
        enabled: collarSettings.enabled,
        text: collarSettings.text || ''
      });
    }
  }

  // Apply spiral settings
  function applySpiralSettings(session) {
    const spiralSettings = session.spiralSettings || session.metadata?.spiralSettings || {
      enabled: false,
      spiral1Width: 5.0,
      spiral2Width: 3.0,
      spiral1Speed: 20,
      spiral2Speed: 15
    };
    
    // Use bambiSystem if available
    if (window.bambiSystem) {
      window.bambiSystem.saveState('spirals', spiralSettings);
    }
    
    // Also update UI directly
    if (window.bambiSpirals && typeof window.bambiSpirals.updateSettings === 'function') {
      window.bambiSpirals.updateSettings(spiralSettings);
    }
  }

  // Apply trigger settings
  function applyTriggerSettings(session) {
    const triggers = session.activeTriggers || session.metadata?.triggers || [];
    
    // Reset all triggers
    document.querySelectorAll('.toggle-input').forEach(t => t.checked = false);
    
    // Enable active triggers
    triggers.forEach(trigger => {
      const name = typeof trigger === 'string' ? trigger : trigger.name;
      const toggle = document.querySelector(`.toggle-input[data-trigger="${name}"]`);
      if (toggle) toggle.checked = true;
    });
    
    // Use bambiSystem if available
    if (window.bambiSystem) {
      // Format triggers as objects
      const triggerObjs = triggers.map(t => {
        if (typeof t === 'string') {
          return { name: t, description: 'Trigger effect' };
        }
        return t;
      });
      
      window.bambiSystem.saveState('triggers', { triggers: triggerObjs });
    }
  }

  // Get current username
  function getUsername() {
    return document.body.getAttribute('data-username') || 
           document.querySelector('.user-profile-name')?.textContent ||
           getCookie('bambiname');
  }

  // Get cookie value
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }

  // Replay random session
  function replayRandom() {
    if (sessions.length === 0) {
      updateStatus('No sessions available');
      return;
    }
    
    const index = Math.floor(Math.random() * sessions.length);
    const session = sessions[index];
    
    // Select in dropdown
    const select = document.getElementById('session-select');
    if (select) select.value = session._id;
    
    activeSessionId = session._id;
    applySessionSettings(session);
    
    updateStatus(`Loaded random session from ${new Date(session.createdAt || session.metadata?.createdAt).toLocaleString()}`, 'success');
  }

  // Load shared session by token
  function loadSharedSession(token) {
    if (!token) return;
    
    fetch(`/sessions/shared/${token}`)
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error('Failed to load shared session');
        
        const session = data.session;
        applySessionSettings(session);
        
        // Add to sessions list
        sessions = [session];
        populateSessionDropdown(sessions);
        
        updateStatus('Shared session loaded successfully', 'success');
      })
      .catch(err => {
        console.error('Error loading shared session:', err);
        updateStatus('Failed to load shared session', 'error');
      });
  }

  // Share current session
  function shareSession() {
    if (!activeSessionId) {
      showToast('No active session to share', 'error');
      return;
    }
    
    fetch(`/sessions/${activeSessionId}/share`, {
      method: 'POST'
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.message || 'Failed to share session');
        
        const shareUrl = data.shareUrl;
        navigator.clipboard.writeText(shareUrl);
        
        showToast('Share link copied to clipboard', 'success');
      })
      .catch(err => {
        console.error('Error sharing session:', err);
        showToast('Failed to share session', 'error');
      });
  }

  // Delete session
  function deleteSession(sessionId) {
    if (!sessionId) sessionId = activeSessionId;
    if (!sessionId) {
      showToast('No session selected', 'error');
      return;
    }
    
    if (!confirm('Delete this session?')) return;
    
    fetch(`/sessions/${sessionId}`, {
      method: 'DELETE'
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.message || 'Failed to delete session');
        
        if (sessionId === activeSessionId) activeSessionId = null;
        
        loadSessions();
        showToast('Session deleted', 'success');
      })
      .catch(err => {
        console.error('Error deleting session:', err);
        showToast('Failed to delete session', 'error');
      });
  }

  // Update active session
  function updateActiveSession(settings) {
    if (!activeSessionId) return;
    
    fetch(`/sessions/${activeSessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          console.warn('Failed to update session:', data.message);
        }
      })
      .catch(err => {
        console.error('Error updating session:', err);
      });
  }

  // Collect current settings
  function collectSettings() {
    if (window.bambiSystem) {
      return window.bambiSystem.collectSettings();
    }
    
    // Fallback to manual collection
    return {
      activeTriggers: getActiveTriggers(),
      collarSettings: getCollarSettings(),
      spiralSettings: getSpiralSettings()
    };
  }

  // Get active triggers
  function getActiveTriggers() {
    const triggers = [];
    document.querySelectorAll('.toggle-input:checked').forEach(t => {
      const name = t.getAttribute('data-trigger');
      if (name) triggers.push(name);
    });
    return triggers;
  }

  // Get collar settings
  function getCollarSettings() {
    const enable = document.getElementById('collar-enable');
    const text = document.getElementById('textarea-collar');
    
    return {
      enabled: enable ? enable.checked : false,
      text: text ? text.value : ''
    };
  }

  // Get spiral settings
  function getSpiralSettings() {
    if (window.bambiSpirals && typeof window.bambiSpirals.getCurrentSettings === 'function') {
      return window.bambiSpirals.getCurrentSettings();
    }
    
    const enable = document.getElementById('spirals-enable');
    
    return {
      enabled: enable ? enable.checked : false,
      spiral1Width: parseFloat(document.getElementById('spiral1-width')?.value || 5),
      spiral2Width: parseFloat(document.getElementById('spiral2-width')?.value || 3),
      spiral1Speed: parseInt(document.getElementById('spiral1-speed')?.value || 20),
      spiral2Speed: parseInt(document.getElementById('spiral2-speed')?.value || 15)
    };
  }

  // Save current session
  function saveCurrentSession(title) {
    const username = getUsername();
    if (!username) {
      showToast('You must be logged in to save sessions', 'error');
      return;
    }
    
    const settings = collectSettings();
    
    // Add message history if available
    const messages = window.chatHistory || [];
    
    const sessionData = {
      username,
      title: title || `Session ${new Date().toLocaleString()}`,
      messages,
      settings
    };
    
    const method = activeSessionId ? 'PUT' : 'POST';
    const url = activeSessionId ? 
      `/sessions/${activeSessionId}` : 
      `/sessions`;
    
    fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionData)
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.message || 'Failed to save session');
        
        if (!activeSessionId && data.sessionId) {
          activeSessionId = data.sessionId;
        }
        
        showToast(activeSessionId ? 'Session updated' : 'Session saved', 'success');
        loadSessions();
      })
      .catch(err => {
        console.error('Error saving session:', err);
        showToast('Failed to save session', 'error');
      });
  }

  // Show toast notification
  function showToast(message, type) {
    // Create toast if it doesn't exist
    let toast = document.getElementById('bambi-toast');
    
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'bambi-toast';
      document.body.appendChild(toast);
      
      // Add styles
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
        #bambi-toast.visible {
          opacity: 1;
        }
        #bambi-toast.success {
          border-left: 4px solid #00ff00;
        }
        #bambi-toast.error {
          border-left: 4px solid #ff0000;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Set content and type
    toast.textContent = message;
    toast.className = type || '';
    
    // Show and auto hide
    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.textContent = '', 300);
    }, 3000);
  }

  // Public API
  return {
    init,
    loadSessions,
    saveSession: saveCurrentSession,
    deleteSession,
    shareSession,
    loadSharedSession,
    getActiveSessionId: () => activeSessionId,
    collectSettings
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.bambiSessions.init);