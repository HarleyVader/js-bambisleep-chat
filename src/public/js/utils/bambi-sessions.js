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

/**
 * Session sharing module for BambiSleep Chat
 * Handles session sharing and token management
 */
window.sessionSharing = (function() {
  // Private variables
  let shareModal = null;
  let currentSessionId = null;
  let shareToken = null;
  const elements = [];
  
  // Initialize module
  function init() {
    try {
      setupEventListeners();
      createShareModal();
      
      // Listen for system initialization
      document.addEventListener('system-initialized', handleSystemInit);
      
      console.log('Session sharing module initialized');
    } catch (error) {
      console.error('Error initializing session sharing:', error);
    }
  }
  
  // Handle system initialization
  function handleSystemInit() {
    // Check URL for shared session token
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('session');
      
      if (token) {
        loadSharedSession(token);
        
        // Clean URL after loading
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    } catch (error) {
      console.error('Error checking for shared session:', error);
    }
  }
  
  // Set up event listeners
  function setupEventListeners() {
    // Listen for session list rendering to add share buttons
    document.addEventListener('sessions-rendered', enhanceSessionList);
    
    // Check for token in URL on load
    window.addEventListener('load', checkUrlForToken);
  }
  
  // Clean up event listeners
  function tearDown() {
    try {
      // Remove event listeners
      document.removeEventListener('sessions-rendered', enhanceSessionList);
      document.removeEventListener('system-initialized', handleSystemInit);
      window.removeEventListener('load', checkUrlForToken);
      
      // Clean up DOM elements
      if (shareModal && shareModal.parentNode) {
        shareModal.parentNode.removeChild(shareModal);
      }
      
      // Clean up element references
      elements.forEach(el => {
        if (el.parentNode) {
          el.parentNode.replaceChild(el.cloneNode(true), el);
        }
      });
      elements.length = 0;
      
      console.log('Session sharing module cleaned up');
    } catch (error) {
      console.error('Error during session sharing teardown:', error);
    }
  }
  
  // Create share modal
  function createShareModal() {
    // Create modal element if it doesn't exist
    if (!document.getElementById('share-session-modal')) {
      shareModal = document.createElement('div');
      shareModal.id = 'share-session-modal';
      shareModal.className = 'modal';
      shareModal.innerHTML = `
        <div class="modal-content">
          <span class="close">&times;</span>
          <h3>Share Bambi Session</h3>
          <p>Copy the link below to share your session with others:</p>
          <div class="share-link-container">
            <input type="text" id="share-link-input" readonly>
            <button id="copy-link-btn">Copy Link</button>
          </div>
          <div class="share-qr-code" id="share-qr-code"></div>
        </div>
      `;
      
      document.body.appendChild(shareModal);
      
      // Set up close button
      const closeBtn = shareModal.querySelector('.close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          shareModal.style.display = 'none';
        });
        elements.push(closeBtn);
      }
      
      // Set up copy button
      const copyBtn = shareModal.querySelector('#copy-link-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', copyShareLink);
        elements.push(copyBtn);
      }
      
      // Close when clicking outside
      window.addEventListener('click', (event) => {
        if (event.target === shareModal) {
          shareModal.style.display = 'none';
        }
      });
    }
  }
  
  // Enhance session list with share buttons
  function enhanceSessionList(event) {
    try {
      const sessionItems = document.querySelectorAll('.session-item');
      
      sessionItems.forEach(item => {
        // Skip if share button already exists
        if (item.querySelector('.share-session-btn')) return;
        
        const sessionId = item.getAttribute('data-session-id');
        if (!sessionId) return;
        
        // Create share button
        const shareBtn = document.createElement('button');
        shareBtn.className = 'share-session-btn';
        shareBtn.textContent = 'Share';
        shareBtn.dataset.sessionId = sessionId;
        
        // Add click handler
        shareBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          const id = this.getAttribute('data-session-id');
          if (id) {
            showShareModal(id);
          }
        });
        
        // Add to DOM
        const loadBtn = item.querySelector('.load-session-btn');
        if (loadBtn) {
          item.insertBefore(shareBtn, loadBtn);
        } else {
          item.appendChild(shareBtn);
        }
        
        elements.push(shareBtn);
      });
    } catch (error) {
      console.error('Error enhancing session list:', error);
    }
  }
  
  // Show share modal for a specific session
  function showShareModal(sessionId) {
    try {
      if (!shareModal) createShareModal();
      
      currentSessionId = sessionId;
      
      // Generate or retrieve token
      generateShareToken(sessionId, (token) => {
        if (!token) {
          console.error('Failed to generate share token');
          return;
        }
        
        shareToken = token;
        
        // Create share link
        const shareLink = `${window.location.origin}${window.location.pathname}?session=${token}`;
        const linkInput = document.getElementById('share-link-input');
        if (linkInput) {
          linkInput.value = shareLink;
        }
        
        // Show modal
        shareModal.style.display = 'block';
        
        // Award XP for sharing
        awardXpForSharing();
      });
    } catch (error) {
      console.error('Error showing share modal:', error);
    }
  }
  
  // Generate a share token for the session
  function generateShareToken(sessionId, callback) {
    try {
      if (window.socket && window.socket.connected) {
        window.socket.emit('client-generate-session-token', {
          sessionId,
          timestamp: Date.now()
        }, function(response) {
          if (response && response.success && response.token) {
            callback(response.token);
          } else {
            console.error('Error generating token:', response);
            callback(null);
          }
        });
      } else {
        // Fallback to local token generation
        const tempToken = `session-${sessionId}-${Date.now()}`;
        callback(btoa(tempToken));
      }
    } catch (error) {
      console.error('Error generating share token:', error);
      callback(null);
    }
  }
  
  // Load a shared session from token
  function loadSharedSession(token) {
    try {
      if (!token) return;
      
      // Show loading indicator
      showToast('Loading shared session...', 'info');
      
      if (window.socket && window.socket.connected) {
        window.socket.emit('client-load-shared-session', {
          token,
          timestamp: Date.now()
        }, function(response) {
          if (response && response.success && response.session) {
            // Apply the session data
            if (window.bambiSystem) {
              window.bambiSystem.applySessionSettings(response.session);
              showToast('Shared session loaded successfully!');
              
              // Award XP for using a shared session
              awardXpForAction('shared-session-used', 5);
            } else {
              console.error('bambiSystem not available');
              showToast('Error loading shared session', 'error');
            }
          } else {
            console.error('Error loading shared session:', response);
            showToast('Error loading shared session', 'error');
          }
        });
      } else {
        console.error('Socket not connected');
        showToast('Not connected to server', 'error');
      }
    } catch (error) {
      console.error('Error loading shared session:', error);
      showToast('Error loading shared session', 'error');
    }
  }
  
  // Copy share link to clipboard
  function copyShareLink() {
    try {
      const linkInput = document.getElementById('share-link-input');
      if (!linkInput) return;
      
      linkInput.select();
      linkInput.setSelectionRange(0, 99999); // For mobile devices
      
      document.execCommand('copy');
      
      // Show success message
      const copyBtn = document.getElementById('copy-link-btn');
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      }
    } catch (error) {
      console.error('Error copying share link:', error);
    }
  }
  
  // Check URL for session token
  function checkUrlForToken() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('session');
      
      if (token) {
        loadSharedSession(token);
        
        // Clean URL after loading
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    } catch (error) {
      console.error('Error checking URL for token:', error);
    }
  }
  
  // Award XP for sharing a session
  function awardXpForSharing() {
    if (!window.socket || !window.socket.connected) return;
    
    window.socket.emit('client-award-xp', {
      action: 'session-shared',
      amount: 10,
      timestamp: Date.now()
    });
  }
  
  // Award XP for user actions
  function awardXpForAction(action, amount) {
    if (window.socket && window.socket.connected) {
      window.socket.emit('client-award-xp', {
        action,
        amount,
        timestamp: Date.now()
      });
    }
  }
  
  // Show toast notification
  function showToast(message, type = 'success') {
    // Use existing toast system if available
    if (window.bambiSessions && typeof window.bambiSessions.showToast === 'function') {
      window.bambiSessions.showToast(message, type === 'error');
      return;
    }
    
    // Simple fallback toast implementation
    try {
      const toast = document.createElement('div');
      toast.className = `toast-message ${type}`;
      toast.textContent = message;
      
      document.body.appendChild(toast);
      
      // Animate in
      setTimeout(() => {
        toast.classList.add('show');
      }, 10);
      
      // Remove after 3 seconds
      setTimeout(() => {
        toast.classList.remove('show');
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
  
  // Public API
  return {
    init,
    tearDown,
    showShareModal,
    loadSharedSession
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.sessionSharing.init);