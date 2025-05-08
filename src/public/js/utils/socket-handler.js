/**
 * Socket connection handler for BambiSleep Chat
 * Manages socket lifecycle, reconnection attempts, and state synchronization
 */
window.socketHandler = (function() {
  // Private variables
  let socket = null;
  let reconnectAttempts = 0;
  let maxReconnectAttempts = 10;
  let isConnecting = false;
  let reconnectTimer = null;
  
  // Initialize module
  function init() {
    try {
      // Create socket connection if not already connected
      connect();
      
      // Handle page unload to sync session data
      window.addEventListener('beforeunload', handlePageUnload);
      
      console.log('Socket handler initialized');
    } catch (error) {
      console.error('Error initializing socket handler:', error);
    }
  }
  
  // Clean up event listeners when module is unloaded
  function tearDown() {
    try {
      window.removeEventListener('beforeunload', handlePageUnload);
      disconnect();
    } catch (error) {
      console.error('Error in socket handler teardown:', error);
    }
  }
  
  // Initialize socket connection
  function connect() {
    if (socket && socket.connected) return; // Already connected
    if (isConnecting) return; // Connection attempt in progress
    
    isConnecting = true;
    
    try {
      socket = io({
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: maxReconnectAttempts,
        timeout: 20000
      });
      
      setupEventListeners();
      
      // Export for global use
      window.socket = socket;
    } catch (error) {
      console.error('Socket connection error:', error);
      isConnecting = false;
      attemptReconnect();
    }
  }
  
  // Disconnect socket
  function disconnect() {
    if (socket) {
      // Clean up all listeners
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectionError);
      socket.off('error', handleError);
      socket.off('system-update-success');
      
      // Disconnect
      socket.disconnect();
      socket = null;
      window.socket = null;
    }
  }
  
  // Set up core event listeners
  function setupEventListeners() {
    if (!socket) return;
    
    // Basic connection events
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectionError);
    socket.on('error', handleError);
    
    // System events
    socket.on('system-update-success', () => {
      if (window.bambiSystem) {
        document.dispatchEvent(new CustomEvent('system-saved'));
      }
    });
  }
  
  // Handle socket connection
  function handleConnect() {
    console.log('Socket connected:', socket.id);
    isConnecting = false;
    reconnectAttempts = 0;
    
    // Clear any pending reconnect timers
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    // Send username if available
    const username = getUsername();
    if (username) {
      socket.emit('set username', username);
    }
    
    // Join profile room for updates
    joinProfileRoom();
    
    // Send system settings to worker if available
    sendSystemSettings();
    
    // Update UI to show connected state
    updateUIConnectionState(true);
    
    // Dispatch connection event for other modules
    document.dispatchEvent(new CustomEvent('socket-connected', {
      detail: { socketId: socket.id }
    }));
  }
  
  // Handle socket disconnection
  function handleDisconnect() {
    console.log('Socket disconnected');
    
    // Update UI to show disconnected state
    updateUIConnectionState(false);
    
    // Dispatch disconnection event for other modules
    document.dispatchEvent(new CustomEvent('socket-disconnected'));
    
    // Attempt to reconnect if not max attempts
    if (reconnectAttempts < maxReconnectAttempts) {
      attemptReconnect();
    }
  }
  
  // Handle connection errors
  function handleConnectionError(error) {
    console.error('Socket connection error:', error);
    isConnecting = false;
    
    // Update UI to show error state
    updateUIConnectionState(false, true);
    
    // Attempt to reconnect if not max attempts
    if (reconnectAttempts < maxReconnectAttempts) {
      attemptReconnect();
    }
  }
  
  // Handle general socket errors
  function handleError(error) {
    console.error('Socket error:', error);
  }
  
  // Handle page unload to sync session data
  function handlePageUnload() {
    try {
      if (socket && socket.connected) {
        // Sync session data before page unload
        socket.emit('sync-session-unload', {
          socketId: socket.id,
          username: getUsername(),
          reason: "pageUnload"
        });
      }
    } catch (error) {
      console.error('Error syncing session on page unload:', error);
    }
  }
  
  // Attempt to reconnect after delay
  function attemptReconnect() {
    if (isConnecting || (socket && socket.connected)) return;
    
    reconnectAttempts++;
    
    const delay = Math.min(1000 * reconnectAttempts, 5000);
    console.log(`Attempting reconnect ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms`);
    
    reconnectTimer = setTimeout(() => {
      if (!socket || !socket.connected) {
        connect();
      }
    }, delay);
  }
  
  // Update UI elements to reflect connection state
  function updateUIConnectionState(isConnected, isError = false) {
    try {
      // Add/remove connection status classes
      document.body.classList.toggle('socket-connected', isConnected);
      document.body.classList.toggle('socket-disconnected', !isConnected);
      document.body.classList.toggle('socket-error', isError);
      
      // Update any status indicators
      const statusIndicator = document.getElementById('connection-status');
      if (statusIndicator) {
        statusIndicator.className = isConnected ? 'connected' : (isError ? 'error' : 'disconnected');
        statusIndicator.title = isConnected ? 'Connected' : (isError ? 'Connection Error' : 'Disconnected');
      }
      
      // Disable interactive elements that require connection
      if (!isConnected) {
        document.querySelectorAll('.requires-connection').forEach(el => {
          el.disabled = true;
        });
      } else {
        document.querySelectorAll('.requires-connection').forEach(el => {
          el.disabled = false;
        });
      }
    } catch (error) {
      console.error('Error updating UI connection state:', error);
    }
  }
  
  // Get username from cookie utils or data attribute
  function getUsername() {
    // First try from window.cookieUtils
    if (window.cookieUtils && typeof window.cookieUtils.getBambiName === 'function') {
      return window.cookieUtils.getBambiName();
    }
    
    // Then try from data attribute
    const username = document.body.getAttribute('data-username');
    if (username) return username;
    
    // Finally try from window.username
    return window.username || 'anonBambi';
  }
  
  // Join profile room for updates
  function joinProfileRoom() {
    const username = getUsername();
    if (socket && socket.connected && username && username !== 'anonBambi') {
      socket.emit('join-profile', username);
    }
  }
  
  // Send system settings to worker
  function sendSystemSettings() {
    if (socket && socket.connected && window.bambiSystem) {
      const settings = window.bambiSystem.collectSettings();
      socket.emit('system-settings', settings);
    }
  }
  
  // Check if socket is connected
  function isConnected() {
    return socket && socket.connected;
  }
  
  // Get socket ID if connected
  function getSocketId() {
    return (socket && socket.connected) ? socket.id : null;
  }
  
  // Initialize on page load
  document.addEventListener('DOMContentLoaded', init);
  
  // Return public API
  return {
    init,
    tearDown,
    connect,
    disconnect,
    isConnected,
    getSocketId,
    sendSystemSettings
  };
})();