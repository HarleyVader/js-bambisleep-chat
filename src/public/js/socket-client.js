// Socket client that uses a service worker for persistent connections

// Event listeners for socket events
const eventListeners = {};
let serviceWorkerReady = false;
let messageQueue = [];
let socketConnected = false;

// Initialize socket connection
function initializeSocket() {
  // Check if service workers are supported
  if ('serviceWorker' in navigator) {
    // Try to register service worker
    navigator.serviceWorker.register('/socket-worker.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
        // Continue with service worker-based socket connection
        setupSocketWithServiceWorker();
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
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
      handleSocketEvent(event.data.eventName, event.data.data);
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
  // Direct socket.io connection without service worker
  const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    withCredentials: true  // Add this line to ensure cookies are sent
  });
  
  // Setup all your socket event handlers here
  socket.on('connect', () => {
    console.log('Connected directly to server');
    // Let the server know we're using direct connection
    socket.emit('connection_info', { type: 'direct' });
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
      if (window.appSocket && !window.appSocket.connected) {
        window.location.reload();
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

// Function to send a message to the server
function sendMessage(event, ...args) {
  if (window.appSocket) {
    window.appSocket.emit(event, ...args);
  } else {
    console.warn('Socket not initialized. Message not sent.');
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
    eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
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
  getBambiNameFromCookies
};

// Initialize automatically when the script loads
document.addEventListener('DOMContentLoaded', initializeSocket);

// Re-initialize when page visibility changes (helps with page refresh)
document.addEventListener('visibilitychange', function() {
  if (!document.hidden && !socketConnected) {
    initializeSocket();
  }
});

// Example usage: sending a message
const element = document.getElementById('sendButton');
if (element) {
  element.addEventListener('click', () => {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value;
    sendMessage('message', message);
    messageInput.value = ''; // Clear input after sending
  });
}