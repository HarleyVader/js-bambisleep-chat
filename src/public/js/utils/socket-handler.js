window.socketHandler = (function() {
  // Private variables
  let connectionAttempts = 0;
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // ms
  let reconnectTimer = null;
  let isConnecting = false;
  let transportFallbacks = ['websocket', 'polling']; // Fallback options
  let currentTransportIndex = 0;
  
  // Connection status element reference
  let statusIndicator = null;
  
  function init() {
    console.log('Initializing socket connection...');
    
    try {
      // Find status indicator if it exists
      statusIndicator = document.getElementById('connection-status');
      updateConnectionUI('connecting');
      
      // Clear any existing connection
      if (window.socket) {
        window.socket.off();
        window.socket.disconnect();
      }
      
      connectSocket();
      
      // Set up global error handler for uncaught socket errors
      window.addEventListener('error', function(event) {
        if (event.message && event.message.includes('socket')) {
          console.error('Global socket error:', event.message);
          handleConnectionError(new Error(event.message));
        }
      });
    } catch (error) {
      console.error('Socket initialization error:', error);
      updateConnectionUI('error');
    }
  }
  
  function connectSocket() {
    if (isConnecting) return;
    isConnecting = true;
    
    try {
      const transport = transportFallbacks[currentTransportIndex];
      
      // Initialize socket with current transport option
      window.socket = io({
        transports: [transport],
        reconnection: false, // We'll handle reconnection manually
        timeout: 10000
      });
      
      // Set up socket event handlers
      window.socket.on('connect', handleSuccessfulConnection);
      window.socket.on('disconnect', handleDisconnection);
      window.socket.on('connect_error', handleConnectionError);
      window.socket.on('error', handleConnectionError);
      
      // Add debug event listener for development
      window.socket.onAny((event, ...args) => {
        if (event.startsWith('debug-')) {
          console.log(`Socket event: ${event}`, args);
        }
      });
    } catch (error) {
      console.error('Socket creation error:', error);
      handleConnectionError(error);
    }
  }
  
  function handleSuccessfulConnection() {
    console.log('Socket connected successfully');
    isConnecting = false;
    connectionAttempts = 0;
    updateConnectionUI('connected');
    
    // Dispatch global event that other modules can listen for
    document.dispatchEvent(new CustomEvent('socket-connected'));
    
    // Send initial authentication if needed
    if (window.bambiSystem && window.bambiSystem.getState('userProfile')) {
      const profile = window.bambiSystem.getState('userProfile');
      if (profile.userId) {
        window.socket.emit('client-auth', {
          userId: profile.userId,
          sessionId: localStorage.getItem('sessionId') || null
        });
      }
    }
  }
  
  function handleDisconnection(reason) {
    console.warn('Socket disconnected:', reason);
    updateConnectionUI('disconnected');
    
    // Dispatch global event that other modules can listen for
    document.dispatchEvent(new CustomEvent('socket-disconnected', {
      detail: { reason }
    }));
    
    // Attempt reconnection if not manually disconnected
    if (reason !== 'io client disconnect') {
      attemptReconnection();
    }
  }
  
  function handleConnectionError(error) {
    console.error(' Socket connection error:', error);
    isConnecting = false;
    updateConnectionUI('error');
    
    // Try alternative transport if available
    if (currentTransportIndex < transportFallbacks.length - 1) {
      currentTransportIndex++;
      console.log(`Trying alternative transport (attempt ${currentTransportIndex})`);
      connectSocket();
    } else {
      // Reset transport options and try reconnection
      currentTransportIndex = 0;
      attemptReconnection();
    }
  }
  
  function attemptReconnection() {
    // Clear any existing reconnect timer
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    
    connectionAttempts++;
    
    if (connectionAttempts <= maxReconnectAttempts) {
      updateConnectionUI('reconnecting');
      console.log(`Attempting reconnection (${connectionAttempts}/${maxReconnectAttempts})...`);
      
      // Exponential backoff for reconnect attempts
      const delay = reconnectDelay * Math.pow(1.5, connectionAttempts - 1);
      
      reconnectTimer = setTimeout(() => {
        connectSocket();
      }, delay);
    } else {
      console.error('Maximum reconnection attempts reached');
      updateConnectionUI('max-attempts');
      
      // Show offline mode message to user
      showOfflineMessage();
    }
  }
  
  function updateConnectionUI(state) {
    if (!statusIndicator) {
      // Try to find the element again in case it was added after init
      statusIndicator = document.getElementById('connection-status');
    }
    
    if (!statusIndicator) return;
    
    // Remove all status classes
    statusIndicator.classList.remove(
      'connected', 'connecting', 'disconnected', 
      'reconnecting', 'error', 'max-attempts'
    );
    
    // Add current state class
    statusIndicator.classList.add(state);
    
    // Update text based on state
    const statusTexts = {
      'connected': 'Connected',
      'connecting': 'Connecting...',
      'disconnected': 'Disconnected',
      'reconnecting': 'Reconnecting...',
      'error': 'Connection Error',
      'max-attempts': 'Connection Failed'
    };
    
    statusIndicator.textContent = statusTexts[state] || 'Unknown Status';
  }
  
  function showOfflineMessage() {
    // Create offline message if it doesn't exist
    if (!document.getElementById('offline-message')) {
      const messageEl = document.createElement('div');
      messageEl.id = 'offline-message';
      messageEl.className = 'offline-notification';
      messageEl.innerHTML = `
        <div class="offline-content">
          <h3>Connection Lost</h3>
          <p>Unable to connect to BambiSleep servers. Some features may be unavailable.</p>
          <button id="retry-connection" class="btn btn-primary">Try Again</button>
        </div>
      `;
      
      document.body.appendChild(messageEl);
      
      // Add retry button listener
      const retryBtn = document.getElementById('retry-connection');
      if (retryBtn) {
        retryBtn.addEventListener('click', function() {
          connectionAttempts = 0;
          messageEl.remove();
          init();
        });
      }
    }
  }
  
  function manualReconnect() {
    connectionAttempts = 0;
    currentTransportIndex = 0;
    const offlineMsg = document.getElementById('offline-message');
    if (offlineMsg) offlineMsg.remove();
    init();
  }
  
  // Public API
  return {
    init,
    manualReconnect,
    isConnected: function() {
      return window.socket && window.socket.connected;
    }
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Delay connection slightly to allow DOM to fully load
  setTimeout(window.socketHandler.init, 500);
});