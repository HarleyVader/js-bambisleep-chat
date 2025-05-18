document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('textarea-chat');
  const chatMessages = document.getElementById('chat-messages');
  const sendButton = document.getElementById('send');
  const toggleTtsBtn = document.getElementById('toggle-tts-btn');
  const toggleTriggersBtn = document.getElementById('toggle-triggers-btn');
  const toggleHistoryBtn = document.getElementById('toggle-history-btn');
  const saveSessionBtn = document.getElementById('save-session-btn');
  const newSessionBtn = document.getElementById('new-session-btn');
  const triggerItems = document.querySelectorAll('.trigger-item');
  const activeTriggers = document.getElementById('active-triggers');
  const eyeCursor = document.getElementById('eyeCursor');
  const eyeCursorText = document.getElementById('eyeCursorText');
  const eye = document.getElementById('eye');
  
  // State
  let currentSession = {
    id: null,
    title: 'New Session',
    messages: [],
    activeTriggers: []
  };
  let ttsEnabled = false;
  let eyeCursorVisible = false;
  let username = document.body.dataset.username || 'anonBambi';
  
  // Socket connection
  const socket = io();
  
  // Auto expand textarea
  window.autoExpand = (field) => {
    field.style.height = 'inherit';
    field.style.height = `${Math.min(field.scrollHeight, 300)}px`;
  };
  
  // Initialize UI state
  function initializeUI() {
    // Load user preferences
    ttsEnabled = localStorage.getItem('bambisleep_tts_enabled') === 'true';
    updateTtsButtonState();
    
    // Scroll to last message
    scrollToBottom();
    
    // Load active triggers if user is logged in
    if (username && username !== 'anonBambi') {
      loadActiveTriggers();
    }
  }
  
  // Update TTS button state
  function updateTtsButtonState() {
    if (ttsEnabled) {
      toggleTtsBtn.classList.add('active');
      toggleTtsBtn.querySelector('i').className = 'fas fa-volume-up';
    } else {
      toggleTtsBtn.classList.remove('active');
      toggleTtsBtn.querySelector('i').className = 'fas fa-volume-mute';
    }
    localStorage.setItem('bambisleep_tts_enabled', ttsEnabled);
  }
  
  // Load active triggers from profile
  function loadActiveTriggers() {
    socket.emit('request-profile-update', { username });
  }
  
  // Add trigger to active triggers
  function addTrigger(triggerName) {
    // Add to UI
    const existingTriggers = [...activeTriggers.querySelectorAll('.trigger-tag')];
    const hasTag = existingTriggers.some(tag => tag.textContent === triggerName);
    
    if (!hasTag) {
      const triggerTag = document.createElement('div');
      triggerTag.className = 'trigger-tag';
      triggerTag.textContent = triggerName;
      
      const removeBtn = document.createElement('span');
      removeBtn.className = 'trigger-remove';
      removeBtn.innerHTML = '×';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeTrigger(triggerName);
      });
      
      triggerTag.appendChild(removeBtn);
      activeTriggers.appendChild(triggerTag);
      
      // Remove no triggers message if exists
      const noTriggersMsg = activeTriggers.querySelector('.no-triggers-message');
      if (noTriggersMsg) {
        noTriggersMsg.remove();
      }
      
      // Add to current session
      if (!currentSession.activeTriggers.includes(triggerName)) {
        currentSession.activeTriggers.push(triggerName);
      }
      
      // Update profile if logged in
      if (username && username !== 'anonBambi') {
        socket.emit('update-active-triggers', { 
          username, 
          triggers: currentSession.activeTriggers 
        });
      }
    }
  }
  
  // Remove trigger from active triggers
  function removeTrigger(triggerName) {
    // Remove from UI
    const triggerTags = [...activeTriggers.querySelectorAll('.trigger-tag')];
    const tagToRemove = triggerTags.find(tag => tag.textContent.includes(triggerName));
    
    if (tagToRemove) {
      tagToRemove.remove();
      
      // Show no triggers message if none left
      if (triggerTags.length <= 1) {
        const noTriggersMsg = document.createElement('p');
        noTriggersMsg.className = 'no-triggers-message';
        noTriggersMsg.textContent = 'No active triggers';
        activeTriggers.appendChild(noTriggersMsg);
      }
      
      // Remove from current session
      const triggerIndex = currentSession.activeTriggers.indexOf(triggerName);
      if (triggerIndex > -1) {
        currentSession.activeTriggers.splice(triggerIndex, 1);
      }
      
      // Update profile if logged in
      if (username && username !== 'anonBambi') {
        socket.emit('update-active-triggers', { 
          username, 
          triggers: currentSession.activeTriggers 
        });
      }
    }
  }
  
  // Send a chat message
  function sendMessage(messageText) {
    if (!messageText.trim()) return;
    
    const message = {
      username: username,
      data: messageText
    };
    
    // Send to server
    socket.emit('chat message', message);
    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatInput.focus();
    
    // Add message to current session
    currentSession.messages.push({
      role: 'user',
      content: messageText,
      timestamp: new Date()
    });
  }
  
  // Create new chat message element
  function createMessageElement(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message-item ${message.username === username ? 'user-message' : ''}`;
    
    const header = document.createElement('div');
    header.className = 'message-header';
    
    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = new Date(message.timestamp).toLocaleTimeString([], {hour12: false});
    
    const usernameElement = document.createElement('span');
    usernameElement.className = 'message-username';
    
    const usernameLink = document.createElement('a');
    usernameLink.href = `/profile/${message.username}`;
    usernameLink.className = 'username-link';
    usernameLink.textContent = message.username;
    
    usernameElement.appendChild(usernameLink);
    header.appendChild(time);
    header.appendChild(usernameElement);
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = message.data;
    
    messageElement.appendChild(header);
    messageElement.appendChild(content);
    
    return messageElement;
  }
  
  // Scroll chat to bottom
  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // Toggle eye cursor animation
  function toggleEyeCursor(show, message = '') {
    if (show) {
      eyeCursor.style.display = 'flex';
      if (message) {
        eyeCursorText.textContent = message;
      }
      eyeCursorVisible = true;
    } else {
      eyeCursor.style.display = 'none';
      eyeCursorVisible = false;
    }
  }
  
  // Load session from server
  async function loadSession(sessionId) {
    try {
      toggleEyeCursor(true, 'Loading session...');
      
      const response = await fetch(`/advanced-chat/session/${sessionId}`);
      const data = await response.json();
      
      if (data.success && data.session) {
        // Set current session
        currentSession = {
          id: data.session._id,
          title: data.session.title || 'Untitled Session',
          messages: data.session.messages || [],
          activeTriggers: data.session.metadata?.triggers || []
        };
        
        // Clear and update triggers
        activeTriggers.innerHTML = '';
        if (currentSession.activeTriggers.length > 0) {
          currentSession.activeTriggers.forEach(trigger => addTrigger(trigger));
        } else {
          const noTriggersMsg = document.createElement('p');
          noTriggersMsg.className = 'no-triggers-message';
          noTriggersMsg.textContent = 'No active triggers';
          activeTriggers.appendChild(noTriggersMsg);
        }
        
        // Display notification
        showNotification(`Loaded session: ${currentSession.title}`);
      } else {
        showNotification('Error loading session', 'error');
      }
    } catch (error) {
      console.error('Error loading session:', error);
      showNotification('Error loading session', 'error');
    } finally {
      toggleEyeCursor(false);
    }
  }
  
  // Save current session
  async function saveSession() {
    if (username === 'anonBambi') {
      showNotification('Please log in to save sessions', 'error');
      return;
    }
    
    try {
      toggleEyeCursor(true, 'Saving session...');
      
      // Prompt for session title if needed
      if (!currentSession.id) {
        const title = prompt('Enter a name for this session:', currentSession.title);
        if (title === null) {
          toggleEyeCursor(false);
          return; // User cancelled
        }
        currentSession.title = title || 'Untitled Session';
      }
      
      // Prepare session data
      const sessionData = {
        id: currentSession.id,
        title: currentSession.title,
        messages: currentSession.messages,
        triggers: currentSession.activeTriggers
      };
      
      // Send to server via socket
      socket.emit('save-session', sessionData, (response) => {
        if (response.success) {
          currentSession.id = response.sessionId;
          showNotification('Session saved successfully');
          
          // Update session list if needed
          if (newSessionBtn) {
            fetchAndUpdateSessionList();
          }
        } else {
          showNotification('Error saving session', 'error');
        }
        
        toggleEyeCursor(false);
      });
    } catch (error) {
      console.error('Error saving session:', error);
      showNotification('Error saving session', 'error');
      toggleEyeCursor(false);
    }
  }
  
  // Fetch and update session list 
  async function fetchAndUpdateSessionList() {
    try {
      const response = await fetch('/advanced-chat/sessions');
      const data = await response.json();
      
      if (data.success && data.sessions) {
        const sessionList = document.getElementById('session-list');
        if (sessionList) {
          sessionList.innerHTML = '';
          
          if (data.sessions.length > 0) {
            data.sessions.forEach(session => {
              const sessionItem = document.createElement('div');
              sessionItem.className = 'session-item';
              sessionItem.dataset.sessionId = session._id;
              
              const title = document.createElement('div');
              title.className = 'session-title';
              title.textContent = session.title || 'Untitled Session';
              
              const time = document.createElement('div');
              time.className = 'session-time';
              time.textContent = new Date(session.lastActivity).toLocaleString();
              
              const loadBtn = document.createElement('button');
              loadBtn.className = 'load-session-btn';
              loadBtn.textContent = 'Load';
              loadBtn.dataset.sessionId = session._id;
              loadBtn.addEventListener('click', () => loadSession(session._id));
              
              sessionItem.appendChild(title);
              sessionItem.appendChild(time);
              sessionItem.appendChild(loadBtn);
              sessionList.appendChild(sessionItem);
            });
          } else {
            const noSessionsMsg = document.createElement('p');
            noSessionsMsg.className = 'no-sessions-message';
            noSessionsMsg.textContent = 'No sessions found';
            sessionList.appendChild(noSessionsMsg);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  }
  
  // Display notification
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
  
  // Initialize text-to-speech functionality
  function setupTTS() {
    // Check if browser supports speech synthesis
    if ('speechSynthesis' in window) {
      // Get available voices
      let voices = [];
      
      function populateVoices() {
        voices = window.speechSynthesis.getVoices();
      }
      
      populateVoices();
      
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoices;
      }
      
      // TTS function
      window.speakMessage = (text) => {
        if (!ttsEnabled) return;
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Find a suitable voice (prefer female voices)
        let voice = voices.find(v => v.name.includes('Female') || v.name.includes('female'));
        if (!voice) {
          voice = voices[0]; // Default to first voice if no female voice found
        }
        
        if (voice) {
          utterance.voice = voice;
        }
        
        utterance.pitch = 1.2; // Slightly higher pitch
        utterance.rate = 1.0; // Normal rate
        utterance.volume = 1.0; // Full volume
        
        window.speechSynthesis.speak(utterance);
      };
    } else {
      console.warn('Speech synthesis not supported in this browser');
      toggleTtsBtn.style.display = 'none';
    }
  }
  
  // Event listeners
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(chatInput.value);
  });
  
  toggleTtsBtn.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    updateTtsButtonState();
    showNotification(`Text-to-speech ${ttsEnabled ? 'enabled' : 'disabled'}`);
  });
  
  toggleTriggersBtn.addEventListener('click', () => {
    const sidebar = document.querySelector('.chat-info-sidebar');
    sidebar.classList.toggle('visible-mobile');
    
    if (sidebar.classList.contains('visible-mobile')) {
      document.querySelector('.chat-main').classList.add('shifted');
    } else {
      document.querySelector('.chat-main').classList.remove('shifted');
    }
  });
  
  toggleHistoryBtn.addEventListener('click', () => {
    const sidebar = document.querySelector('.chat-sidebar');
    sidebar.classList.toggle('visible-mobile');
    
    if (sidebar.classList.contains('visible-mobile')) {
      document.querySelector('.chat-main').classList.add('shifted');
    } else {
      document.querySelector('.chat-main').classList.remove('shifted');
    }
  });
  
  saveSessionBtn.addEventListener('click', saveSession);
  
  if (newSessionBtn) {
    newSessionBtn.addEventListener('click', () => {
      // Reset current session
      currentSession = {
        id: null,
        title: 'New Session',
        messages: [],
        activeTriggers: []
      };
      
      // Clear active triggers
      activeTriggers.innerHTML = '';
      const noTriggersMsg = document.createElement('p');
      noTriggersMsg.className = 'no-triggers-message';
      noTriggersMsg.textContent = 'No active triggers';
      activeTriggers.appendChild(noTriggersMsg);
      
      showNotification('Started new session');
    });
  }
  
  // Add click handlers to trigger items
  triggerItems.forEach(item => {
    item.addEventListener('click', () => {
      const triggerName = item.dataset.name;
      addTrigger(triggerName);
      showNotification(`Added trigger: ${triggerName}`);
      
      // Emit trigger used event if user is logged in
      if (username !== 'anonBambi') {
        socket.emit('trigger-used', {
          username,
          trigger: triggerName
        });
      }
    });
  });
  
  // Handle load session buttons  
  document.querySelectorAll('.load-session-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      loadSession(btn.dataset.sessionId);
    });
  });
  
  // Socket event handlers
  socket.on('connect', () => {
    console.log('Socket connected');
  });
  
  socket.on('chat message', (message) => {
    chatMessages.appendChild(createMessageElement(message));
    scrollToBottom();
    
    // If TTS is enabled, speak the message
    if (ttsEnabled && message.username !== username) {
      window.speakMessage(message.data);
    }
    
    // Add to current session
    if (message.username !== username) {
      currentSession.messages.push({
        role: 'assistant',
        content: message.data,
        timestamp: message.timestamp
      });
    }
  });
  
  socket.on('profile-update', (data) => {
    // Update XP and level display
    if (data.level && data.xp) {
      const levelDisplay = document.querySelector('.level-display');
      const xpBar = document.querySelector('.xp-bar');
      const xpDisplay = document.querySelector('.xp-display');
      
      if (levelDisplay) levelDisplay.textContent = `Level ${data.level}`;
      if (xpDisplay) xpDisplay.textContent = `${Math.floor(data.xp)} XP`;
      if (xpBar) {
        const xpPercentage = Math.min(100, (data.xp / (Math.pow(data.level, 2) * 100)) * 100);
        xpBar.style.width = `${xpPercentage}%`;
      }
    }
    
    // Update active triggers from profile
    if (data.systemControls?.activeTriggers) {
      // Clear current triggers
      activeTriggers.innerHTML = '';
      
      // Add triggers from profile
      const profileTriggers = data.systemControls.activeTriggers;
      if (profileTriggers.length > 0) {
        profileTriggers.forEach(trigger => addTrigger(trigger));
        currentSession.activeTriggers = [...profileTriggers];
      } else {
        const noTriggersMsg = document.createElement('p');
        noTriggersMsg.className = 'no-triggers-message';
        noTriggersMsg.textContent = 'No active triggers';
        activeTriggers.appendChild(noTriggersMsg);
      }
    }
  });
  
  socket.on('level-up', (data) => {
    showNotification(`🎉 Level up! You are now level ${data.level}`, 'success');
  });
  
  // Save session response handler
  socket.on('session-saved', (data) => {
    if (data.success) {
      currentSession.id = data.sessionId;
      showNotification('Session saved successfully');
      
      // Update session list
      fetchAndUpdateSessionList();
    } else {
      showNotification('Error saving session', 'error');
    }
    
    toggleEyeCursor(false);
  });
  
  // Initialize
  initializeUI();
  setupTTS();
});
