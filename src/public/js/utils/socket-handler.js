// Socket connection handler for BambiSleep Chat

window.socketHandler = (function () {
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
    // Log the specific error type and message for better debugging
    console.error('Socket connection error:', error?.name || 'Unknown', error?.message || '');

    // Special handling for WebSocket errors
    const isWebSocketError = error?.name === 'TransportError' && error?.message?.includes('websocket');

    if (isWebSocketError) {
      console.log('WebSocket transport error detected, falling back to polling');

      // Force immediate fallback to polling if this is a websocket error
      if (transportFallbacks.includes('polling')) {
        currentTransportIndex = transportFallbacks.indexOf('polling');
        console.log(`Switching directly to polling transport due to WebSocket error`);

        // Short delay before trying polling transport
        setTimeout(() => {
          initializeSocket();
        }, 100);
        return;
      }
    }

    if (isConnecting) {
      // Try alternative transport if available
      if (currentTransportIndex < transportFallbacks.length - 1) {
        currentTransportIndex++;
        const nextTransport = transportFallbacks[currentTransportIndex];
        console.log(`Trying alternative transport: ${nextTransport} (attempt ${currentTransportIndex + 1}/${transportFallbacks.length})`);

        // Short delay before trying next transport to avoid race conditions
        setTimeout(() => {
          initializeSocket();
        }, 100);
      } else {
        // Reset transport index and attempt normal reconnect
        currentTransportIndex = 0;
        console.log('All transport options exhausted, attempting standard reconnect');
        attemptReconnect();
      }
    } else {
      // If error occurs after connection was established
      console.log('Connection error after established connection, attempting reconnect');
      attemptReconnect();
    }

    // Dispatch error event with more detailed error information
    document.dispatchEvent(new CustomEvent('socket-error', {
      detail: {
        error: error?.message || 'Unknown connection error',
        errorType: error?.name || 'ConnectionError',
        transport: transportFallbacks[currentTransportIndex],
        fallbackAvailable: currentTransportIndex < transportFallbacks.length - 1,
        reconnectAttempt: reconnectAttempts,
        isWebSocketError: isWebSocketError
      }
    }));
  }

  /**
   * Show a connection failure message to the user
   */
  function showReconnectionFailed() {
    // Update UI to show connection failure
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      statusEl.textContent = 'Connection failed';
      statusEl.classList.add('connection-failed');
    }

    // Show a toast notification if available
    if (window.showToast) {
      window.showToast({
        message: 'Unable to connect to the server after multiple attempts. Please check your internet connection and try refreshing the page.',
        type: 'error',
        duration: 10000,
        actionText: 'Retry',
        actionCallback: () => {
          // Reset and try again
          reconnectAttempts = 0;
          currentTransportIndex = 0;
          initializeSocket();
        }
      });
    } else {
      // Fallback to alert if toast system isn't available
      const retry = confirm('Connection to server failed. Would you like to try again?');
      if (retry) {
        // Reset and try again
        reconnectAttempts = 0;
        currentTransportIndex = 0;
        initializeSocket();
      }
    }

    // Dispatch a custom event for reconnection failure
    document.dispatchEvent(new CustomEvent('socket-reconnection-failed'));
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
      statusEl.textContent = status;
    }

    // Show connection toast notification
    showConnectionToast(status);
  }

  /**
   * Show a toast notification for connection status
   */
  function showConnectionToast(status) {
    // Don't show toasts for normal connection events to avoid spam
    if (status === 'connected' && reconnectAttempts === 0) return;

    const messages = {
      'connected': `Connection ${reconnectAttempts > 0 ? 're-established' : 'established'} using ${transportFallbacks[currentTransportIndex]}`,
      'connecting': 'Connecting to server...',
      'reconnecting': `Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})...`,
      'disconnected': 'Disconnected from server',
      'failed': 'Connection failed after multiple attempts'
    };

    const message = messages[status] || 'Connection status changed';

    // Use toast system if available
    if (window.showToast) {
      window.showToast({
        message,
        type: status === 'connected' ? 'success' :
          status === 'failed' ? 'error' : 'info',
        duration: 3000
      });
    }
  }

  /**
   * Get diagnostic information about the socket connection
   * Useful for troubleshooting connection issues
   */
  function getDiagnosticInfo() {
    return {
      status: connectionStatus,
      currentTransport: transportFallbacks[currentTransportIndex],
      availableTransports: transportFallbacks,
      reconnectAttempts,
      maxReconnectAttempts,
      events: Object.keys(eventCallbacks).reduce((acc, event) => {
        acc[event] = eventCallbacks[event].length;
        return acc;
      }, {})
    };
  }

  // Add to the public API
  return {
    initializeSocket,
    on,
    off,
    emit,
    getDiagnosticInfo
  };
})();