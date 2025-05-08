/**
 * Socket connection handler for BambiSleep Chat
 * Manages socket lifecycle, reconnection attempts, and connection state
 */
window.socketHandler = (function() {
  // Private variables
  let socket = null;
  let reconnectAttempts = 0;
  let maxReconnectAttempts = 5;
  let reconnectTimer = null;
  let connectionState = 'disconnected';
  let pendingEmits = [];
  
  // Initialize module
  function init() {
    try {
      connect();
      setupConnectionStateListeners();
      
      // Show initial connection state
      updateConnectionStatus('connecting');
      
      console.log('Socket handler initialized');
    } catch (error) {
      console.error('Socket handler init error:', error);
    }
  }
  
  // Connect to the socket server
  function connect() {
    try {
      if (socket && socket.connected) return;
      
      connectionState = 'connecting';
      socket = io({
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: maxReconnectAttempts
      });
      
      window.socket = socket; // Make socket globally available
    } catch (error) {
      console.error('Socket connect error:', error);
      updateConnectionStatus('error');
    }
  }
  
  // Set up socket connection state listeners
  function setupConnectionStateListeners() {
    if (!socket) return;
    
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      reconnectAttempts = 0;
      connectionState = 'connected';
      updateConnectionStatus('connected');
      
      // Process any pending emits
      processPendingEmits();
    });
    
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      connectionState = 'disconnected';
      updateConnectionStatus('disconnected');
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      connectionState = 'error';
      updateConnectionStatus('error');
      
      // Handle reconnection
      handleReconnection();
    });
  }
  
  // Try to reconnect to the server
  function handleReconnection() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    
    reconnectAttempts++;
    
    if (reconnectAttempts <= maxReconnectAttempts) {
      updateConnectionStatus('reconnecting');
      
      reconnectTimer = setTimeout(() => {
        console.log(`Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
        connect();
      }, 2000 * reconnectAttempts); // Exponential backoff
    } else {
      updateConnectionStatus('failed');
      console.error('Max reconnection attempts reached');
    }
  }
  
  // Update connection status UI
  function updateConnectionStatus(status) {
    try {
      const statusIndicator = document.getElementById('connection-status');
      if (!statusIndicator) return;
      
      // Remove all existing status classes
      statusIndicator.classList.remove(
        'status-connected', 
        'status-disconnected', 
        'status-connecting', 
        'status-error',
        'status-reconnecting',
        'status-failed'
      );
      
      // Add current status class
      statusIndicator.classList.add(`status-${status}`);
      
      // Update tooltip text
      let statusText = 'Disconnected';
      switch (status) {
        case 'connected': statusText = 'Connected'; break;
        case 'connecting': statusText = 'Connecting...'; break;
        case 'reconnecting': statusText = 'Reconnecting...'; break;
        case 'error': statusText = 'Connection Error'; break;
        case 'failed': statusText = 'Connection Failed'; break;
      }
      
      statusIndicator.setAttribute('title', statusText);
      
      // Update UI elements that depend on connection
      document.querySelectorAll('[data-requires-connection]').forEach(el => {
        el.disabled = status !== 'connected';
      });
      
    } catch (error) {
      console.error('Error updating connection status UI:', error);
    }
  }
  
  // Safe way to emit socket events
  function emit(eventName, data) {
    if (!eventName) return false;
    
    try {
      // If connected, emit immediately
      if (socket && socket.connected) {
        socket.emit(eventName, data);
        return true;
      } 
      
      // Otherwise queue for later
      pendingEmits.push({ eventName, data });
      
      // If disconnected, try to reconnect
      if (connectionState === 'disconnected') {
        handleReconnection();
      }
      
      return false;
    } catch (error) {
      console.error(`Error emitting ${eventName}:`, error);
      return false;
    }
  }
  
  // Process any pending emits when reconnected
  function processPendingEmits() {
    if (pendingEmits.length === 0) return;
    
    console.log(`Processing ${pendingEmits.length} pending socket emits`);
    
    pendingEmits.forEach(item => {
      socket.emit(item.eventName, item.data);
    });
    
    pendingEmits = [];
  }
  
  // Clean up resources
  function tearDown() {
    try {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      
      if (socket) {
        socket.disconnect();
      }
    } catch (error) {
      console.error('Error in socket handler teardown:', error);
    }
  }
  
  // Public API
  return {
    init,
    emit,
    getConnectionState: () => connectionState,
    getSocket: () => socket,
    reconnect: handleReconnection,
    tearDown
  };
})();

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  window.socketHandler.init();
});