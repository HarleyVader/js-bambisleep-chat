// Setup socket connection and event handlers
function setupSocket(socket, io) {
  const username = socket.request.session.username;
  
  // Setup basic socket handlers
  setupChatHandlers(socket, username);
  setupSystemHandlers(socket, username);
  setupWorkerHandlers(socket, username);
  
  // Track connection for analytics
  trackConnection(socket, username);
  
  // Handle disconnection
  socket.on('disconnect', () => handleDisconnect(socket, username));
}

// Set up chat message handlers
function setupChatHandlers(socket, username) {
  socket.on('chat message', msg => {
    // Process the message
    const processedMsg = processMessage(msg);
    
    // Save to database and broadcast
    saveAndBroadcast(socket, username, processedMsg);
  });
}

// Set up system control handlers
function setupSystemHandlers(socket, username) {
  socket.on('system-update', data => {
    if (!data || !username) return;
    
    // Save system settings to user profile
    saveToProfile(username, data);
    
    // Notify client of successful update
    socket.emit('system-update-success');
  });
  
  socket.on('system-settings', settings => {
    if (!settings) return;
    
    // Forward settings to appropriate worker
    sendToWorker('lmstudio', 'system-settings', {
      socketId: socket.id,
      username,
      settings
    });
  });
}

// Set up worker communication
function setupWorkerHandlers(socket, username) {
  socket.on('worker-command', data => {
    const { worker, command, payload } = data;
    if (!worker || !command) return;
    
    sendToWorker(worker, command, {
      ...payload,
      socketId: socket.id,
      username
    });
  });
}

// Track user connection
function trackConnection(socket, username) {
  if (!username) return;
  
  updateUserStatus(username, true);
  socket.broadcast.emit('user-connected', username);
}

// Handle user disconnection
function handleDisconnect(socket, username) {
  if (!username) return;
  
  updateUserStatus(username, false);
  socket.broadcast.emit('user-disconnected', username);
}

module.exports = setupSocket;