// Setup socket connection and event handlers
function setupSocket(socket, io) {
  const username = socket.request.session.username;
  
  // Setup basic socket handlers
  setupChatHandlers(socket, username);
  setupSystemHandlers(socket, username);
  setupWorkerHandlers(socket, username);
  setupSessionHandlers(socket, io);
  
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

// Set up session handlers
function setupSessionHandlers(socket, io) {
  const username = socket.bambiUsername;
  
  // Load session
  socket.on('load-session', async (sessionId) => {
    try {
      const SessionHistory = await getSessionHistoryModel();
      const session = await SessionHistory.findById(sessionId);
      
      if (!session) return;
      
      // Store active session ID on socket
      socket.activeSessionId = sessionId;
      
      // Send to client
      socket.emit('session-loaded', {
        session,
        sessionId
      });
      
      // If this session has messages, tell worker to load them
      if (session.messages && session.messages.length > 0) {
        // Find worker for this socket
        const socketData = socketStore.get(socket.id);
        if (socketData && socketData.worker) {
          socketData.worker.postMessage({
            type: 'load-history',
            sessionId,
            messages: session.messages,
            socketId: socket.id,
            username
          });
        }
      }
    } catch (error) {
      logger.error('Error loading session:', error.message);
    }
  });
  
  // Save session
  socket.on('save-session', async (data) => {
    if (!data || !username || username === 'anonBambi') return;
    
    try {
      const SessionHistory = await getSessionHistoryModel();
      
      // Update existing or create new session
      if (data.sessionId) {
        await SessionHistory.findByIdAndUpdate(
          data.sessionId,
          {
            $set: {
              'metadata.lastActivity': new Date(),
              'metadata.triggers': data.settings?.activeTriggers || [],
              'metadata.collarActive': data.settings?.collarSettings?.enabled || false,
              'metadata.collarText': data.settings?.collarSettings?.text || '',
              'metadata.spiralSettings': data.settings?.spiralSettings || {}
            },
            $push: {
              messages: { 
                $each: data.messages || [] 
              }
            }
          }
        );
        
        socket.emit('session-saved', { sessionId: data.sessionId });
      } else {
        // Create new session
        const newSession = new SessionHistory({
          username: username,
          title: data.title || `Session ${new Date().toLocaleString()}`,
          messages: data.messages || [],
          metadata: {
            createdAt: new Date(),
            lastActivity: new Date(),
            triggers: data.settings?.activeTriggers || [],
            collarActive: data.settings?.collarSettings?.enabled || false,
            collarText: data.settings?.collarSettings?.text || '',
            spiralSettings: data.settings?.spiralSettings || {}
          }
        });
        
        await newSession.save();
        socket.activeSessionId = newSession._id;
        socket.emit('session-created', { sessionId: newSession._id });
      }
    } catch (error) {
      logger.error('Error saving session:', error.message);
    }
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