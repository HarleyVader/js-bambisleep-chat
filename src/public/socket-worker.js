// Service worker to maintain socket connection across page navigations

// Cache name for offline support
const CACHE_NAME = 'bambisleep-cache-v1';

// Install event - cache important resources
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/js/socket-client.js',
        '/socket.io/socket.io.js',
        '/css/main.css',
        '/gif/default-avatar.gif',
        '/gif/default-header.gif'
      ]);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Socket connection management
let socket = null;
let bambiname = null;

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data.type === 'INIT_SOCKET') {
    // Store bambiname
    bambiname = event.data.bambiname;
    // Initialize socket if needed
    if (!socket) {
      importScripts('/socket.io/socket.io.js');
      socket = io({
        transports: ['websocket'],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });
      
      socket.on('connect', () => {
        broadcastToClients({
          type: 'SOCKET_CONNECTED',
          id: socket.id
        });
        
        if (bambiname) {
          socket.emit('set username', bambiname);
        }
      });
      
      socket.on('disconnect', (reason) => {
        broadcastToClients({
          type: 'SOCKET_DISCONNECTED',
          reason: reason
        });
      });
      
      // Forward all messages to clients
      socket.onAny((event, ...args) => {
        broadcastToClients({
          type: 'SOCKET_EVENT',
          event: event,
          data: args
        });
      });
    }
    
    // Respond to the client
    event.source.postMessage({
      type: 'SOCKET_STATUS',
      connected: socket && socket.connected,
      id: socket ? socket.id : null
    });
  }
  
  // Handle sending messages through the socket
  if (event.data.type === 'EMIT' && socket) {
    socket.emit(event.data.event, ...event.data.args);
  }
  
  // Update bambiname if it changes
  if (event.data.type === 'SET_BAMBINAME' && socket) {
    bambiname = event.data.bambiname;
    socket.emit('set username', bambiname);
  }
});

// Broadcast a message to all clients
async function broadcastToClients(message) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage(message);
  });
}