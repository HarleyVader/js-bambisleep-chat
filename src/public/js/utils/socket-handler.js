// Socket connection handler for BambiSleep Chat

window.socketHandler = (function() {
  // Private variables
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const reconnectDelay = 2000; // Initial delay in ms
  let reconnectTimer = null;
  let transportFallbacks = ['websocket', 'polling']; // Available transports
  let currentTransportIndex = 0;
  
  // Connection status tracking
  let isConnecting = false;
  let connectionStatus = 'disconnected';
  
  // Event callbacks storage
  const eventCallbacks = {};
  
  /**
   * Initialize socket connection with fallback support
   */
  function initializeSocket() {
    try {
      if (window.socket) {
        // Clean up existing socket if present
        cleanupSocketListeners();
      }
      
      isConnecting = true;
      updateConnectionStatus('connecting');
      
      // Get current transport option
      const transport = transportFallbacks[currentTransportIndex];
      
      // Socket.io connection with current transport
      window.socket = io({
        transports: [transport],
        reconnection: false // We'll handle reconnection manually
      });
      
      // Set up event listeners
      setupSocketListeners();
      
    } catch (error) {
      console.error('Socket initialization error:', error);
      handleConnectionError(error);
    }
  }
  
  /**
   * Set up all socket event listeners
   */
  function setupSocketListeners() {
    if (!window.socket) return;
    
    window.socket.on('connect', handleConnect);
    window.socket.on('disconnect', handleDisconnect);
    window.socket.on('connect_error', handleConnectionError);
    window.socket.on('error', handleConnectionError);
    
    // Restore any registered event callbacks
    Object.keys(eventCallbacks).forEach(event => {
      eventCallbacks[event].forEach(callback => {
        window.socket.on(event, callback);
      });
    });
  }
  
  /**
   * Clean up socket event listeners
   */
  function cleanupSocketListeners() {
    if (!window.socket) return;
    
    window.socket.off('connect', handleConnect);
    window.socket.off('disconnect', handleDisconnect);
    window.socket.off('connect_error', handleConnectionError);
    window.socket.off('error', handleConnectionError);
    
    // Remove any registered event callbacks
    Object.keys(eventCallbacks).forEach(event => {
      eventCallbacks[event].forEach(callback => {
        window.socket.off(event, callback);
      });
    });
  }
  
  /**
   * Handle successful connection
   */
  function handleConnect() {
    console.log('Socket connected successfully');
    reconnectAttempts = 0;
    isConnecting = false;
    updateConnectionStatus('connected');
    
    // Clear any pending reconnect timers
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    // Enable interactive elements
    document.querySelectorAll('.requires-connection').forEach(el => {
      el.disabled = false;
    });
    
    // Dispatch connection event
    document.dispatchEvent(new CustomEvent('socket-connected'));
  }
  
  /**
   * Handle disconnection
   */
  function handleDisconnect(reason) {
    console.log('Socket disconnected:', reason);
    updateConnectionStatus('disconnected');
    
    // Disable interactive elements
    document.querySelectorAll('.requires-connection').forEach(el => {
      el.disabled = true;
    });
    
    // Attempt reconnection
    attemptReconnect();
    
    // Dispatch disconnection event
    document.dispatchEvent(new CustomEvent('socket-disconnected', {
      detail: { reason }
    }));
  }
  
  /**
   * Handle connection errors
   */
  function handleConnectionError(error) {
    console.error('Socket connection error:', error);
    
    if (isConnecting) {
      // Try alternative transport if available
      if (currentTransportIndex < transportFallbacks.length - 1) {
        currentTransportIndex++;
        console.log(`Trying alternative transport (attempt ${currentTransportIndex})`);
        initializeSocket();
      } else {
        // Reset transport index and attempt normal reconnect
        currentTransportIndex = 0;
        attemptReconnect();
      }
    } else {
      // If error occurs after connection was established
      attemptReconnect();
    }
  }
  
  /**
   * Attempt socket reconnection with backoff
   */
  function attemptReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      updateConnectionStatus('failed');
      
      // Notify user that max reconnection attempts were reached
      showReconnectionFailed();
      return;
    }
    
    // Calculate backoff delay (exponential with jitter)
    const delay = reconnectDelay * Math.pow(1.5, reconnectAttempts) * (0.9 + Math.random() * 0.2);
    
    reconnectAttempts++;
    updateConnectionStatus('reconnecting');
    
    console.log(`Attempting reconnection in ${Math.round(delay)}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
    
    reconnectTimer = setTimeout(() => {
      initializeSocket();
    }, delay);
  }
  
  /**
   * Register an event listener that persists through reconnections
   */
  function on(event, callback) {
    if (!eventCallbacks[event]) {
      eventCallbacks[event] = [];
    }
    
    // Store callback for reconnection
    eventCallbacks[event].push(callback);
    
    // Add listener to current socket if it exists
    if (window.socket) {
      window.socket.on(event, callback);
    }
  }
  
  /**
   * Remove a persistent event listener
   */
  function off(event, callback) {
    if (!eventCallbacks[event]) return;
    
    // Remove from our callback store
    eventCallbacks[event] = eventCallbacks[event].filter(cb => cb !== callback);
    
    // Remove from current socket if it exists
    if (window.socket) {
      window.socket.off(event, callback);
    }
  }
  
  /**
   * Emit an event safely
   */
  function emit(event, data) {
    if (window.socket && window.socket.connected) {
      window.socket.emit(event, data);
      return true;
    }
    return false;
  }
  
  /**
   * Update connection status in UI
   */
  function updateConnectionStatus(status) {
    connectionStatus = status;
    
    // Update UI connection indicator
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      statusEl.className = `connection-status ${status}`;
      
      // Set appropriate status text
      const statusTexts = {
        connecting: 'Connecting...',
        connected: 'Connected',
        disconnected: 'Disconnected',
        reconnecting: 'Reconnecting...',
        failed: 'Connection Failed'
      };
      
      statusEl.textContent = statusTexts[status] || 'Unknown';
    }
    
    // Dispatch status change event
    document.dispatchEvent(new CustomEvent('socket-status-changed', {
      detail: { status }
    }));
  }
  
  /**
   * Display reconnection failure message to user
   */
  function showReconnectionFailed() {
    // Show toast notification if available
    if (window.showToast) {
      window.showToast('Unable to connect to server. Please refresh the page.', 'error', 0);
    } else {
      // Fallback to alert
      const reconnectButton = document.getElementById('reconnect-button');
      if (reconnectButton) {
        reconnectButton.style.display = 'block';
      } else {
        // Create reconnect button if it doesn't exist
        const button = document.createElement('button');
        button.id = 'reconnect-button';
        button.className = 'reconnect-button';
        button.textContent = 'Reconnect';
        button.addEventListener('click', () => {
          reconnectAttempts = 0;
          initializeSocket();
          button.style.display = 'none';
        });
        
        // Insert at top of page
        document.body.insertBefore(button, document.body.firstChild);
      }
    }
  }
  
  // Public API
  return {
    init: initializeSocket,
    on,
    off,
    emit,
    getStatus: () => connectionStatus,
    reconnect: function() {
      reconnectAttempts = 0;
      initializeSocket();
    }
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.socketHandler.init);