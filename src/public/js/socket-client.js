// Socket client that uses a service worker for persistent connections

// Event listeners for socket events
const eventListeners = {};
let serviceWorkerReady = false;
let messageQueue = [];
let socketConnected = false;

// Socket.io singleton implementation
const socketManager = (() => {
  let socket = null;
  
  return {
    getSocket: (namespace = '') => {
      if (!socket) {
        // Create the socket with options
        socket = io(namespace, {
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
          timeout: 10000,
          // Add any other options you need
        });
        
        // Set up default event listeners
        socket.on('connect', () => {
          console.log('Socket connected');
          socketConnected = true;
          
          // Process any queued messages
          while (messageQueue.length > 0) {
            const msg = messageQueue.shift();
            socket.emit(msg.event, ...msg.args);
          }
          
          // Dispatch connect event to registered listeners
          if (eventListeners['connect']) {
            eventListeners['connect'].forEach(callback => callback());
          }
        });
        
        socket.on('disconnect', () => {
          console.log('Socket disconnected');
          socketConnected = false;
          
          // Dispatch disconnect event to registered listeners
          if (eventListeners['disconnect']) {
            eventListeners['disconnect'].forEach(callback => callback());
          }
        });
        
        socket.on('error', (errorData) => {
          console.error('Socket error:', errorData);
          handleSocketError(errorData);
        });
      }
      return socket;
    },
    
    disconnect: () => {
      if (socket) {
        socket.disconnect();
        socket = null;
        socketConnected = false;
      }
    }
  };
})();

// Export the socket getter
export const getSocket = socketManager.getSocket;

// Initialize socket connection
function initializeSocket() {
  // Check if service workers are supported
  if ('serviceWorker' in navigator) {
    // Try to register service worker
    navigator.serviceWorker.register('/socket-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
        serviceWorkerReady = true;
        setupSocketWithServiceWorker();
      })
      .catch(error => {
        console.error('ServiceWorker registration failed: ', error);
        // Fall back to direct socket connection
        setupDirectSocketConnection();
      });
  } else {
    console.log('Service Workers not supported in this browser. Using fallback connection...');
    // Fall back to direct socket connection
    setupDirectSocketConnection();
  }
}

function setupSocketWithServiceWorker() {
  // Setup messaging with service worker
  navigator.serviceWorker.addEventListener('message', event => {
    // Handle messages from service worker
    if (event.data.type === 'SOCKET_EVENT') {
      const socketEvent = event.data.event;
      const socketData = event.data.data;
      
      // Notify listeners of this event
      if (eventListeners[socketEvent]) {
        eventListeners[socketEvent].forEach(callback => callback(socketData));
      }
    }
  });
  
  // Tell the service worker the client is ready
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CLIENT_READY'
    });
  }
  
  // Let the server know we're using service worker connection
  sendConnectionInfo('service-worker');
}

function setupDirectSocketConnection() {
  const socket = getSocket();
  
  // Setup all your socket event handlers here
  socket.on('connect', () => {
    console.log('Connected directly to server');
  });
  
  socket.on('error', (errorData) => {
    console.error('Socket error:', errorData);
    handleSocketError(errorData);
  });
  
  // Add all other event handlers
  setupSocketEventHandlers(socket);
  
  // Store the socket for global access
  window.appSocket = socket;
  return socket;
}

function sendConnectionInfo(type) {
  if (window.appSocket) {
    window.appSocket.emit('connection_info', { type });
  } else {
    // Queue this information to be sent once socket is available
    window.pendingConnectionInfo = type;
  }
}

function setupSocketEventHandlers(socket) {
  // Add all your event handlers here
  socket.on('ai response', (data) => {
    // Handle AI response
    console.log('Received AI response:', data);
    // Update UI or process response
  });
  
  socket.on('chat message', (message) => {
    // Handle chat messages
    console.log('Received chat message:', message);
    // Update UI with new message
  });
  
  // Add other event handlers as needed
}

// Function to handle socket errors consistently in both approaches
function handleSocketError(errorData) {
  // Display error to user
  if (errorData.reconnect) {
    // Show reconnection message
    showNotification('Connection issue. Reconnecting...', 'warning');
    
    // Automatic reconnection logic
    setTimeout(() => {
      if (!socketConnected) {
        const socket = getSocket();
        socket.connect();
      }
    }, 5000);
  } else {
    // Show error message
    showNotification(`Error: ${errorData.error}`, 'error');
    console.error('Socket error details:', errorData.details || 'No details provided');
  }
}

// Helper function to get BambiName from cookies
function getBambiNameFromCookies() {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; bambiname=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

// Helper function to show notifications
function showNotification(message, type = 'info') {
  // Check if the notification area exists
  let notificationArea = document.querySelector('.notification-area');
  
  // Create one if it doesn't exist
  if (!notificationArea) {
    notificationArea = document.createElement('div');
    notificationArea.className = 'notification-area';
    document.body.appendChild(notificationArea);
  }
  
  // Create and show notification
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  notificationArea.appendChild(notification);
  
  // Auto-remove after delay
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// Function to send a message to the server
function sendMessage(event, ...args) {
  const socket = getSocket();
  if (socketConnected) {
    socket.emit(event, ...args);
  } else {
    console.warn('Socket not connected. Queueing message for later.');
    messageQueue.push({ event, args });
  }
}

// Function to send a chat message
function sendChatMessage(message) {
  const bambiname = getBambiNameFromCookies() || 'Anonymous';
  sendMessage('chat message', { data: message, username: bambiname });
}

// Function to send a collar message
function sendCollarMessage(message) {
  sendMessage('collar', { data: message });
}

// Function to add event listener
function on(event, callback) {
  if (!eventListeners[event]) {
    eventListeners[event] = [];
  }
  eventListeners[event].push(callback);
}

// Function to remove event listener
function off(event, callback) {
  if (eventListeners[event]) {
    const index = eventListeners[event].indexOf(callback);
    if (index !== -1) {
      eventListeners[event].splice(index, 1);
    }
  }
}

// Function to check if socket is connected
function isConnected() {
  return socketConnected;
}

// Update bambiname in the service worker when it changes
function updateBambiName(bambiname) {
  sendMessage('update_bambiname', { bambiname });
}

// Export public API
window.BambiSocket = {
  initialize: initializeSocket,
  sendMessage,
  sendChatMessage,
  sendCollarMessage,
  on,
  off,
  isConnected,
  updateBambiName,
  getBambiNameFromCookies,
  getSocket
};

// Initialize automatically when the script loads
document.addEventListener('DOMContentLoaded', initializeSocket);

// Re-initialize when page visibility changes (helps with page refresh)
document.addEventListener('visibilitychange', function() {
  if (!document.hidden && !socketConnected) {
    initializeSocket();
  }
});

// Export socket for direct use if needed
export const socket = getSocket();