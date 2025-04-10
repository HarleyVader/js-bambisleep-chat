// Service Worker for socket.io connections

// Import socket.io client if needed
importScripts('/socket.io/socket.io.js');

let socket = null;
const clients = new Set();
const messageQueue = [];
let isConnected = false;

// Initialize socket connection
function initSocket() {
  if (socket) return; // Prevent duplicate initialization
  
  socket = io({
    // Your existing socket options
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
    timeout: 20000
  });
  
  socket.on('connect', () => {
    isConnected = true;
    console.log('[ServiceWorker] Socket connected');
    
    // Process any queued messages
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift();
      socket.emit(msg.event, ...msg.args);
    }
    
    // Notify all clients
    notifyClients({
      type: 'SOCKET_EVENT',
      event: 'connect'
    });
  });
  
  socket.on('disconnect', () => {
    isConnected = false;
    console.log('[ServiceWorker] Socket disconnected');
    notifyClients({
      type: 'SOCKET_EVENT',
      event: 'disconnect'
    });
  });
  
  // Set up other socket event listeners and forward them to clients
  setupSocketEventForwarding();
}

// Forward events from socket to clients
function setupSocketEventForwarding() {
  const eventsToForward = [
    'ai response',
    'chat message',
    'trigger',
    'error',
    // Add other events you need to forward
  ];
  
  eventsToForward.forEach(eventName => {
    socket.on(eventName, (data) => {
      notifyClients({
        type: 'SOCKET_EVENT',
        event: eventName,
        data: data
      });
    });
  });
}

// Notify all clients with a message
function notifyClients(message) {
  clients.forEach(client => {
    client.postMessage(message);
  });
}

// Service worker event listeners
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installed');
  self.skipWaiting(); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activated');
  event.waitUntil(clients.claim()); // Take control of clients immediately
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  const client = event.source;
  
  // Add client to our set if not already there
  if (!clients.has(client)) {
    clients.add(client);
  }
  
  // Handle client message
  const message = event.data;
  
  if (message.type === 'CLIENT_READY') {
    // Initialize socket if not already done
    if (!socket) {
      initSocket();
    }
    // Notify client of current connection status
    client.postMessage({
      type: 'SOCKET_EVENT',
      event: isConnected ? 'connect' : 'disconnect'
    });
  }
  else if (message.type === 'SOCKET_EMIT') {
    // Forward client emit to socket server
    if (socket && isConnected) {
      socket.emit(message.event, ...message.args);
    } else {
      // Queue message for when socket connects
      messageQueue.push({
        event: message.event,
        args: message.args
      });
      
      // Try to initialize socket if not done yet
      if (!socket) {
        initSocket();
      }
    }
  }
});