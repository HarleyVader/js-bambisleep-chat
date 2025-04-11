/**
 * BambiSleep Core Module
 * Contains socket handling, authentication and core utilities
 */

// ------------------------
// Socket Client Management
// ------------------------
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
  const socket = socketManager.getSocket(); // Fix: use socketManager.getSocket() instead of getSocket()
  
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
    console.log('Received AI response:', data);
  });
  
  socket.on('chat message', (message) => {
    console.log('Received chat message:', message);
  });
  
  socket.on('profile-updated', (data) => {
    console.log('Profile updated:', data);
    // Refresh the page if current profile was updated
    const currentProfile = document.querySelector('.current-profile');
    if (currentProfile && currentProfile.dataset.username === data.username) {
      window.location.reload();
    }
  });
}

function handleSocketError(errorData) {
  // Display error to user
  if (errorData.reconnect) {
    // Show reconnection message
    showNotification('Connection issue. Reconnecting...', 'warning');
    
    // Automatic reconnection logic
    setTimeout(() => {
      if (!socketConnected) {
        const socket = socketManager.getSocket(); // Fix: use socketManager.getSocket()
        socket.connect();
      }
    }, 5000);
  } else {
    // Show error message
    showNotification(`Error: ${errorData.error}`, 'error');
    console.error('Socket error details:', errorData.details || 'No details provided');
  }
}

// ------------------------
// Utility Functions
// ------------------------

// Convert socket.emit to Promise
function emitSocketPromise(event, data) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Socket request timed out'));
    }, 5000);
    
    const socket = socketManager.getSocket(); // Fix: use socketManager.getSocket()
    socket.emit(event, data, (response) => {
      clearTimeout(timeout);
      if (response && response.success) {
        resolve(response);
      } else {
        reject(new Error(response?.message || 'Socket request failed'));
      }
    });
  });
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
  const socket = socketManager.getSocket(); // Fix: use socketManager.getSocket()
  if (socketConnected) {
    socket.emit(event, ...args);
  } else {
    console.warn('Socket not connected. Queueing message for later.');
    messageQueue.push({ event, args });
  }
}

// Function to send a chat message
function sendChatMessage(message) {
  const bambiname = getBambiNameFromCookies() || 'AnonBambi';
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

/**
 * Converts URLs in text to clickable links
 * @param {string} text - The text to process
 * @returns {string} HTML with clickable links
 */
function makeLinksClickable(text) {
  if (!text) return '';
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

// ------------------------
// Authentication Handling
// ------------------------
function checkAuth() {
  // Check if we're on a protected page that requires BambiName
  const isProtectedRoute = 
    window.location.pathname.includes('/bambi/create') || 
    window.location.pathname.includes('/bambis/create') || 
    window.location.pathname.includes('/bambi/new') || 
    window.location.pathname.includes('/bambis/new') || 
    window.location.pathname.includes('/edit');
  
  if (isProtectedRoute) {
    // Get bambiname from cookies
    const bambiname = getBambiNameFromCookies();
    
    // If bambiname isn't set, redirect to home with a message to set it
    if (!bambiname) {
      window.location.href = '/?error=You must set a BambiName to access this feature';
    }
  }
}

// ------------------------
// Initialization
// ------------------------

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize socket
  initializeSocket();
  
  // Check authentication
  checkAuth();
  
  // Make utility functions globally available
  window.makeLinksClickable = makeLinksClickable;
  window.showNotification = showNotification; // Expose globally
});

// Re-initialize when page visibility changes (helps with page refresh)
document.addEventListener('visibilitychange', function() {
  if (!document.hidden && !socketConnected) {
    initializeSocket();
  }
});

// Replace the ES module exports with proper browser-compatible code
window.BambiSocket = {
    // Need to include these methods that are being used across files
    initialize: function() {
        // Initialize socket connection
        console.log('BambiSocket initialized');
        this.socket = socketManager.getSocket();
    },
    getSocket: socketManager.getSocket,
    sendMessage: function(event, data) {
        const socket = this.getSocket();
        if (socket) socket.emit(event, data);
    },
    on: function(event, callback) {
        const socket = this.getSocket();
        if (socket) socket.on(event, callback);
    },
    off: function(event, callback) {
        const socket = this.getSocket();
        if (socket) socket.off(event, callback);
    },
    isConnected: function() {
        return socketConnected;
    },
    updateBambiName: function(bambiname) {
        // Implement bambi name update functionality
        console.log('Updating bambi name to:', bambiname);
    },
    emitSocketPromise: emitSocketPromise
};