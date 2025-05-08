/**
 * Client-side socket connection and event handler
 * Provides centralized connection management and error recovery
 */
window.socketHandler = (function() {
  // Private variables
  let socket = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  let reconnectTimer = null;
  
  // Initialize socket connection
  function connect() {
    if (socket && socket.connected) return; // Already connected
    
    try {
      socket = io({
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
        timeout: 20000
      });
      
      setupEventListeners();
      
      // Export for global use
      window.socket = socket;
    } catch (error) {
      console.error('Socket connection error:', error);
      attemptReconnect();
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
  
  // Clean up event listeners to prevent memory leaks
  function cleanupEventListeners() {
    if (!socket) return;
    
    socket.off('connect', handleConnect);
    socket.off('disconnect', handleDisconnect);
    socket.off('connect_error', handleConnectionError);
    socket.off('error', handleError);
    socket.off('system-update-success');
  }
  
  // Handle successful connection
  function handleConnect() {
    console.log('Socket connected:', socket.id);
    document.body.classList.add('socket-connected');
    document.body.classList.remove('socket-disconnected');
    
    // Reset reconnection attempts
    reconnectAttempts = 0;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    // Send username if available
    const username = getUsername();
    if (username) {
      socket.emit('set username', username);
    }
    
    // Notify other components
    document.dispatchEvent(new CustomEvent('socket-connected'));
  }
  
  // Handle disconnection
  function handleDisconnect(reason) {
    console.log('Socket disconnected:', reason);
    document.body.classList.remove('socket-connected');
    document.body.classList.add('socket-disconnected');
    
    // Notify other components
    document.dispatchEvent(new CustomEvent('socket-disconnected', { 
      detail: { reason } 
    }));
    
    // Attempt to reconnect if not already reconnecting
    if (!reconnectTimer && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      attemptReconnect();
    }
  }
  
  // Handle connection errors
  function handleConnectionError(error) {
    console.error('Socket connection error:', error);
    
    // Notify other components
    document.dispatchEvent(new CustomEvent('socket-error', { 
      detail: { error } 
    }));
    
    // Attempt to reconnect if not already reconnecting
    if (!reconnectTimer && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      attemptReconnect();
    }
  }
  
  // Handle general socket errors
  function handleError(error) {
    console.error('Socket error:', error);
    
    // Notify other components
    document.dispatchEvent(new CustomEvent('socket-error', { 
      detail: { error } 
    }));
  }
  
  // Attempt to reconnect
  function attemptReconnect() {
    reconnectAttempts++;
    console.log(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
    
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      
      if (socket) {
        cleanupEventListeners();
        socket.disconnect();
        socket = null;
      }
      
      connect();
    }, 3000);
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
  
  // Connect on page load
  document.addEventListener('DOMContentLoaded', () => {
    connect();
    
    // Join profile room after connection
    document.addEventListener('socket-connected', joinProfileRoom);
  });
  
  // Public API
  return {
    connect,
    disconnect: function() {
      if (socket) {
        cleanupEventListeners();
        socket.disconnect();
      }
    },
    getSocket: () => socket,
    isConnected: () => socket && socket.connected,
    sendSystemSettings,
    joinProfileRoom
  };
})();