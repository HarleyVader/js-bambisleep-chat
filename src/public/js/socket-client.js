/**
 * Socket.IO Client
 * Handles socket connections and events for BambiSleep profiles and triggers
 */

// Store socket connection
let socket;

// Initialize socket connection
function initSocket() {
  if (typeof io === 'undefined') {
    console.error('Socket.IO not loaded');
    return null;
  }
  
  // Create socket connection
  socket = io();
  
  // Connection events
  socket.on('connect', handleConnect);
  socket.on('connect_error', handleConnectError);
  socket.on('disconnect', handleDisconnect);
  
  // General app events
  socket.on('error', handleError);
  
  // Profile events
  socket.on('profile-data', handleProfileData);
  socket.on('profile-not-found', handleProfileNotFound);
  socket.on('profile-created', handleProfileCreated);
  socket.on('profile-updated', handleProfileUpdated);
  socket.on('profile-deleted', handleProfileDeleted);
  socket.on('new-profile-created', handleNewProfileCreated);
  
  // Trigger events
  socket.on('trigger-toggled', handleTriggerToggled);
  socket.on('all-triggers-toggled', handleAllTriggersToggled);
  socket.on('trigger-added', handleTriggerAdded);
  socket.on('trigger-deleted', handleTriggerDeleted);
  socket.on('trigger-event-received', handleTriggerEvent);
  socket.on('trigger-history', handleTriggerHistory);
  
  return socket;
}

// Connection event handlers
function handleConnect() {
  console.log('Connected to server');
  
  // Join profile room if on profile page
  const username = document.body.getAttribute('data-username');
  if (username) {
    socket.emit('join-profile', username);
  }
  
  // Show connection status
  updateConnectionStatus(true);
}

function handleConnectError(err) {
  console.error('Connection error:', err);
  updateConnectionStatus(false);
}

function handleDisconnect(reason) {
  console.log('Disconnected:', reason);
  updateConnectionStatus(false);
}

// Profile event handlers
function handleProfileData(profile) {
  console.log('Profile data received:', profile);
  
  // Update profile data displays
  updateProfileDisplay(profile);
  
  // Update trigger displays if present
  updateTriggerDisplays(profile.triggers, profile.activeTriggerSession);
  
  // Store username in data attribute if not already set
  if (!document.body.hasAttribute('data-username')) {
    document.body.setAttribute('data-username', profile.username);
  }
}

function handleProfileNotFound() {
  console.error('Profile not found');
  showNotification('Profile not found', 'error');
  
  // Show error message in UI
  const profileContainer = document.querySelector('.profile-container');
  if (profileContainer) {
    profileContainer.innerHTML = `
      <div class="error-message">
        <h2>Profile Not Found</h2>
        <p>Sorry, we couldn't find this profile. It may have been deleted or never existed.</p>
        <a href="/profile/new" class="btn">Create New Profile</a>
      </div>
    `;
  }
}

function handleProfileCreated(profile) {
  console.log('Profile created:', profile);
  showNotification('Profile created successfully!', 'success');
  
  // Redirect to the profile page
  setTimeout(() => {
    window.location.href = `/profile/${profile.username}`;
  }, 1500);
}

function handleProfileUpdated(profile) {
  console.log('Profile updated:', profile);
  updateProfileDisplay(profile);
}

function handleProfileDeleted({ username }) {
  console.log('Profile deleted:', username);
  
  // Check if we're on the deleted profile page
  const currentUsername = document.body.getAttribute('data-username');
  if (currentUsername === username) {
    showNotification('This profile has been deleted', 'info');
    
    // Redirect to home after a delay
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
  }
}

function handleNewProfileCreated({ username }) {
  console.log('New profile created:', username);
  
  // Only show notification if we're on the profiles list page
  if (window.location.pathname === '/' || window.location.pathname === '/profile') {
    showNotification(`New profile created: ${username}`, 'info');
    
    // Add new profile to list if we're on the profiles page
    const profilesList = document.querySelector('.profiles-list');
    if (profilesList) {
      // Fetch and append the new profile
      fetch(`/profile/${username}/card`)
        .then(response => response.text())
        .then(html => {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          const profileCard = tempDiv.firstElementChild;
          profilesList.appendChild(profileCard);
        })
        .catch(err => console.error('Error fetching new profile card:', err));
    }
  }
}

