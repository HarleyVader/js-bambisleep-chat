// Create a global socket connection that persists across routes
let globalSocket;

// Initialize socket connection if it doesn't exist
function initializeSocket() {
  if (!globalSocket || !globalSocket.connected) {
    globalSocket = io({
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
    
    // Listen for connection
    globalSocket.on('connect', () => {
      console.log('Connected to the server');
      
      // Set the BambiName on connect if available
      const bambiname = getBambiNameFromCookies();
      if (bambiname) {
        globalSocket.emit('set username', bambiname);
        console.log('BambiName set:', bambiname);
      }
    });
    
    // Listen for reconnection
    globalSocket.on('reconnect', () => {
      console.log('Reconnected to server');
      // Reset username on reconnect
      const bambiname = getBambiNameFromCookies();
      if (bambiname) {
        globalSocket.emit('set username', bambiname);
      }
    });
    
    // Listen for disconnect
    globalSocket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
    });
    
    // Setup default event listeners
    setupSocketListeners(globalSocket);
  }
  
  return globalSocket;
}

// Helper function to get BambiName from cookies
function getBambiNameFromCookies() {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; bambiname=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

// Set up common event listeners
function setupSocketListeners(socket) {
  // Listen for messages from the server
  socket.on('message', (data) => {
    console.log('Message from server:', data);
  });
  
  // Chat messages
  socket.on('chat message', (msg) => {
    const chatResponse = document.getElementById('chat-response');
    if (chatResponse) {
      const item = document.createElement("li");
      const timestamp = new Date(msg.timestamp).toLocaleTimeString();
      item.textContent = `${timestamp} - ${msg.username}: ${msg.data}`;
      if (timestamp && window.username) {
        item.classList.add("neon-glow");
      }
      chatResponse.appendChild(item);
    }
  });
  
  // Collar messages
  socket.on('collar', (message) => {
    const collarResponse = document.getElementById('textarea-collar-response');
    if (collarResponse) {
      const messageElement = document.createElement('p');
      messageElement.textContent = message;
      if (collarResponse.firstChild) {
        collarResponse.insertBefore(messageElement, collarResponse.firstChild);
      } else {
        collarResponse.appendChild(messageElement);
      }
      if (typeof applyUppercaseStyle === 'function') {
        applyUppercaseStyle();
      }
    }
  });
}

// Function to send a message to the server
function sendMessage(message) {
  const socket = getSocket();
  socket.emit('message', message);
}

// Function to send a chat message
function sendChatMessage(message) {
  const socket = getSocket();
  const bambiname = getBambiNameFromCookies() || 'Anonymous';
  socket.emit('chat message', { data: message, username: bambiname });
}

// Function to send a collar message
function sendCollarMessage(message) {
  const socket = getSocket();
  socket.emit('collar', { data: message, socketId: socket.id });
}

// Get the global socket instance or initialize if needed
function getSocket() {
  return globalSocket || initializeSocket();
}

// Immediately initialize the socket when this script loads
initializeSocket();

// Export functions for use in other scripts
window.BambiSocket = {
  getSocket,
  sendMessage,
  sendChatMessage,
  sendCollarMessage,
  getBambiNameFromCookies
};

// Example usage: sending a message
document.getElementById('sendButton').addEventListener('click', () => {
  const messageInput = document.getElementById('messageInput');
  const message = messageInput.value;
  sendMessage(message);
  messageInput.value = ''; // Clear input after sending
});