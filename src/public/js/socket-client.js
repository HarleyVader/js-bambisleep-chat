// Socket client that uses a service worker for persistent connections

// Event listeners for socket events
const eventListeners = {};
let serviceWorkerReady = false;
let messageQueue = [];
let socketConnected = false;

// Initialize the service worker and socket connection
async function initializeSocket() {
  if ('serviceWorker' in navigator) {
    try {
      // Register the service worker
      const registration = await navigator.serviceWorker.register('/socket-worker.js');
      console.log('ServiceWorker registered:', registration);
      
      // Wait for the service worker to be ready
      await navigator.serviceWorker.ready;
      serviceWorkerReady = true;
      
      // Set up message listener from service worker
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      
      // Initialize socket in service worker
      const bambiname = getBambiNameFromCookies();
      sendToServiceWorker({
        type: 'INIT_SOCKET',
        bambiname: bambiname
      });
      
      // Process any queued messages
      processMessageQueue();
      
      return true;
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
      return false;
    }
  } else {
    console.warn('Service workers are not supported in this browser');
    return false;
  }
}

// Process any messages queued before service worker was ready
function processMessageQueue() {
  if (serviceWorkerReady && messageQueue.length > 0) {
    messageQueue.forEach(msg => sendToServiceWorker(msg));
    messageQueue = [];
  }
}

// Send a message to the service worker
function sendToServiceWorker(message) {
  if (serviceWorkerReady && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
  } else {
    messageQueue.push(message);
  }
}

// Handle messages from the service worker
function handleServiceWorkerMessage(event) {
  const data = event.data;
  
  if (data.type === 'SOCKET_CONNECTED') {
    console.log('Socket connected via service worker, ID:', data.id);
    socketConnected = true;
    // Execute any onConnect callbacks
    if (eventListeners['connect']) {
      eventListeners['connect'].forEach(callback => callback());
    }
  }
  
  if (data.type === 'SOCKET_DISCONNECTED') {
    console.log('Socket disconnected:', data.reason);
    socketConnected = false;
    // Execute any onDisconnect callbacks
    if (eventListeners['disconnect']) {
      eventListeners['disconnect'].forEach(callback => callback(data.reason));
    }
  }
  
  if (data.type === 'SOCKET_EVENT') {
    // Forward event to appropriate listeners
    const event = data.event;
    const args = data.data;
    
    if (eventListeners[event]) {
      eventListeners[event].forEach(callback => callback(...args));
    }
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
  sendToServiceWorker({
    type: 'EMIT',
    event: event,
    args: args
  });
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
  sendToServiceWorker({
    type: 'SET_BAMBINAME',
    bambiname: bambiname
  });
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