// Trigger event handlers
function handleTriggerToggled({ triggerName, active, activeTriggerSession }) {
  console.log(`Trigger ${triggerName} ${active ? 'activated' : 'deactivated'}`);
  
  // Update the UI to reflect the new state
  updateTriggerUI(triggerName, active);
  
  // Update active triggers session display
  updateActiveTriggersDisplay(activeTriggerSession);
  
  // Show notification
  showNotification(`Trigger ${triggerName} ${active ? 'activated' : 'deactivated'}`, active ? 'success' : 'info');
}

function handleAllTriggersToggled({ active, activeTriggerSession, triggers }) {
  console.log(`All triggers ${active ? 'activated' : 'deactivated'}`);
  
  // Update all toggle inputs in the UI
  const toggleInputs = document.querySelectorAll('.toggle-input');
  toggleInputs.forEach(input => {
    input.checked = active;
  });
  
  // Update each trigger in the UI
  triggers.forEach(trigger => {
    updateTriggerUI(trigger.name, trigger.active);
  });
  
  // Update active triggers session display
  updateActiveTriggersDisplay(activeTriggerSession);
  
  // Show notification
  showNotification(`All triggers ${active ? 'activated' : 'deactivated'}`, active ? 'success' : 'info');
}

function handleTriggerAdded({ trigger, activeTriggerSession }) {
  console.log('Trigger added:', trigger);
  
  // Add the new trigger to the UI
  addTriggerToUI(trigger);
  
  // Update active triggers session display
  updateActiveTriggersDisplay(activeTriggerSession);
  
  // Show notification
  showNotification(`Trigger ${trigger.name} added`, 'success');
}

function handleTriggerDeleted({ triggerName, activeTriggerSession, triggers }) {
  console.log('Trigger deleted:', triggerName);
  
  // Remove the trigger from the UI
  removeTriggerFromUI(triggerName);
  
  // Update active triggers session display
  updateActiveTriggersDisplay(activeTriggerSession);
  
  // Show notification
  showNotification(`Trigger ${triggerName} deleted`, 'info');
}

function handleTriggerEvent({ triggers, timestamp, source }) {
  console.log('Trigger event received:', { triggers, timestamp, source });
  
  // Show notification
  const triggerStr = Array.isArray(triggers) ? triggers.join(', ') : triggers;
  showNotification(`Trigger event: ${triggerStr}`, 'warning');
  
  // Add to history display if it exists
  addTriggerEventToHistory({ triggers, timestamp, source });
  
  // Play sound effect if enabled
  playTriggerSound();
}

function handleTriggerHistory({ history }) {
  console.log('Trigger history received:', history);
  
  // Update history display
  updateTriggerHistoryDisplay(history);
}

// General error handler
function handleError({ message }) {
  console.error('Socket error:', message);
  showNotification(message, 'error');
}

// UI Helper functions
function updateConnectionStatus(connected) {
  const statusEl = document.getElementById('connection-status');
  if (statusEl) {
    statusEl.className = connected ? 'connected' : 'disconnected';
    statusEl.textContent = connected ? 'Connected' : 'Disconnected';
  }
}

function updateProfileDisplay(profile) {
  // Update basic profile info
  const nameElement = document.getElementById('profile-name');
  if (nameElement) nameElement.textContent = profile.name || profile.username;
  
  const usernameElement = document.getElementById('profile-username');
  if (usernameElement) usernameElement.textContent = profile.username;
  
  const avatarElement = document.getElementById('profile-avatar');
  if (avatarElement && profile.avatar) avatarElement.src = profile.avatar;
  
  // Update profile fields
  for (const [key, value] of Object.entries(profile)) {
    const displayEl = document.getElementById(`${key}-display`);
    if (displayEl) {
      if (key === 'about' && value) {
        // For about field, handle links
        displayEl.innerHTML = value.replace(/https?:\/\/[^\s]+/g, '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>');
      } else if (value !== null && value !== undefined) {
        displayEl.textContent = value;
      }
    }
  }
  
  // Update form inputs if any
  for (const [key, value] of Object.entries(profile)) {
    const inputEl = document.getElementById(key);
    if (inputEl && value !== null && value !== undefined) {
      inputEl.value = value;
    }
  }
}

function updateTriggerDisplays(triggers, activeTriggerSession) {
  if (!triggers) return;
  
  // Update triggers grid
  const triggerGrid = document.querySelector('.trigger-grid');
  if (triggerGrid) {
    // Clear existing triggers
    triggerGrid.innerHTML = '';
    
    // Add each trigger
    triggers.forEach(trigger => {
      addTriggerToUI(trigger);
    });
  }
  
  // Update active triggers session display
  updateActiveTriggersDisplay(activeTriggerSession);
}

