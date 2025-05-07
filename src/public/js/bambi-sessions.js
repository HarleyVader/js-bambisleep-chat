// Unified sessions management module
window.bambiSessions = (function() {
  // Session data storage
  let sessionData = [];
  let activeSessionId = null;
  
  // DOM element references
  let elements = {
    status: null,
    select: null,
    sessionCount: null,
    messageCount: null,
    wordCount: null,
    loadBtn: null,
    replayBtn: null
  };
  
  // Initialize the module
  function init() {
    // Get DOM elements
    elements.status = document.getElementById('session-history-status');
    elements.select = document.getElementById('session-select');
    elements.sessionCount = document.getElementById('session-count');
    elements.messageCount = document.getElementById('message-count');
    elements.wordCount = document.getElementById('word-count');
    elements.loadBtn = document.getElementById('load-history-btn');
    elements.replayBtn = document.getElementById('replay-history-btn');
    
    // Attach event listeners
    if (elements.loadBtn) {
      elements.loadBtn.addEventListener('click', loadHistory);
    }
    
    if (elements.replayBtn) {
      elements.replayBtn.addEventListener('click', replayRandom);
    }
    
    // Create refresh button if container exists
    createRefreshButton();
    
    // Check for URL parameters to load shared session
    checkForSharedSession();
  }
  
  // Create refresh button
  function createRefreshButton() {
    const container = document.querySelector('.session-select-container');
    if (container) {
      // Check if refresh button already exists
      if (!container.querySelector('.refresh-history-btn')) {
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = 'Refresh List';
        refreshBtn.className = 'refresh-history-btn';
        refreshBtn.addEventListener('click', refreshHistory);
        container.appendChild(refreshBtn);
      }
    }
  }
  
  // Check URL for shared session token
  function checkForSharedSession() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareToken = urlParams.get('shareToken');
    
    if (shareToken) {
      loadSharedSession(shareToken);
    }
  }
  
  // Refresh sessions list
  function refreshHistory() {
    // Reset the load button if it was changed
    if (elements.loadBtn) {
      elements.loadBtn.removeEventListener('click', loadSession);
      elements.loadBtn.addEventListener('click', loadHistory);
      elements.loadBtn.textContent = 'Load History';
    }
    
    // Load sessions list
    loadHistory();
  }
  
  // Load user's session history
  function loadHistory() {
    updateStatus('Loading sessions...', '');
    
    // Get current username
    const username = getCurrentUsername();
    
    fetch(`/sessions/api/sessions/${username}`)
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          throw new Error(data.message || 'Failed to load sessions');
        }
        
        sessionData = data.sessions || [];
        
        // Calculate total stats
        const totalMessages = sessionData.reduce((sum, session) => sum + (session.messages?.length || 0), 0);
        const totalWords = sessionData.reduce((sum, session) => {
          return sum + (session.messages || []).reduce((msgSum, msg) => {
            return msgSum + (msg.content?.split(/\s+/).length || 0);
          }, 0);
        }, 0);
        
        updateStats({
          totalSessions: sessionData.length,
          totalMessages: totalMessages,
          totalWords: totalWords
        });
        
        populateDropdown(sessionData);
        
        // Show the dropdown and stats container
        const selectContainer = document.querySelector('.session-select-container');
        const statsContainer = document.querySelector('.session-stats-container');
        
        if (selectContainer) selectContainer.style.display = 'block';
        if (statsContainer) statsContainer.style.display = 'flex';
        
        if (sessionData.length > 0) {
          updateStatus(`${sessionData.length} sessions available`, 'success');
          if (elements.replayBtn) elements.replayBtn.disabled = false;
          
          // Change load button functionality
          if (elements.loadBtn) {
            elements.loadBtn.removeEventListener('click', loadHistory);
            elements.loadBtn.addEventListener('click', loadSession);
            elements.loadBtn.textContent = 'Load Selected';
          }
        } else {
          updateStatus('No sessions found', '');
        }
      })
      .catch(err => {
        console.error('Error loading sessions:', err);
        updateStatus('Error loading sessions', 'error');
        
        sessionData = [];
        updateStats({totalSessions: 0, totalMessages: 0, totalWords: 0});
        populateDropdown([]);
      });
  }
  
  // Load a specific session by ID
  function loadSession() {
    const sessionId = elements.select?.value;
    if (!sessionId || sessionId === "default") {
      updateStatus('Please select a session', '');
      return;
    }
    
    const session = sessionData.find(s => s._id === sessionId);
    if (!session) return;
    
    // Set active session ID
    activeSessionId = sessionId;
    
    // Show which session was loaded
    const date = new Date(session.createdAt || session.metadata?.createdAt || Date.now()).toLocaleString();
    updateStatus(`Loaded session from ${date}`, 'success');
    
    // Load all session settings
    loadSessionSettings(session);
    
    // Dispatch event that session was loaded
    document.dispatchEvent(new CustomEvent('session-loaded', { 
      detail: { session, sessionId }
    }));
  }
  
  // Load all settings from a session
  function loadSessionSettings(session) {
    // Load collar settings if available
    if (session.collarSettings) {
      loadCollarSettings(session.collarSettings);
    }
    
    // Load spiral settings if available
    if (session.spiralSettings || (session.metadata && session.metadata.spiralSettings)) {
      const spiralSettings = session.spiralSettings || session.metadata.spiralSettings;
      loadSpiralSettings(spiralSettings);
    }
    
    // Activate triggers if available
    const activeTriggers = session.activeTriggers || 
                          (session.metadata && session.metadata.triggers) || 
                          [];
    
    if (activeTriggers.length > 0) {
      activateTriggers(activeTriggers);
    }
  }
  
  // Load collar settings
  function loadCollarSettings(settings) {
    if (!settings) return;
    
    const collarEnable = document.getElementById('collar-enable');
    const collarText = document.getElementById('textarea-collar');
    
    if (collarEnable) collarEnable.checked = settings.enabled;
    if (collarText) collarText.value = settings.text || '';
    
    // Show message
    const collarMsg = document.querySelector('.collar-messages');
    if (collarMsg) {
      collarMsg.innerHTML = '<div class="success">Collar settings loaded from session</div>';
      setTimeout(() => collarMsg.innerHTML = '', 3000);
    }
    
    // Save collar settings via the collar module
    if (window.bambiCollar && typeof window.bambiCollar.saveCollarSettings === 'function') {
      window.bambiCollar.saveCollarSettings();
    }
  }
  
  // Load spiral settings
  function loadSpiralSettings(settings) {
    if (!settings) return;
    
    const spiralsEnable = document.getElementById('spirals-enable');
    const spiral1Width = document.getElementById('spiral1-width');
    const spiral2Width = document.getElementById('spiral2-width');
    const spiral1Speed = document.getElementById('spiral1-speed');
    const spiral2Speed = document.getElementById('spiral2-speed');
    
    // Set values from saved settings
    if (spiralsEnable && 'enabled' in settings) {
      spiralsEnable.checked = settings.enabled;
      spiralsEnable.dispatchEvent(new Event('change'));
    }
    
    if (spiral1Width && settings.spiral1Width) {
      spiral1Width.value = settings.spiral1Width;
      document.getElementById('spiral1-width-value').textContent = settings.spiral1Width;
    }
    
    if (spiral2Width && settings.spiral2Width) {
      spiral2Width.value = settings.spiral2Width;
      document.getElementById('spiral2-width-value').textContent = settings.spiral2Width;
    }
    
    if (spiral1Speed && settings.spiral1Speed) {
      spiral1Speed.value = settings.spiral1Speed;
      document.getElementById('spiral1-speed-value').textContent = settings.spiral1Speed;
    }
    
    if (spiral2Speed && settings.spiral2Speed) {
      spiral2Speed.value = settings.spiral2Speed;
      document.getElementById('spiral2-speed-value').textContent = settings.spiral2Speed;
    }
    
    // Save spiral settings via the spirals module if it exists
    if (window.bambiSpirals && typeof window.bambiSpirals.saveSettings === 'function') {
      window.bambiSpirals.saveSettings();
    }
  }
  
  // Activate triggers from session
  function activateTriggers(triggers) {
    // Get all trigger toggles
    const allToggles = document.querySelectorAll('.trigger-toggle-item input[type="checkbox"]');
    
    // Reset all triggers first
    allToggles.forEach(toggle => toggle.checked = false);
    
    // Activate the ones from the session
    triggers.forEach(triggerName => {
      // Find toggle by looking at data-trigger attribute
      const toggle = Array.from(allToggles).find(t => 
        t.getAttribute('data-trigger') === triggerName || 
        t.getAttribute('data-trigger-name') === triggerName);
      
      if (toggle) toggle.checked = true;
    });
    
    // Navigate to triggers panel to show changes
    const triggersBtn = document.getElementById('triggers-btn');
    if (triggersBtn) triggersBtn.click();
    
    // Save the trigger state via the triggers module
    if (window.bambiTriggers && typeof window.bambiTriggers.saveTriggerState === 'function') {
      window.bambiTriggers.saveTriggerState();
    }
  }
  
  // Populate session dropdown
  function populateDropdown(sessions) {
    if (!elements.select) return;
    
    // Clear options except first placeholder
    while (elements.select.options.length > 1) {
      elements.select.remove(1);
    }
    
    sessions.forEach(session => {
      const date = new Date(session.createdAt || session.metadata?.createdAt || Date.now());
      const option = document.createElement('option');
      option.value = session._id;
      
      // Format date as MM/DD/YYYY HH:MM
      const formattedDate = `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      
      // Show message count if available
      const msgCount = session.messages?.length || 0;
      option.textContent = `${formattedDate} (${msgCount} msgs)`;
      
      // Add title attribute with more details
      option.title = `Title: ${session.title || 'Untitled Session'}\nDate: ${date.toLocaleString()}\nMessages: ${msgCount}`;
      
      elements.select.appendChild(option);
    });
  }
  
  // Update stats display
  function updateStats(data) {
    if (elements.sessionCount) {
      elements.sessionCount.textContent = data.totalSessions || 0;
    }
    
    if (elements.messageCount) {
      elements.messageCount.textContent = data.totalMessages || 0;
    }
    
    if (elements.wordCount) {
      elements.wordCount.textContent = data.totalWords || 0;
    }
  }
  
  // Update status message
  function updateStatus(message, className) {
    if (!elements.status) return;
    
    elements.status.textContent = message;
    elements.status.className = 'session-history-status';
    
    if (className) {
      elements.status.classList.add(className);
    }
  }
  
  // Replay a random session
  function replayRandom() {
    if (sessionData.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * sessionData.length);
    
    if (elements.select) {
      elements.select.value = sessionData[randomIndex]._id;
      loadSession();
    }
  }
  
  // Get current username from cookies or profile
  function getCurrentUsername() {
    return (document.cookie.split('; ').find(row => row.startsWith('bambiname=')) || '').split('=')[1] || 
           document.querySelector('.user-profile-name')?.textContent || 
           'anonBambi';
  }
  
  // Save current session
  function saveCurrentSession(options = {}) {
    const username = getCurrentUsername();
    
    // Collect settings from different modules
    const sessionSettings = collectSessionSettings();
    
    // Prepare session data
    const sessionData = {
      username,
      title: options.title || 'Session ' + new Date().toLocaleString(),
      messages: options.messages || [],
      metadata: {
        createdAt: new Date(),
        lastActivity: new Date(),
        triggers: sessionSettings.activeTriggers,
        collarActive: sessionSettings.collarSettings.enabled,
        collarText: sessionSettings.collarSettings.text,
        spiralSettings: sessionSettings.spiralSettings
      }
    };
    
    // If we have an active session ID, update that session instead of creating a new one
    const endpoint = activeSessionId ? 
      `/sessions/api/sessions/${username}/${activeSessionId}` : 
      `/sessions/api/sessions/${username}`;
    
    const method = activeSessionId ? 'PUT' : 'POST';
    
    fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionData)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        console.log(activeSessionId ? 'Session updated successfully' : 'Session saved successfully');
        
        // If this is a new session, set the active session ID
        if (!activeSessionId && data.sessionId) {
          activeSessionId = data.sessionId;
        }
        
        // Show success notification
        const message = activeSessionId ? 'Session updated' : 'Session saved';
        showNotification(message, 'success');
        
        // Reload history to show the new/updated session
        loadHistory();
      } else {
        console.error('Failed to save session:', data.message);
        showNotification('Failed to save session', 'error');
      }
    })
    .catch(err => {
      console.error('Error saving session:', err);
      showNotification('Error saving session', 'error');
    });
  }
  
  // Delete a session
  function deleteSession(sessionId) {
    if (!sessionId || !confirm('Are you sure you want to delete this session?')) return;
    
    const username = getCurrentUsername();
    
    fetch(`/sessions/${sessionId}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showNotification('Session deleted successfully', 'success');
        
        // Clear active session if deleted
        if (activeSessionId === sessionId) {
          activeSessionId = null;
        }
        
        // Reload history to update the list
        loadHistory();
      } else {
        showNotification('Failed to delete session: ' + data.message, 'error');
      }
    })
    .catch(err => {
      console.error('Error deleting session:', err);
      showNotification('Error deleting session', 'error');
    });
  }
  
  // Share a session
  function shareSession(sessionId) {
    if (!sessionId) return;
    
    fetch(`/sessions/${sessionId}/share`, {
      method: 'POST'
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Show share dialog with the URL
        const shareUrl = data.shareUrl;
        
        // Create a temporary input to copy to clipboard
        const tempInput = document.createElement('input');
        document.body.appendChild(tempInput);
        tempInput.value = shareUrl;
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        
        showNotification('Share URL copied to clipboard', 'success');
        
        // Show modal with URL
        showShareModal(shareUrl);
      } else {
        showNotification('Failed to share session: ' + data.message, 'error');
      }
    })
    .catch(err => {
      console.error('Error sharing session:', err);
      showNotification('Error sharing session', 'error');
    });
  }
  
  // Show share modal
  function showShareModal(shareUrl) {
    // Check if modal already exists
    let modal = document.getElementById('share-session-modal');
    
    if (!modal) {
      // Create modal
      modal = document.createElement('div');
      modal.id = 'share-session-modal';
      modal.className = 'modal';
      
      const modalContent = document.createElement('div');
      modalContent.className = 'modal-content';
      
      const closeBtn = document.createElement('span');
      closeBtn.className = 'close';
      closeBtn.innerHTML = '&times;';
      closeBtn.onclick = function() {
        modal.style.display = 'none';
      };
      
      const modalHeader = document.createElement('div');
      modalHeader.className = 'modal-header';
      modalHeader.innerHTML = '<h2>Share Session</h2>';
      modalHeader.appendChild(closeBtn);
      
      const modalBody = document.createElement('div');
      modalBody.className = 'modal-body';
      
      const urlInput = document.createElement('input');
      urlInput.type = 'text';
      urlInput.value = shareUrl;
      urlInput.readOnly = true;
      urlInput.className = 'share-url-input';
      urlInput.onclick = function() {
        this.select();
      };
      
      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copy URL';
      copyBtn.className = 'copy-url-btn';
      copyBtn.onclick = function() {
        urlInput.select();
        document.execCommand('copy');
        this.textContent = 'Copied!';
        setTimeout(() => {
          this.textContent = 'Copy URL';
        }, 2000);
      };
      
      modalBody.appendChild(document.createElement('p')).textContent = 'Share this URL with others:';
      modalBody.appendChild(urlInput);
      modalBody.appendChild(copyBtn);
      
      modalContent.appendChild(modalHeader);
      modalContent.appendChild(modalBody);
      modal.appendChild(modalContent);
      
      document.body.appendChild(modal);
      
      // Close when clicking outside
      window.onclick = function(event) {
        if (event.target === modal) {
          modal.style.display = 'none';
        }
      };
    }
    
    // Update URL in case it's a different share
    const urlInput = modal.querySelector('.share-url-input');
    if (urlInput) urlInput.value = shareUrl;
    
    // Show the modal
    modal.style.display = 'block';
  }
  
  // Load a shared session by token
  function loadSharedSession(token) {
    if (!token) return;
    
    fetch(`/sessions/shared/${token}`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to load shared session');
        }
        return res.json();
      })
      .then(data => {
        if (data.session) {
          // Apply the shared session
          const session = data.session;
          
          // Store session in our session data
          sessionData = [session];
          
          // Load session settings
          loadSessionSettings(session);
          
          // Show notification
          showNotification('Shared session loaded', 'success');
        } else {
          throw new Error(data.message || 'Failed to load shared session');
        }
      })
      .catch(err => {
        console.error('Error loading shared session:', err);
        showNotification('Error loading shared session', 'error');
      });
  }
  
  // Show notification
  function showNotification(message, type = 'info') {
    // Create notification area if it doesn't exist
    let notificationArea = document.querySelector('.notification-area');
    
    if (!notificationArea) {
      notificationArea = document.createElement('div');
      notificationArea.className = 'notification-area';
      document.body.appendChild(notificationArea);
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'notification-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = function() {
      notification.remove();
    };
    
    notification.appendChild(closeBtn);
    notificationArea.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        notification.remove();
      }, 500);
    }, 5000);
  }
  
  // Function to collect current settings for saving
  function collectSessionSettings() {
    // Get active triggers from all trigger toggles
    const activeTriggers = [];
    const triggerToggles = document.querySelectorAll('.trigger-toggle-item input[type="checkbox"]:checked');
    
    triggerToggles.forEach(toggle => {
      // Try to get trigger name from data attributes
      const triggerName = toggle.getAttribute('data-trigger') || toggle.getAttribute('data-trigger-name');
      if (triggerName) {
        activeTriggers.push(triggerName);
      }
    });
    
    // Get collar settings
    const collarEnabled = document.getElementById('collar-enable');
    const collarText = document.getElementById('textarea-collar');
    const collarSettings = {
      enabled: collarEnabled ? collarEnabled.checked : false,
      text: collarText ? collarText.value : ''
    };
    
    // Get spiral settings
    let spiralSettings = { enabled: false };
    
    // If bambiSpirals module exists and has a method to get current settings
    if (window.bambiSpirals && typeof window.bambiSpirals.getCurrentSettings === 'function') {
      spiralSettings = window.bambiSpirals.getCurrentSettings();
    } else {
      // Fallback to getting settings from DOM
      const spiralsEnable = document.getElementById('spirals-enable');
      const spiral1Width = document.getElementById('spiral1-width');
      const spiral2Width = document.getElementById('spiral2-width');
      const spiral1Speed = document.getElementById('spiral1-speed');
      const spiral2Speed = document.getElementById('spiral2-speed');
      
      spiralSettings = {
        enabled: spiralsEnable ? spiralsEnable.checked : false,
        spiral1Width: spiral1Width ? parseFloat(spiral1Width.value) : 5.0,
        spiral2Width: spiral2Width ? parseFloat(spiral2Width.value) : 3.0,
        spiral1Speed: spiral1Speed ? parseInt(spiral1Speed.value) : 20,
        spiral2Speed: spiral2Speed ? parseInt(spiral2Speed.value) : 15
      };
    }
    
    return {
      activeTriggers,
      collarSettings,
      spiralSettings
    };
  }
  
  // Return public API
  return {
    init,
    loadHistory,
    loadSession,
    saveCurrentSession,
    deleteSession,
    shareSession,
    loadSharedSession,
    collectSessionSettings,
    getActiveSessionId: () => activeSessionId
  };
})();

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
  if (window.bambiSessions) {
    window.bambiSessions.init();
  }
});

