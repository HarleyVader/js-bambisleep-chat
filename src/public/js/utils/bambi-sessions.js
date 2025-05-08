/**
 * Session management utility for BambiSleep Chat
 * Handles loading, saving, and sharing user sessions
 */
window.bambiSessions = (function() {
  // Private variables
  let sessions = [];
  let currentSession = null;
  let isLoading = false;
  
  // Toast notification system
  function showToast(message, type = 'info') {
    try {
      const toast = document.createElement('div');
      toast.className = `bambi-toast ${type}`;
      toast.textContent = message;
      
      document.body.appendChild(toast);
      
      // Show toast
      setTimeout(() => {
        toast.classList.add('show');
      }, 10);
      
      // Auto hide after 3 seconds
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          document.body.removeChild(toast);
        }, 300);
      }, 3000);
    } catch (error) {
      console.error('Error showing toast:', error);
    }
  }

  // Init module
  function init() {
    setupEventListeners();
    checkUrlParams();
    loadSessionsFromLocalStorage();
    checkUrlForSharedSession();
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
    if (shareBtn) shareBtn.addEventListener('click', () => shareSession(currentSession?._id));
    
    // Session title editing
    const titleInput = document.getElementById('session-title');
    if (titleInput) titleInput.addEventListener('change', updateSessionTitle);
    
    // Add refresh button to session container
    addRefreshButton();
    
    // Socket event listeners
    if (window.socket && window.socket.connected) {
      window.socket.on('session-loaded', handleSessionLoaded);
      window.socket.on('sessions-list', handleSessionsList);
      window.socket.on('session-created', handleSessionCreated);
      window.socket.on('session-deleted', handleSessionDeleted);
      window.socket.on('session-error', handleSessionError);
      window.socket.on('session-updated', handleSessionUpdated);
    }
    
    // Add listener for system state changes
    document.addEventListener('system-update', handleSystemUpdate);
    
    // Add auto-save event listener
    document.addEventListener('auto-save-session', handleAutoSave);
  }
  
  // Clean up event listeners
  function tearDown() {
    const loadBtn = document.getElementById('load-history-btn');
    if (loadBtn) loadBtn.removeEventListener('click', loadSessions);
    
    const replayBtn = document.getElementById('replay-history-btn');
    if (replayBtn) replayBtn.removeEventListener('click', replayRandom);
    
    const saveBtn = document.getElementById('save-session-btn');
    if (saveBtn) saveBtn.removeEventListener('click', saveSession);
    
    const deleteBtn = document.getElementById('delete-session-btn');
    if (deleteBtn) deleteBtn.removeEventListener('click', deleteSession);
    
    const shareBtn = document.getElementById('share-session-btn');
    if (shareBtn) shareBtn.removeEventListener('click', () => shareSession(currentSession?._id));
    
    const titleInput = document.getElementById('session-title');
    if (titleInput) titleInput.removeEventListener('change', updateSessionTitle);
    
    // Socket event listeners
    if (window.socket) {
      window.socket.off('session-loaded', handleSessionLoaded);
      window.socket.off('sessions-list', handleSessionsList);
      window.socket.off('session-created', handleSessionCreated);
      window.socket.off('session-deleted', handleSessionDeleted);
      window.socket.off('session-error', handleSessionError);
      window.socket.off('session-updated', handleSessionUpdated);
    }
    
    document.removeEventListener('system-update', handleSystemUpdate);
    document.removeEventListener('auto-save-session', handleAutoSave);
  }
  
  // Add refresh button to session container
  function addRefreshButton() {
    const sessionContainer = document.getElementById('session-history-controls');
    if (!sessionContainer) return;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'refresh-sessions-btn';
    refreshBtn.innerHTML = '🔄';
    refreshBtn.title = 'Refresh sessions';
    refreshBtn.addEventListener('click', loadSessions);
    
    const heading = sessionContainer.querySelector('h3');
    if (heading) {
      heading.appendChild(refreshBtn);
    }
  }
  
  // Check URL parameters for shared session token
  function checkUrlParams() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('session');
      
      if (sessionToken) {
        loadSharedSession(sessionToken);
        
        // Clean up URL to prevent accidental refreshes
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    } catch (error) {
      console.error('Error checking URL parameters:', error);
    }
  }
  
  // Check URL for shared session token
  function checkUrlForSharedSession() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareToken = urlParams.get('share');
    
    if (shareToken) {
      showToast('Loading shared session...', 'info');
      
      fetch(`/api/sessions/shared/${shareToken}`)
        .then(response => response.json())
        .then(data => {
          if (data.success && data.session) {
            handleSessionLoaded(data.session);
            showToast('Shared session loaded successfully', 'success');
          } else {
            showToast(data.message || 'Failed to load shared session', 'error');
          }
        })
        .catch(error => {
          console.error('Error loading shared session:', error);
          showToast('Error loading shared session', 'error');
        });
    }
  }
  
  // Handler for when a session is loaded
  function handleSessionLoaded(data) {
    if (!data || !data.session) return;
    
    currentSession = data.session;
    
    // Save to localStorage for persistence
    saveCurrentSessionToLocalStorage();
    
    // Update UI
    updateSessionUI();
    
    // Update session title if available
    const titleInput = document.getElementById('session-title');
    if (titleInput && currentSession.title) {
      titleInput.value = currentSession.title;
    }
    
    // Notify user
    showToast('Session loaded successfully');
    
    // Notify other components
    document.dispatchEvent(new CustomEvent('session-loaded', {
      detail: { session: data.session }
    }));
  }
  
  // Handler for sessions list
  function handleSessionsList(data) {
    if (!data || !Array.isArray(data.sessions)) return;
    
    sessions = data.sessions;
    isLoading = false;
    
    // Save sessions to localStorage
    saveSessionsToLocalStorage();
    
    // Update sessions dropdown
    updateSessionsDropdown();
    
    // Update session count display
    updateSessionCount();
  }
  
  // Handler for session created event
  function handleSessionCreated(data) {
    if (!data || !data.sessionId) return;
    
    // Reload sessions to include the new one
    loadSessions();
    
    // Store current session ID
    currentSession = { _id: data.sessionId };
    
    // Save to localStorage
    saveCurrentSessionToLocalStorage();
    
    // Notify user
    showToast('Session saved successfully');
  }
  
  // Handler for session deleted event
  function handleSessionDeleted(data) {
    if (!data || !data.sessionId) return;
    
    // Remove from sessions list
    sessions = sessions.filter(s => s._id !== data.sessionId);
    
    // Update localStorage
    saveSessionsToLocalStorage();
    
    // Update UI
    updateSessionsDropdown();
    updateSessionCount();
    
    // Clear current session if it was deleted
    if (currentSession && currentSession._id === data.sessionId) {
      currentSession = null;
      saveCurrentSessionToLocalStorage();
    }
    
    // Notify user
    showToast('Session deleted successfully');
  }
  
  // Handler for session updated event
  function handleSessionUpdated(data) {
    if (!data || !data.session) return;
    
    // Update in sessions list
    sessions = sessions.map(s => 
      s._id === data.session._id ? data.session : s
    );
    
    // Update current session if it was updated
    if (currentSession && currentSession._id === data.session._id) {
      currentSession = data.session;
      saveCurrentSessionToLocalStorage();
    }
    
    // Update UI
    updateSessionsDropdown();
    
    // Notify user
    showToast('Session updated successfully');
  }
  
  // Handler for session error
  function handleSessionError(error) {
    showToast(error || 'Error with session operation', 'error');
    isLoading = false;
  }
  
  // Handler for system state updates
  function handleSystemUpdate(event) {
    // Only refresh if it's relevant to sessions
    if (event.detail && (event.detail.section === 'all' || 
                         event.detail.section === 'triggers' || 
                         event.detail.section === 'collar' || 
                         event.detail.section === 'spirals')) {
      updateSessionUI();
    }
  }
  
  // Handle auto-save request
  function handleAutoSave() {
    if (currentSession && currentSession._id) {
      saveSession(true); // true = silent save (no notifications)
    }
  }
  
  // Update the sessions dropdown
  function updateSessionsDropdown() {
    const select = document.getElementById('session-select');
    if (!select) return;
    
    // Clear existing options
    select.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select Session --';
    select.appendChild(defaultOption);
    
    // Add sessions
    sessions.forEach(session => {
      const option = document.createElement('option');
      option.value = session._id;
      option.textContent = session.title || `Session ${new Date(session.metadata.createdAt).toLocaleString()}`;
      
      // Select current session if applicable
      if (currentSession && currentSession._id === session._id) {
        option.selected = true;
      }
      
      select.appendChild(option);
    });
    
    // Add event listener
    select.addEventListener('change', loadSelectedSession);
  }
  
  // Update session count display
  function updateSessionCount() {
    const countElem = document.getElementById('session-count');
    if (!countElem) return;
    
    countElem.textContent = sessions.length;
  }
  
  // Update session UI based on current session
  function updateSessionUI() {
    if (!currentSession) return;
    
    // Apply settings from current session if available
    if (window.bambiSystem && typeof window.bambiSystem.applySessionSettings === 'function') {
      window.bambiSystem.applySessionSettings(currentSession);
    } else {
      // Fallback - apply settings directly
      applySessionSettings(currentSession);
    }
  }
  
  // Apply session settings to UI elements
  function applySessionSettings(session) {
    try {
      // Apply triggers
      if (session.activeTriggers || session.metadata?.triggers) {
        const triggers = session.activeTriggers || session.metadata?.triggers || [];
        applyTriggers(triggers);
      }
      
      // Apply collar settings
      if (session.collarSettings || (session.metadata?.collarActive !== undefined)) {
        const collarActive = session.collarSettings?.enabled || session.metadata?.collarActive || false;
        const collarText = session.collarSettings?.text || session.metadata?.collarText || '';
        
        applyCollarSettings(collarActive, collarText);
      }
      
      // Apply spiral settings
      if (session.spiralSettings || session.metadata?.spiralSettings) {
        const spiralSettings = session.spiralSettings || session.metadata?.spiralSettings || {};
        applySpiralSettings(spiralSettings);
      }
    } catch (error) {
      console.error('Error applying session settings:', error);
      showToast('Error applying session settings', 'error');
    }
  }
  
  // Apply triggers from session
  function applyTriggers(triggers) {
    const toggles = document.querySelectorAll('.toggle-input');
    
    // Clear existing triggers
    toggles.forEach(toggle => {
      toggle.checked = false;
    });
    
    // Set active triggers
    toggles.forEach(toggle => {
      const triggerName = toggle.getAttribute('data-trigger');
      if (triggerName && triggers.includes(triggerName)) {
        toggle.checked = true;
      }
    });
    
    // Notify trigger controls if available
    if (window.triggerControls && typeof window.triggerControls.refreshTriggers === 'function') {
      window.triggerControls.refreshTriggers();
    }
  }
  
  // Apply collar settings
  function applyCollarSettings(enabled, text) {
    const collarEnable = document.getElementById('collar-enable');
    const collarText = document.getElementById('textarea-collar');
    
    if (collarEnable) collarEnable.checked = enabled;
    if (collarText) collarText.value = text;
    
    // Notify collar controls if available
    if (window.collarControls && typeof window.collarControls.refreshCollar === 'function') {
      window.collarControls.refreshCollar();
    }
  }
  
  // Apply spiral settings
  function applySpiralSettings(settings) {
    const spiralEnable = document.getElementById('spirals-enable');
    const spiral1Width = document.getElementById('spiral1-width');
    const spiral2Width = document.getElementById('spiral2-width');
    const spiral1Speed = document.getElementById('spiral1-speed');
    const spiral2Speed = document.getElementById('spiral2-speed');
    
    if (spiralEnable) spiralEnable.checked = settings.enabled || false;
    if (spiral1Width) spiral1Width.value = settings.spiral1Width || 5.0;
    if (spiral2Width) spiral2Width.value = settings.spiral2Width || 3.0;
    if (spiral1Speed) spiral1Speed.value = settings.spiral1Speed || 20;
    if (spiral2Speed) spiral2Speed.value = settings.spiral2Speed || 15;
    
    // Notify spiral controls if available
    if (window.spiralControls && typeof window.spiralControls.refreshSpirals === 'function') {
      window.spiralControls.refreshSpirals();
    }
  }
  
  // Collect all settings from UI for saving
  function collectSettings() {
    try {
      // First, try to get from central state manager
      if (window.bambiSystem && typeof window.bambiSystem.collectSettings === 'function') {
        return window.bambiSystem.collectSettings();
      }
      
      // Fallback to direct collection
      return {
        activeTriggers: getActiveTriggers(),
        collarSettings: getCollarSettings(),
        spiralSettings: getSpiralSettings()
      };
    } catch (error) {
      console.error('Error collecting settings:', error);
      return {};
    }
  }
  
  // Get active triggers from UI
  function getActiveTriggers() {
    return Array.from(document.querySelectorAll('.toggle-input:checked'))
      .map(input => input.getAttribute('data-trigger'))
      .filter(Boolean);
  }
  
  // Get collar settings from UI
  function getCollarSettings() {
    const enable = document.getElementById('collar-enable');
    const text = document.getElementById('textarea-collar');
    
    return {
      enabled: enable ? enable.checked : false,
      text: text ? text.value : ''
    };
  }
  
  // Get spiral settings from UI
  function getSpiralSettings() {
    const enable = document.getElementById('spirals-enable');
    const spiral1Width = document.getElementById('spiral1-width');
    const spiral2Width = document.getElementById('spiral2-width');
    const spiral1Speed = document.getElementById('spiral1-speed');
    const spiral2Speed = document.getElementById('spiral2-speed');
    
    return {
      enabled: enable ? enable.checked : false,
      spiral1Width: spiral1Width ? parseFloat(spiral1Width.value) : 5.0,
      spiral2Width: spiral2Width ? parseFloat(spiral2Width.value) : 3.0,
      spiral1Speed: spiral1Speed ? parseInt(spiral1Speed.value) : 20,
      spiral2Speed: spiral2Speed ? parseInt(spiral2Speed.value) : 15
    };
  }
  
  // Save sessions to localStorage
  function saveSessionsToLocalStorage() {
    try {
      localStorage.setItem('bambiSessions', JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving sessions to localStorage:', error);
    }
  }
  
  // Save current session to localStorage
  function saveCurrentSessionToLocalStorage() {
    try {
      localStorage.setItem('bambiCurrentSession', JSON.stringify(currentSession));
    } catch (error) {
      console.error('Error saving current session to localStorage:', error);
    }
  }
  
  // Load sessions from localStorage
  function loadSessionsFromLocalStorage() {
    try {
      const savedSessions = localStorage.getItem('bambiSessions');
      if (savedSessions) {
        sessions = JSON.parse(savedSessions);
        updateSessionsDropdown();
        updateSessionCount();
      }
      
      const savedCurrentSession = localStorage.getItem('bambiCurrentSession');
      if (savedCurrentSession) {
        currentSession = JSON.parse(savedCurrentSession);
        updateSessionUI();
      }
    } catch (error) {
      console.error('Error loading sessions from localStorage:', error);
    }
  }
  
  // Load sessions from server
  function loadSessions() {
    if (isLoading) return;
    
    isLoading = true;
    showToast('Loading sessions...');
    
    const username = document.body.getAttribute('data-username') || window.username;
    if (!username) {
      showToast('Username not found', 'error');
      isLoading = false;
      return;
    }
    
    if (window.socket && window.socket.connected) {
      window.socket.emit('get-sessions', { username });
    } else {
      fetch(`/sessions/list/${username}`)
        .then(response => response.json())
        .then(data => {
          handleSessionsList(data);
        })
        .catch(error => {
          console.error('Error loading sessions:', error);
          showToast('Error loading sessions', 'error');
          isLoading = false;
        });
    }
  }
  
  // Load selected session from dropdown
  function loadSelectedSession() {
    const select = document.getElementById('session-select');
    if (!select || !select.value) return;
    
    const sessionId = select.value;
    
    if (window.socket && window.socket.connected) {
      window.socket.emit('load-session', sessionId);
    } else {
      fetch(`/sessions/${sessionId}`)
        .then(response => response.json())
        .then(data => {
          handleSessionLoaded(data);
        })
        .catch(error => {
          console.error('Error loading session:', error);
          showToast('Error loading session', 'error');
        });
    }
  }
  
  // Load shared session by token
  function loadSharedSession(token) {
    if (!token) return;
    
    showToast('Loading shared session...');
    
    fetch(`/sessions/shared/${token}`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.session) {
          handleSessionLoaded(data);
        } else {
          showToast(data.message || 'Failed to load shared session', 'error');
        }
      })
      .catch(error => {
        console.error('Error loading shared session:', error);
        showToast('Error loading shared session', 'error');
      });
  }
  
  // Update session title
  function updateSessionTitle(event) {
    if (!currentSession || !currentSession._id) {
      showToast('No session selected', 'error');
      return;
    }
    
    const newTitle = event.target.value.trim();
    if (!newTitle) {
      event.target.value = currentSession.title || '';
      return;
    }
    
    if (window.socket && window.socket.connected) {
      window.socket.emit('update-session', {
        sessionId: currentSession._id,
        updates: { title: newTitle }
      });
    } else {
      fetch(`/sessions/${currentSession._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: newTitle })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          currentSession.title = newTitle;
          saveCurrentSessionToLocalStorage();
          showToast('Session title updated');
        } else {
          showToast(data.message || 'Failed to update title', 'error');
        }
      })
      .catch(error => {
        console.error('Error updating session title:', error);
        showToast('Error updating session title', 'error');
      });
    }
  }
  
  // Save current session
  function saveSession(silent = false) {
    const username = document.body.getAttribute('data-username') || window.username;
    if (!username || username === 'anonBambi') {
      if (!silent) showToast('You must be logged in to save sessions', 'error');
      return;
    }
    
    if (!silent) showToast('Saving session...');
    
    // Get chat history
    const chatMessages = Array.from(document.querySelectorAll('#response .message'))
      .map(msg => {
        const role = msg.classList.contains('user-message') ? 'user' : 'assistant';
        const content = msg.querySelector('.message-content')?.textContent || '';
        return { role, content };
      });
    
    // Collect all settings from UI elements
    const settings = collectSettings();
    
    // Get session title if available
    const titleInput = document.getElementById('session-title');
    const title = titleInput?.value || `Session ${new Date().toLocaleString()}`;
    
    // Prepare data for saving
    const sessionData = {
      username,
      title,
      messages: chatMessages,
      settings,
      sessionId: currentSession?._id
    };
    
    if (window.socket && window.socket.connected) {
      window.socket.emit('save-session', sessionData);
    } else {
      fetch('/sessions/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sessionData)
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          handleSessionCreated(data);
        } else {
          if (!silent) showToast(data.message || 'Failed to save session', 'error');
        }
      })
      .catch(error => {
        console.error('Error saving session:', error);
        if (!silent) showToast('Error saving session', 'error');
      });
    }
  }
  
  // Delete current session
  function deleteSession() {
    if (!currentSession || !currentSession._id) {
      showToast('No session selected', 'error');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }
    
    showToast('Deleting session...');
    
    if (window.socket && window.socket.connected) {
      window.socket.emit('delete-session', { sessionId: currentSession._id });
    } else {
      fetch(`/sessions/${currentSession._id}`, {
        method: 'DELETE'
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          handleSessionDeleted({ sessionId: currentSession._id });
        } else {
          showToast(data.message || 'Failed to delete session', 'error');
        }
      })
      .catch(error => {
        console.error('Error deleting session:', error);
        showToast('Error deleting session', 'error');
      });
    }
  }
  
  // Share session via URL token
  function shareSession(sessionId) {
    if (!sessionId && currentSession) {
      sessionId = currentSession._id;
    }
    
    if (!sessionId) {
      showToast('No session selected to share', 'error');
      return;
    }
    
    showToast('Generating share link...', 'info');
    
    // Request share token from server
    fetch(`/api/sessions/${sessionId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data.success && data.shareToken) {
        // Create shareable URL
        const shareUrl = `${window.location.origin}/sessions/shared/${data.shareToken}`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(shareUrl)
          .then(() => {
            showToast('Share link copied to clipboard!', 'success');
          })
          .catch(() => {
            // Fallback for clipboard API failure
            const input = document.createElement('input');
            input.value = shareUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            showToast('Share link copied to clipboard!', 'success');
          });
        
        // Store shared session info
        if (window.bambiSystem) {
          window.bambiSystem.saveState('sharedSessions', {
            [sessionId]: {
              shareToken: data.shareToken,
              shareUrl: shareUrl,
              sharedAt: Date.now()
            }
          });
        }
      } else {
        showToast(data.message || 'Failed to generate share link', 'error');
      }
    })
    .catch(error => {
      console.error('Error sharing session:', error);
      showToast('Error generating share link', 'error');
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
    
    // Use our own API
    loadSelectedSession();
  }
  
  // Auto-save function (called by timer)
  function setupAutoSave(interval = 60000) {
    // Set up auto-save interval
    const autoSaveInterval = setInterval(() => {
      // Only auto-save if we have a current session and user is logged in
      const username = document.body.getAttribute('data-username') || window.username;
      if (currentSession && currentSession._id && username && username !== 'anonBambi') {
        saveSession(true); // Silent save
      }
    }, interval);
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      clearInterval(autoSaveInterval);
      // Last chance save
      if (currentSession && currentSession._id) {
        saveSession(true);
      }
    });
    
    return autoSaveInterval;
  }
  
  // Public API
  return {
    init,
    tearDown,
    loadSessions,
    saveSession,
    deleteSession,
    shareSession,
    replayRandom,
    loadSelectedSession,
    loadSharedSession,
    collectSettings,
    applySessionSettings,
    showToast,
    setupAutoSave,
    updateSessionTitle,
    getCurrentSession: () => currentSession
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  window.bambiSessions.init();
  // Set up auto-save every minute
  window.bambiSessions.setupAutoSave(60000);
});