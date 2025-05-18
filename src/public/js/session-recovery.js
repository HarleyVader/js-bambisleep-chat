/**
 * Session Recovery Handler
 * Manages notification and recovery of abandoned chat sessions
 */
document.addEventListener('DOMContentLoaded', function() {
  // Get socket instance
  const socket = window.socket || io();
  
  // Set up event listeners for session recovery
  socket.on('recoverable-sessions', function(data) {
    if (!data || !data.sessions || !data.sessions.length) return;
    
    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById('recovery-notification');
    if (!notificationContainer) {
      notificationContainer = document.createElement('div');
      notificationContainer.id = 'recovery-notification';
      notificationContainer.className = 'session-recovery';
      document.body.appendChild(notificationContainer);
    }
    
    // Create notification content
    createRecoveryNotification(notificationContainer, data.sessions);
  });
  
  // Listen for session recovery confirmation
  socket.on('session-recovered', function(data) {
    if (!data || !data.success) return;
    
    // Remove the recovery notification
    const notification = document.getElementById('recovery-notification');
    if (notification) {
      notification.remove();
    }
    
    // Show success message
    showMessage('Session recovered successfully!', 'success');
    
    // Load the recovered session
    socket.emit('load-session', data.sessionId);
  });
  
  /**
   * Create notification for recoverable sessions
   * 
   * @param {HTMLElement} container - Container to add notification to
   * @param {Array} sessions - Array of recoverable sessions
   */
  function createRecoveryNotification(container, sessions) {
    // Clear container
    container.innerHTML = '';
    
    // Add icon
    const icon = document.createElement('div');
    icon.className = 'session-recovery-icon';
    icon.innerHTML = '↺';
    container.appendChild(icon);
    
    // Add content
    const content = document.createElement('div');
    content.className = 'session-recovery-content';
    
    // Add title
    const title = document.createElement('div');
    title.className = 'session-recovery-title';
    title.textContent = `Found ${sessions.length} inactive session${sessions.length > 1 ? 's' : ''}`;
    content.appendChild(title);
    
    // Add description
    const description = document.createElement('div');
    description.textContent = 'Would you like to recover one of your previous chat sessions?';
    content.appendChild(description);
    
    // Add session list
    const sessionList = document.createElement('div');
    sessionList.className = 'session-recovery-list';
    
    sessions.forEach(session => {
      const sessionItem = document.createElement('div');
      sessionItem.className = 'session-recovery-item';
      
      // Format last activity time
      const lastActivityDate = new Date(session.lastActivity);
      const formattedTime = lastActivityDate.toLocaleString();
      
      sessionItem.innerHTML = `
        <span>${session.title || 'Untitled Session'}</span>
        <span>${session.messageCount} messages</span>
        <span>Last active: ${formattedTime}</span>
        <button class="session-recovery-button" data-id="${session.id}">Recover</button>
      `;
      
      sessionList.appendChild(sessionItem);
    });
    
    content.appendChild(sessionList);
    container.appendChild(content);
    
    // Add actions
    const actions = document.createElement('div');
    actions.className = 'session-recovery-actions';
    
    // Add dismiss button
    const dismissButton = document.createElement('button');
    dismissButton.className = 'session-recovery-button';
    dismissButton.textContent = 'Dismiss';
    dismissButton.addEventListener('click', function() {
      container.remove();
    });
    
    actions.appendChild(dismissButton);
    container.appendChild(actions);
    
    // Add event listeners to recover buttons
    const recoverButtons = container.querySelectorAll('.session-recovery-button[data-id]');
    recoverButtons.forEach(button => {
      button.addEventListener('click', function() {
        const sessionId = this.getAttribute('data-id');
        if (sessionId) {
          socket.emit('recover-session', { sessionId });
        }
      });
    });
    
    // Add animation
    container.style.animation = 'fadeIn 0.3s';
  }
  
  /**
   * Show a message to the user
   * 
   * @param {string} message - Message to show
   * @param {string} type - Message type (success, error, info)
   */
  function showMessage(message, type = 'info') {
    // Check if message container exists
    let messageContainer = document.getElementById('message-container');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.id = 'message-container';
      document.body.appendChild(messageContainer);
    }
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    
    // Add to container
    messageContainer.appendChild(messageElement);
    
    // Remove after delay
    setTimeout(() => {
      messageElement.style.opacity = '0';
      setTimeout(() => {
        messageElement.remove();
      }, 500);
    }, 3000);
  }
});