function updateTriggerUI(triggerName, active) {
  const toggleInput = document.querySelector(`.toggle-input[data-trigger="${triggerName}"]`);
  if (toggleInput) {
    toggleInput.checked = active;
  }
}

function addTriggerToUI(trigger) {
  const triggerGrid = document.querySelector('.trigger-grid');
  if (!triggerGrid) return;
  
  const triggerItem = document.createElement('div');
  triggerItem.className = 'trigger-toggle-item';
  triggerItem.setAttribute('data-trigger', trigger.name);
  
  triggerItem.innerHTML = `
    <input type="checkbox" id="trigger-${trigger.name}" 
      class="toggle-input" 
      data-trigger="${trigger.name}" 
      ${trigger.active ? 'checked' : ''}>
    <label for="trigger-${trigger.name}" class="toggle-label">${trigger.name}</label>
  `;
  
  triggerGrid.appendChild(triggerItem);
  
  // Add event listener to the new toggle
  const toggleInput = triggerItem.querySelector('.toggle-input');
  toggleInput.addEventListener('change', function() {
    toggleTrigger(trigger.name, this.checked);
  });
}

function removeTriggerFromUI(triggerName) {
  const triggerItem = document.querySelector(`.trigger-toggle-item[data-trigger="${triggerName}"]`);
  if (triggerItem) {
    triggerItem.remove();
  }
}

function updateActiveTriggersDisplay(activeTriggerSession) {
  const activeTriggersEl = document.getElementById('active-triggers');
  if (!activeTriggersEl || !activeTriggerSession) return;
  
  if (!activeTriggerSession.activeTriggers || activeTriggerSession.activeTriggers.length === 0) {
    activeTriggersEl.innerHTML = '<p>No active triggers</p>';
    return;
  }
  
  // Create the list of active triggers
  const triggersList = document.createElement('ul');
  triggersList.className = 'active-triggers-list';
  
  activeTriggerSession.activeTriggers.forEach(trigger => {
    const item = document.createElement('li');
    item.textContent = trigger;
    triggersList.appendChild(item);
  });
  
  // Update the display
  activeTriggersEl.innerHTML = '';
  activeTriggersEl.appendChild(triggersList);
  
  // Add time info
  const timeInfo = document.createElement('p');
  timeInfo.className = 'time-info';
  const startTime = new Date(activeTriggerSession.startTime);
  const lastUpdated = new Date(activeTriggerSession.lastUpdated);
  
  timeInfo.textContent = `Session started: ${formatDate(startTime)} | Last updated: ${formatDate(lastUpdated)}`;
  activeTriggersEl.appendChild(timeInfo);
}

function updateTriggerHistoryDisplay(history) {
  const historyContainer = document.getElementById('trigger-history');
  if (!historyContainer) return;
  
  if (!history || history.length === 0) {
    historyContainer.innerHTML = '<p>No trigger history available</p>';
    return;
  }
  
  // Create the history display
  const historyList = document.createElement('ul');
  historyList.className = 'trigger-history-list';
  
  // Sort history by timestamp, newest first
  history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  history.forEach(event => {
    const item = document.createElement('li');
    const timestamp = new Date(event.timestamp);
    const triggers = Array.isArray(event.triggers) ? event.triggers.join(', ') : event.triggers;
    
    item.innerHTML = `
      <span class="timestamp">${formatDate(timestamp)}</span>
      <span class="triggers">${triggers}</span>
      <span class="source">${event.source || 'unknown'}</span>
    `;
    
    historyList.appendChild(item);
  });
  
  // Update the display
  historyContainer.innerHTML = '';
  historyContainer.appendChild(historyList);
}

function addTriggerEventToHistory(event) {
  const historyContainer = document.getElementById('trigger-history');
  if (!historyContainer) return;
  
  const historyList = historyContainer.querySelector('.trigger-history-list');
  if (!historyList) {
    // If no list exists yet, fetch entire history
    socket.emit('get-trigger-history', {
      username: document.body.getAttribute('data-username')
    });
    return;
  }
  
  // Add new event to the top of the list
  const item = document.createElement('li');
  const timestamp = new Date(event.timestamp);
  const triggers = Array.isArray(event.triggers) ? event.triggers.join(', ') : event.triggers;
  
  item.innerHTML = `
    <span class="timestamp">${formatDate(timestamp)}</span>
    <span class="triggers">${triggers}</span>
    <span class="source">${event.source || 'unknown'}</span>
  `;
  
  historyList.insertBefore(item, historyList.firstChild);
}

