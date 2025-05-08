/**
 * BambiSleep Session Management Module
 * Handles saving, loading and applying session data
 */
window.bambiSessions = (function() {
  // Private variables
  let activeSessionId = null;
  let isSessionLoading = false;
  
  // DOM elements cache
  let saveSessionBtn = null;
  let loadSessionBtn = null;
  let sessionNameInput = null;
  let sessionsListContainer = null;
  
  /**
   * Initialize the sessions module
   */
  function init() {
    try {
      // Cache DOM elements
      saveSessionBtn = document.getElementById('save-session-btn');
      loadSessionBtn = document.getElementById('load-session-btn');
      sessionNameInput = document.getElementById('session-name-input');
      sessionsListContainer = document.getElementById('sessions-list');
      
      // Setup event listeners
      if (saveSessionBtn) {
        saveSessionBtn.addEventListener('click', saveCurrentSession);
      }
      
      if (loadSessionBtn) {
        loadSessionBtn.addEventListener('click', showSessionsList);
      }
      
      // Listen for socket events
      if (window.socket) {
        window.socket.on('sessions-list', handleSessionsList);
        window.socket.on('session-saved', handleSessionSaved);
      }
      
      console.log('BambiSessions module initialized');
    } catch (error) {
      console.error('Error initializing bambiSessions:', error);
    }
  }
  
  /**
   * Save current session with all active settings
   */
  function saveCurrentSession() {
    try {
      const sessionName = sessionNameInput ? sessionNameInput.value.trim() : 'Session ' + new Date().toLocaleString();
      
      if (!sessionName) {
        showToast('Please enter a session name', 'error');
        return;
      }
      
      // Collect all settings from bambiSystem
      const sessionData = collectSettings();
      
      if (window.socket && window.socket.connected) {
        window.socket.emit('client-save-session', {
          name: sessionName,
          data: sessionData,
          timestamp: Date.now()
        });
        
        showToast('Saving session...', 'info');
      } else {
        showToast('Not connected to server', 'error');
      }
    } catch (error) {
      console.error('Error saving session:', error);
      showToast('Failed to save session', 'error');
    }
  }
  
  /**
   * Show the list of available sessions
   */
  function showSessionsList() {
    if (window.socket && window.socket.connected) {
      window.socket.emit('client-get-sessions');
      showToast('Loading sessions...', 'info');
    } else {
      showToast('Not connected to server', 'error');
    }
  }
  
  /**
   * Handle the sessions list from server
   */
  function handleSessionsList(data) {
    try {
      if (!data || !data.sessions || !sessionsListContainer) {
        return;
      }
      
      // Clear existing list
      sessionsListContainer.innerHTML = '';
      
      if (data.sessions.length === 0) {
        const noSessionsEl = document.createElement('p');
        noSessionsEl.textContent = 'No saved sessions found';
        sessionsListContainer.appendChild(noSessionsEl);
        return;
      }
      
      // Create list of sessions
      const sessionsList = document.createElement('ul');
      sessionsList.className = 'sessions-list';
      
      data.sessions.forEach(session => {
        const sessionItem = document.createElement('li');
        sessionItem.className = 'session-item';
        
        const sessionName = document.createElement('span');
        sessionName.className = 'session-name';
        sessionName.textContent = session.name;
        
        const sessionDate = document.createElement('span');
        sessionDate.className = 'session-date';
        sessionDate.textContent = new Date(session.timestamp).toLocaleString();
        
        const loadBtn = document.createElement('button');
        loadBtn.className = 'load-session-item-btn';
        loadBtn.textContent = 'Load';
        loadBtn.addEventListener('click', () => loadSession(session.id));
        
        sessionItem.appendChild(sessionName);
        sessionItem.appendChild(sessionDate);
        sessionItem.appendChild(loadBtn);
        sessionsList.appendChild(sessionItem);
      });
      
      sessionsListContainer.appendChild(sessionsList);
      
      // Show the sessions modal
      const sessionsModal = document.getElementById('sessions-modal');
      if (sessionsModal) {
        sessionsModal.style.display = 'block';
      }
    } catch (error) {
      console.error('Error handling sessions list:', error);
    }
  }
  
  /**
   * Load a specific session by ID
   */
  function loadSession(sessionId) {
    if (!sessionId) return;
    
    isSessionLoading = true;
    
    if (window.socket && window.socket.connected) {
      window.socket.emit('client-load-session', {
        sessionId: sessionId
      });
      
      showToast('Loading session...', 'info');
      
      // Close the sessions modal
      const sessionsModal = document.getElementById('sessions-modal');
      if (sessionsModal) {
        sessionsModal.style.display = 'none';
      }
    } else {
      showToast('Not connected to server', 'error');
      isSessionLoading = false;
    }
  }
  
  /**
   * Handle session saved confirmation
   */
  function handleSessionSaved(data) {
    if (data && data.success) {
      showToast('Session saved successfully', 'success');
      
      if (data.sessionId) {
        activeSessionId = data.sessionId;
      }
    } else {
      showToast('Failed to save session', 'error');
    }
  }
  
  /**
   * Apply session data to the application
   */
  function applySessionData(sessionData) {
    try {
      if (!sessionData) return;
      
      // Apply to central system if available
      if (window.bambiSystem) {
        window.bambiSystem.loadState(sessionData);
      }
      
      // Manually apply triggers
      if (sessionData.activeTriggers && Array.isArray(sessionData.activeTriggers)) {
        if (window.socket && window.socket.connected) {
          window.socket.emit('triggers', {
            triggerNames: sessionData.activeTriggers.join(','),
            triggerDetails: sessionData.activeTriggers.map(t => ({ name: t }))
          });
        }
      }
      
      // Apply spiral settings
      if (sessionData.spiralSettings && window.bambiSpirals) {
        window.bambiSpirals.updateSettings(sessionData.spiralSettings);
      }
      
      // Apply collar settings
      if (sessionData.collarSettings && sessionData.collarSettings.enabled && 
          sessionData.collarSettings.text && window.socket) {
        window.socket.emit('collar', {
          data: sessionData.collarSettings.text,
          socketId: window.socket.id
        });
        
        // Show collar container
        const collarContainer = document.getElementById('collar-container');
        if (collarContainer) {
          collarContainer.style.display = 'block';
        }
      }
      
      // Dispatch event to notify system components
      document.dispatchEvent(new CustomEvent('session-loaded', {
        detail: { session: sessionData }
      }));
      
      showToast('Session applied successfully', 'success');
    } catch (error) {
      console.error('Error applying session data:', error);
      showToast('Error applying session', 'error');
    } finally {
      isSessionLoading = false;
    }
  }
  
  /**
   * Collect all settings from system components
   */
  function collectSettings() {
    // Get from central state manager first
    if (window.bambiSystem) {
      return window.bambiSystem.collectSettings();
    }
    
    // Fallback to direct collection if no central system
    const settings = {
      activeTriggers: [],
      collarSettings: {
        enabled: false,
        text: ''
      },
      spiralSettings: {
        enabled: false,
        spiral1Width: 1,
        spiral2Width: 1,
        spiral1Speed: 0.02,
        spiral2Speed: 0.01
      }
    };
    
    // Collect active triggers
    try {
      const activeTriggerElements = document.querySelectorAll('.trigger-toggle:checked, .toggle-input:checked');
      settings.activeTriggers = Array.from(activeTriggerElements)
        .map(el => el.getAttribute('data-trigger') || el.getAttribute('id'))
        .filter(Boolean);
    } catch (e) {
      console.error('Error collecting triggers:', e);
    }
    
    // Collect collar settings
    try {
      const collarEnabled = document.getElementById('collar-enabled');
      const collarText = document.getElementById('textarea-collar');
      
      if (collarEnabled) {
        settings.collarSettings.enabled = collarEnabled.checked;
      }
      
      if (collarText) {
        settings.collarSettings.text = collarText.value.trim();
      }
    } catch (e) {
      console.error('Error collecting collar settings:', e);
    }
    
    // Collect spiral settings
    try {
      const spiralEnabled = document.getElementById('spiral-enabled');
      const spiral1Width = document.getElementById('spiral1-width');
      const spiral2Width = document.getElementById('spiral2-width');
      const spiral1Speed = document.getElementById('spiral1-speed');
      const spiral2Speed = document.getElementById('spiral2-speed');
      
      if (spiralEnabled) {
        settings.spiralSettings.enabled = spiralEnabled.checked;
      }
      
      if (spiral1Width) {
        settings.spiralSettings.spiral1Width = parseFloat(spiral1Width.value) || 1;
      }
      
      if (spiral2Width) {
        settings.spiralSettings.spiral2Width = parseFloat(spiral2Width.value) || 1;
      }
      
      if (spiral1Speed) {
        settings.spiralSettings.spiral1Speed = parseFloat(spiral1Speed.value) || 0.02;
      }
      
      if (spiral2Speed) {
        settings.spiralSettings.spiral2Speed = parseFloat(spiral2Speed.value) || 0.01;
      }
    } catch (e) {
      console.error('Error collecting spiral settings:', e);
    }
    
    return settings;
  }
  
  /**
   * Set the active session ID
   */
  function setActiveSessionId(sessionId) {
    activeSessionId = sessionId;
  }
  
  /**
   * Get the active session ID
   */
  function getActiveSessionId() {
    return activeSessionId;
  }
  
  /**
   * Show a toast notification
   */
  function showToast(message, type = 'info') {
    try {
      let toastContainer = document.querySelector('.toast-container');
      if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
      }
      
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      
      toastContainer.appendChild(toast);
      
      // Show toast
      setTimeout(() => {
        toast.classList.add('toast-visible');
      }, 10);
      
      // Remove toast after delay
      setTimeout(() => {
        toast.classList.remove('toast-visible');
        toast.classList.add('toast-hidden');
        
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }, 3000);
    } catch (error) {
      console.error('Error showing toast:', error);
    }
  }
  
  // Initialize on page load
  document.addEventListener('DOMContentLoaded', init);
  
  // Public API
  return {
    init,
    saveCurrentSession,
    loadSession,
    applySessionData,
    collectSettings,
    setActiveSessionId,
    getActiveSessionId
  };
})();