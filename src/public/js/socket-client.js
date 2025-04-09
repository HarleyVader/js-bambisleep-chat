const socket = io(); // Initialize socket.io client

// Listen for connection
socket.on('connect', () => {
  console.log('Connected to the server');
});

// Listen for messages from the server
socket.on('message', (data) => {
  console.log('Message from server:', data);
});

// Function to send a message to the server
function sendMessage(message) {
  socket.emit('message', message);
}

// Example usage: sending a message
document.getElementById('sendButton').addEventListener('click', () => {
  const messageInput = document.getElementById('messageInput');
  const message = messageInput.value;
  sendMessage(message);
  messageInput.value = ''; // Clear input after sending
});