// Trigger action functions
function toggleTrigger(triggerName, active) {
  const username = document.body.getAttribute('data-username');
  if (!username || !socket || !socket.connected) return;
  
  socket.emit('toggle-trigger', {
    username,
    triggerName,
    active
  });
}

function toggleAllTriggers(active) {
  const username = document.body.getAttribute('data-username');
  if (!username || !socket || !socket.connected) return;
  
  socket.emit('toggle-all-triggers', {
    username,
    active
  });
}

function addTrigger(name, description = '', active = true) {
  const username = document.body.getAttribute('data-username');
  if (!username || !socket || !socket.connected) return;
  
  socket.emit('add-trigger', {
    username,
    name,
    description,
    active
  });
}

function deleteTrigger(triggerName) {
  const username = document.body.getAttribute('data-username');
  if (!username || !socket || !socket.connected) return;
  
  if (confirm(`Are you sure you want to delete trigger "${triggerName}"?`)) {
    socket.emit('delete-trigger', {
      username,
      triggerName
    });
  }
}

function loadTriggerHistory() {
  const username = document.body.getAttribute('data-username');
  if (!username || !socket || !socket.connected) return;
  
  socket.emit('get-trigger-history', { username });
}

// Helper function to format dates
function formatDate(date) {
  return new Date(date).toLocaleString();
}

// Play sound for trigger events
function playTriggerSound() {
  // Check if sound is enabled
  const soundEnabled = localStorage.getItem('triggerSoundEnabled') === 'true';
  if (!soundEnabled) return;
  
  const sound = document.getElementById('trigger-sound');
  if (sound) {
    sound.play().catch(e => console.log('Error playing sound:', e));
  }
}

// Create notification helper
function showNotification(message, type = 'info', duration = 5000) {
  // Get notification area or create it if it doesn't exist
  let notificationArea = document.getElementById('notification-area');
  
  if (!notificationArea) {
    notificationArea = document.createElement('div');
    notificationArea.id = 'notification-area';
    notificationArea.className = 'notification-area';
    document.body.appendChild(notificationArea);
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Add to notification area
  notificationArea.appendChild(notification);
  
  // Set timeout to remove
  setTimeout(() => {
    notification.classList.add('fade-out');
    notification.addEventListener('animationend', () => {
      notification.remove();
    });
  }, duration);
  
  return notification;
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function() {
  // Initialize socket connection
  const socketInstance = initSocket();
  
  // Set up trigger control buttons
  const activateAllBtn = document.getElementById('activate-all-btn');
  if (activateAllBtn) {
    activateAllBtn.addEventListener('click', () => toggleAllTriggers(true));
  }
  
  const deactivateAllBtn = document.getElementById('deactivate-all-btn');
  if (deactivateAllBtn) {
    deactivateAllBtn.addEventListener('click', () => toggleAllTriggers(false));
  }
  
  const addTriggerBtn = document.getElementById('add-trigger-btn');
  if (addTriggerBtn) {
    addTriggerBtn.addEventListener('click', () => {
      const name = prompt('Enter trigger name:');
      if (name) {
        const description = prompt('Enter trigger description (optional):');
        addTrigger(name, description);
      }
    });
  }
  
  const historyBtn = document.getElementById('load-history-btn');
  if (historyBtn) {
    historyBtn.addEventListener('click', loadTriggerHistory);
  }
  
  // Setup toggle sound control
  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) {
    // Set initial state
    const soundEnabled = localStorage.getItem('triggerSoundEnabled') === 'true';
    soundToggle.checked = soundEnabled;
    
    // Add change handler
    soundToggle.addEventListener('change', function() {
      localStorage.setItem('triggerSoundEnabled', this.checked);
    });
  }
  
  // Set up individual toggle inputs that might already be in the DOM
  document.querySelectorAll('.toggle-input').forEach(input => {
    input.addEventListener('change', function() {
      const triggerName = this.getAttribute('data-trigger');
      toggleTrigger(triggerName, this.checked);
    });
  });
  
  // Check if we should load trigger history on page load
  if (document.getElementById('trigger-history')) {
    loadTriggerHistory();
  }
});

// Expose for global use
window.socket = socket;
window.toggleTrigger = toggleTrigger;
window.toggleAllTriggers = toggleAllTriggers;
window.addTrigger = addTrigger;
window.deleteTrigger = deleteTrigger;
window.loadTriggerHistory = loadTriggerHistory;