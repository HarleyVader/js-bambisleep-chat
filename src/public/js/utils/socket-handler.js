window.socketHandler = (function() {
  // Private variables
  let socket = null;
  let reconnectAttempts = 0;
  let maxReconnectAttempts = 5;
  let reconnectDelay = 2000;
  let transportOptions = ['websocket', 'polling'];
  let currentTransportIndex = 0;
  let connectionListeners = [];
  let disconnectionListeners = [];
  
  // Initialize with connection options
  function init() {
    try {
      console.log('Initializing socket connection...');
      
      // Get server URL from window location
      const serverUrl = window.location.origin;
      
      // Socket.io connection options with fallback transports
      const options = {
        transports: [transportOptions[currentTransportIndex]],
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: reconnectDelay,
        timeout: 10000,
        upgrade: true
      };
      
      // Create socket connection
      socket = io(serverUrl, options);
      
      // Set up event handlers
      setupEventHandlers();
      
      return true;
    } catch (error) {
      console.error('Error initializing socket:', error);
      return false;
    }
  }
  
  // Set up socket event handlers
  function setupEventHandlers() {
    if (!socket) return;
    
    // Handle successful connection
    socket.on('connect', () => {
      console.log('Socket connected successfully');
      reconnectAttempts = 0;
      
      // Notify all connection listeners
      connectionListeners.forEach(listener => {
        try {
          listener(socket);
        } catch (error) {
          console.error('Error in connection listener:', error);
        }
      });
    });
    
    // Handle connection error
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      
      // Try alternative transport if first one fails
      if (reconnectAttempts < 3 && transportOptions.length > 1) {
        currentTransportIndex = (currentTransportIndex + 1) % transportOptions.length;
        console.log(`Trying alternative transport (attempt ${reconnectAttempts + 1})`);
        
        // Update socket options with new transport
        socket.io.opts.transports = [transportOptions[currentTransportIndex]];
      }
      
      // Manual reconnection logic if needed
      if (reconnectAttempts >= 3) {
        performManualReconnect();
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      
      // Notify all disconnection listeners
      disconnectionListeners.forEach(listener => {
        try {
          listener(reason);
        } catch (error) {
          console.error('Error in disconnection listener:', error);
        }
      });
      
      // Try to reconnect if disconnected unexpectedly
      if (reason === 'io server disconnect' || reason === 'transport close') {
        performManualReconnect();
      }
    });
    
    // Handle reconnect attempts
    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Socket reconnect attempt ${attemptNumber}/${socket.io.opts.reconnectionAttempts}`);
    });
    
    // Handle successful reconnection
    socket.on('reconnect', (attemptNumber) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`);
    });
    
    // Handle reconnection errors
    socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
    });
    
    // Handle reconnection failure
    socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed, no more attempts');
      showConnectionError();
    });
  }
  
  // Manual reconnection attempt when automatic reconnects aren't working
  function performManualReconnect() {
    reconnectAttempts++;
    
    if (reconnectAttempts <= maxReconnectAttempts) {
      console.log(`Manual reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
      
      // Try to clean up existing connection
      if (socket) {
        try {
          socket.disconnect();
          socket = null;
        } catch (error) {
          console.warn('Error disconnecting socket:', error);
        }
      }
      
      // Wait and try to connect again with modified options
      setTimeout(() => {
        // Alternate between transport options
        currentTransportIndex = (currentTransportIndex + 1) % transportOptions.length;
        
        // Create new connection with current transport
        const serverUrl = window.location.origin;
        const options = {
          transports: [transportOptions[currentTransportIndex]],
          reconnection: true,
          reconnectionAttempts: maxReconnectAttempts - reconnectAttempts,
          reconnectionDelay: reconnectDelay * Math.min(reconnectAttempts, 3),
          timeout: 15000,
          upgrade: true,
          forceNew: true
        };
        
        try {
          socket = io(serverUrl, options);
          setupEventHandlers();
        } catch (error) {
          console.error('Error creating new socket connection:', error);
          
          // Try again after delay
          setTimeout(performManualReconnect, reconnectDelay);
        }
      }, reconnectDelay);
    } else {
      console.error('Maximum reconnection attempts reached');
      showConnectionError();
    }
  }
  
  // Show connection error message to user
  function showConnectionError() {
    // Check if notification element exists already
    let notification = document.getElementById('connection-error');
    
    if (!notification) {
      // Create error notification element
      notification = document.createElement('div');
      notification.id = 'connection-error';
      notification.className = 'connection-error';
      notification.innerHTML = `
        <div class="connection-error-content">
          <h3>Connection Lost</h3>
          <p>Unable to connect to the server. Please check your internet connection and try refreshing the page.</p>
          <button class="retry-button">Retry Connection</button>
        </div>
      `;
      
      // Add retry button handler
      notification.querySelector('.retry-button').addEventListener('click', () => {
        // Reset connection attempts
        reconnectAttempts = 0;
        
        // Try to connect again
        notification.classList.add('connecting');
        notification.querySelector('.connection-error-content').innerHTML = 'Reconnecting...';
        
        // Perform connection attempt
        performManualReconnect();
        
        // Remove notification after timeout if still trying
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 5000);
      });
      
      // Add to document
      document.body.appendChild(notification);
    }
  }
  
  // Add connection event listener
  function onConnect(callback) {
    if (typeof callback === 'function') {
      connectionListeners.push(callback);
      
      // If already connected, call immediately
      if (socket && socket.connected) {
        callback(socket);
      }
    }
  }
  
  // Add disconnection event listener
  function onDisconnect(callback) {
    if (typeof callback === 'function') {
      disconnectionListeners.push(callback);
    }
  }
  
  // Check if socket is connected
  function isConnected() {
    return socket && socket.connected;
  }
  
  // Clean up resources
  function cleanup() {
    try {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      
      connectionListeners = [];
      disconnectionListeners = [];
    } catch (error) {
      console.error('Error in socket cleanup:', error);
    }
  }
  
  // Public API
  return {
    init,
    onConnect,
    onDisconnect,
    isConnected,
    cleanup,
    getSocket: () => socket
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.socketHandler.init);