// Add notification styles
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .notification-area {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 300px;
    }
    
    .notification {
      padding: 12px 35px 12px 15px;
      border-radius: 5px;
      color: white;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
      position: relative;
      animation: slide-in 0.3s ease-out forwards;
      opacity: 1;
      transition: opacity 0.5s ease;
    }
    
    .notification.fade-out {
      opacity: 0;
    }
    
    .notification.success {
      background-color: rgba(46, 204, 113, 0.9);
      border-left: 4px solid #27ae60;
    }
    
    .notification.error {
      background-color: rgba(231, 76, 60, 0.9);
      border-left: 4px solid #c0392b;
    }
    
    .notification.info {
      background-color: rgba(52, 152, 219, 0.9);
      border-left: 4px solid #2980b9;
    }
    
    .notification-close {
      position: absolute;
      top: 7px;
      right: 7px;
      font-size: 16px;
      cursor: pointer;
    }
    
    /* Share modal styles */
    .modal {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
    }
    
    .modal-content {
      background-color: var(--background);
      border: 1px solid var(--tertiary-color);
      border-radius: 8px;
      margin: 15% auto;
      padding: 0;
      width: 80%;
      max-width: 500px;
      box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
      animation: modal-appear 0.3s ease-out;
    }
    
    .modal-header {
      padding: 10px 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(23, 219, 216, 0.3);
    }
    
    .modal-header h2 {
      margin: 0;
      color: var(--tertiary-alt);
      font-size: 1.25rem;
    }
    
    .modal-body {
      padding: 15px;
    }
    
    .close {
      color: var(--tertiary-alt);
      font-size: 28px;
      font-weight: bold;
      cursor: pointer;
    }
    
    .share-url-input {
      width: 100%;
      padding: 10px;
      margin: 10px 0;
      border-radius: 4px;
      border: 1px solid var(--tertiary-color);
      background-color: rgba(10, 38, 38, 0.7);
      color: var(--primary-alt);
    }
    
    .copy-url-btn {
      background-color: var(--tertiary-color);
      color: var(--primary-alt);
      border: none;
      padding: 8px 15px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.3s;
    }
    
    .copy-url-btn:hover {
      background-color: var(--tertiary-alt);
      box-shadow: 0 0 10px rgba(23, 219, 216, 0.5);
    }
    
    @keyframes slide-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes modal-appear {
      from {
        opacity: 0;
        transform: scale(0.8);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `;
  
  document.head.appendChild(style);
})();