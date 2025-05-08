window.socketHandler = (function() {
  // Private variables
  let socket = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  let isReconnecting = false;
  let reconnectTimer = null;
  let transportAttempts = 0;
  
  // Socket options with transport fallback strategy
  const socketOptions = {
    reconnection: true,
    reconnectionAttempts: maxReconnectAttempts,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    pingInterval: 25000,
    pingTimeout: 60000,
    transports: ['websocket', 'polling'] // Try WebSocket first, fallback to polling
  };
  
  /**
   * Initialize socket connection
   */
  function init() {
    try {
      if (socket) {
        console.log('Socket already initialized');
        return;
      }
      
      // Create socket with options
      socket = io(window.location.origin, socketOptions);
      
      // Store reference globally for backward compatibility
      window.socket = socket;
      
      // Set up event handlers
      setupEventHandlers();
      
      console.log('Socket handler initialized');
    } catch (error) {
      console.error('Socket initialization error:', error);
      showConnectionError('Failed to initialize socket connection. Retrying...');
      setTimeout(tryReconnect, 2000);
    }
  }
  
  /**
   * Set up socket event handlers
   */
  function setupEventHandlers() {
    // Connection successful
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      hideConnectionError();
      reconnectAttempts = 0;
      transportAttempts = 0;
      isReconnecting = false;
      
      // Send username if available
      const username = getCookieValue('bambiname');
      if (username) {
        socket.emit('set username', username);
      }
      
      // Dispatch connection event for other modules
      document.dispatchEvent(new CustomEvent('socket:connected', {
        detail: { socketId: socket.id }
      }));
    });
    
    // Connection error
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      
      // Try alternative transport if WebSocket fails
      if (transportAttempts < 2) {
        transportAttempts++;
        console.log(`Trying alternative transport (attempt ${transportAttempts})`);
        
        // Force polling as fallback
        if (socketOptions.transports[0] === 'websocket') {
          socketOptions.transports = ['polling', 'websocket'];
          
          // Recreate socket with new transport options
          if (socket) {
            socket.disconnect();
          }
          
          setTimeout(() => {
            socket = io(window.location.origin, socketOptions);
            window.socket = socket;
            setupEventHandlers();
          }, 1000);
          
          return;
        }
      }
      
      handleConnectionIssue();
    });
    
    // Disconnection
    socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
      
      // Dispatch disconnect event
      document.dispatchEvent(new CustomEvent('socket:disconnected', {
        detail: { reason }
      }));
      
      if (reason === 'io server disconnect') {
        // Server disconnected us, try reconnecting manually
        tryReconnect();
      } else if (reason === 'transport close' || reason === 'ping timeout') {
        // Connection lost, show error if not reconnecting automatically
        if (!socket.connected && !isReconnecting) {
          showConnectionError();
        }
      }
    });
    
    // Reconnect attempt
    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Socket reconnect attempt ${attemptNumber}/${maxReconnectAttempts}`);
      isReconnecting = true;
      
      // Update UI to show reconnect attempt
      const errorBar = document.querySelector('.connection-error');
      if (errorBar) {
        errorBar.innerHTML = `Connection lost. Reconnecting (${attemptNumber}/${maxReconnectAttempts})...`;
        errorBar.style.display = 'block';
      }
    });
    
    // Reconnect failed
    socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed after maximum attempts');
      isReconnecting = false;
      showConnectionError('Reconnection failed. Please refresh the page.');
    });
    
    // Reconnected successfully
    socket.on('reconnect', (attemptNumber) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`);
      hideConnectionError();
      
      // Dispatch reconnection event
      document.dispatchEvent(new CustomEvent('socket:reconnected', {
        detail: { attempts: attemptNumber }
      }));
    });
  }
  
  /**
   * Handle connection issues
   */
  function handleConnectionIssue() {
    if (reconnectAttempts >= maxReconnectAttempts) {
      showConnectionError('Connection to server failed. Please refresh the page.');
      return;
    }
    
    // Show reconnecting message
    showConnectionError('Connecting to server...');
    
    // Try to reconnect manually if socket.io reconnection isn't working
    if (!isReconnecting) {
      tryReconnect();
    }
  }
  
  /**
   * Try to reconnect manually
   */
  function tryReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    
    reconnectAttempts++;
    isReconnecting = true;
    
    reconnectTimer = setTimeout(() => {
      console.log(`Manual reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
      
      if (socket) {
        // Clean up old socket
        socket.removeAllListeners();
        socket.disconnect();
      }
      
      // Create new socket
      socket = io(window.location.origin, socketOptions);
      window.socket = socket;
      setupEventHandlers();
      
      if (reconnectAttempts < maxReconnectAttempts) {
        // Update UI
        const errorBar = document.querySelector('.connection-error');
        if (errorBar) {
          errorBar.innerHTML = `Connection lost. Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})...`;
        }
      } else {
        isReconnecting = false;
        showConnectionError('Reconnection failed. Please refresh the page.');
      }
    }, 1000 * reconnectAttempts); // Increasing delay between attempts
  }
  
  /**
   * Show connection error message
   */
  function showConnectionError(message = 'Connection to server lost. Reconnecting...') {
    // Check if error bar already exists
    let errorBar = document.querySelector('.connection-error');
    
    if (!errorBar) {
      // Create error bar
      errorBar = document.createElement('div');
      errorBar.className = 'connection-error';
      errorBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background-color: rgba(255, 0, 0, 0.7);
        color: white;
        text-align: center;
        padding: 10px;
        z-index: 9999;
        font-weight: bold;
      `;
      document.body.appendChild(errorBar);
    }
    
    errorBar.innerHTML = message;
    errorBar.style.display = 'block';
    
    // Disable interactive elements
    document.querySelectorAll('button, input, textarea').forEach(el => {
      if (!el.hasAttribute('data-original-disabled')) {
        el.setAttribute('data-original-disabled', el.disabled);
        el.disabled = true;
      }
    });
  }
  
  /**
   * Hide connection error message
   */
  function hideConnectionError() {
    const errorBar = document.querySelector('.connection-error');
    if (errorBar) {
      errorBar.style.display = 'none';
    }
    
    // Re-enable interactive elements
    document.querySelectorAll('[data-original-disabled]').forEach(el => {
      const wasDisabled = el.getAttribute('data-original-disabled') === 'true';
      el.disabled = wasDisabled;
      el.removeAttribute('data-original-disabled');
    });
  }
  
  /**
   * Get cookie value by name
   */
  function getCookieValue(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
  }
  
  /**
   * Check if socket is connected
   */
  function isConnected() {
    return socket && socket.connected;
  }
  
  /**
   * Get socket instance
   */
  function getSocket() {
    return socket;
  }
  
  // Initialize on page load
  document.addEventListener('DOMContentLoaded', init);
  
  // Public API
  return {
    init,
    isConnected,
    getSocket,
    reconnect: tryReconnect
  };
})();