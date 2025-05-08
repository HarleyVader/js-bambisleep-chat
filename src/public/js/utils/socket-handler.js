window.socketHandler = (function() {
  let socket = null;
  let connectionAttempts = 0;
  const MAX_ATTEMPTS = 3;
  const TRANSPORT_OPTIONS = ['websocket', 'polling'];
  let currentTransportIndex = 0;
  let reconnectTimeout = null;
  
  function init() {
    try {
      console.log('Initializing socket connection...');
      
      // Try to connect with the primary transport option
      connectWithTransport(TRANSPORT_OPTIONS[currentTransportIndex]);
      
      // Set up the global connection status indicator
      setupConnectionIndicator();
    } catch (error) {
      console.error('Socket initialization error:', error);
      fallbackToAlternativeTransport();
    }
  }
  
  function connectWithTransport(transport) {
    if (socket) {
      // Clean up existing socket if any
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
    }
    
    // Initialize the socket with specified transport
    socket = io({
      transports: [transport],
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 5000
    });
    
    // Store in window for global access
    window.socket = socket;
    
    // Set up core socket event handlers
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectionError);
    
    return socket;
  }
  
  function handleConnect() {
    console.log('Socket connected successfully');
    connectionAttempts = 0;
    currentTransportIndex = 0; // Reset to preferred transport for next connection
    
    // Update connection indicator
    const indicator = document.getElementById('connection-status');
    if (indicator) {
      indicator.classList.remove('disconnected');
      indicator.classList.add('connected');
      indicator.title = 'Connected';
    }
    
    // Notify system that connection is established
    document.dispatchEvent(new CustomEvent('socket-connected'));
  }
  
  function handleDisconnect(reason) {
    console.log('Socket disconnected:', reason);
    
    // Update connection indicator
    const indicator = document.getElementById('connection-status');
    if (indicator) {
      indicator.classList.remove('connected');
      indicator.classList.add('disconnected');
      indicator.title = 'Disconnected: ' + reason;
    }
    
    // Disable features that require connection
    document.querySelectorAll('.requires-connection').forEach(el => {
      el.disabled = true;
    });
    
    // Notify system that connection is lost
    document.dispatchEvent(new CustomEvent('socket-disconnected', {
      detail: { reason }
    }));
  }
  
  function handleConnectionError(error) {
    console.error('Socket connection error:', error);
    
    if (connectionAttempts < MAX_ATTEMPTS) {
      fallbackToAlternativeTransport();
    } else {
      // Show user-friendly error message after all attempts failed
      showConnectionErrorMessage();
    }
  }
  
  function fallbackToAlternativeTransport() {
    connectionAttempts++;
    
    // Clear any existing reconnect timeout
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    
    // Try the next transport option
    currentTransportIndex = (currentTransportIndex + 1) % TRANSPORT_OPTIONS.length;
    const nextTransport = TRANSPORT_OPTIONS[currentTransportIndex];
    
    console.log(`Trying alternative transport (attempt ${connectionAttempts})`);
    
    // Add a small delay before trying again
    reconnectTimeout = setTimeout(() => {
      connectWithTransport(nextTransport);
    }, 1000);
  }
  
  function setupConnectionIndicator() {
    // Create connection indicator if it doesn't exist
    if (!document.getElementById('connection-status')) {
      const indicator = document.createElement('div');
      indicator.id = 'connection-status';
      indicator.className = 'connection-indicator disconnected';
      indicator.title = 'Disconnected';
      
      // Add to the top navigation bar if it exists
      const navbar = document.querySelector('.navbar') || document.body;
      navbar.appendChild(indicator);
      
      // Add click handler to manually retry connection
      indicator.addEventListener('click', () => {
        if (indicator.classList.contains('disconnected')) {
          connectionAttempts = 0;
          init();
        }
      });
    }
  }
  
  function showConnectionErrorMessage() {
    const message = document.createElement('div');
    message.className = 'connection-error-message';
    message.innerHTML = `
      <h3>Connection Error</h3>
      <p>Unable to connect to the server. Please check your internet connection and try again.</p>
      <button id="retry-connection">Retry Connection</button>
    `;
    
    document.body.appendChild(message);
    
    // Set up retry button
    document.getElementById('retry-connection').addEventListener('click', () => {
      connectionAttempts = 0;
      message.remove();
      init();
    });
  }
  
  // Public API
  return {
    init,
    getSocket: () => socket,
    isConnected: () => socket && socket.connected
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.socketHandler.init);

/* Socket connection indicator styles */
.connection-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin: 0 10px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.connection-indicator.connected {
  background-color: #4CAF50;
  box-shadow: 0 0 5px rgba(76, 175, 80, 0.6);
}

.connection-indicator.disconnected {
  background-color: #F44336;
  box-shadow: 0 0 5px rgba(244, 67, 54, 0.6);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.connection-error-message {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  z-index: 1000;
}

.connection-error-message button {
  background-color: #8200ad;
  color: white;
  border: none;
  padding: 8px 16px;
  margin-top: 10px;
  border-radius: 4px;
  cursor: pointer;
}

.connection-error-message button:hover {
  background-color: #a100d6;
}