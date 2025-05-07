// Dashboard interface for session management
(function() {
  // Initialize dashboard controls
  function init() {
    // Attach event listeners to action buttons
    attachActionListeners();
    
    // Set up batch selection controls
    setupBatchControls();
    
    // Initialize the unified session module if available
    if (window.bambiSessions) {
      window.bambiSessions.init();
    }
  }
  
  // Attach event listeners to session action buttons
  function attachActionListeners() {
    // Share buttons
    document.querySelectorAll('.share-session-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const sessionId = this.getAttribute('data-session-id');
        shareSession(sessionId);
      });
    });
    
    // Edit buttons
    document.querySelectorAll('.edit-session-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const sessionId = this.getAttribute('data-session-id');
        editSessionTitle(sessionId);
      });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-session-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const sessionId = this.getAttribute('data-session-id');
        deleteSession(sessionId);
      });
    });
  }
  
  // Set up batch selection controls
  function setupBatchControls() {
    const selectAllCheckbox = document.getElementById('select-all-sessions');
    const sessionCheckboxes = document.querySelectorAll('.session-checkbox');
    const batchActionButtons = document.querySelectorAll('.batch-action-btn');
    
    // Select all checkbox
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', function() {
        const isChecked = this.checked;
        sessionCheckboxes.forEach(checkbox => {
          checkbox.checked = isChecked;
        });
        updateBatchActions();
      });
    }
    
    // Individual checkboxes
    sessionCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', updateBatchActions);
    });
    
    // Batch action buttons
    batchActionButtons.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const action = this.getAttribute('data-action');
        executeBatchAction(action);
      });
    });
    
    // Initial update
    updateBatchActions();
  }
  
  // Update batch action buttons state
  function updateBatchActions() {
    const sessionCheckboxes = document.querySelectorAll('.session-checkbox:checked');
    const batchActionButtons = document.querySelectorAll('.batch-action-btn');
    
    // Enable/disable batch action buttons based on selection
    batchActionButtons.forEach(btn => {
      btn.disabled = sessionCheckboxes.length === 0;
    });
    
    // Update count in button text
    const countElement = document.getElementById('selected-count');
    if (countElement) {
      countElement.textContent = sessionCheckboxes.length;
    }
  }
  
  // Execute batch action
  function executeBatchAction(action) {
    const selectedIds = Array.from(
      document.querySelectorAll('.session-checkbox:checked')
    ).map(checkbox => checkbox.value);
    
    if (selectedIds.length === 0) return;
    
    switch (action) {
      case 'delete':
        if (confirm(`Are you sure you want to delete ${selectedIds.length} selected sessions?`)) {
          batchDelete(selectedIds);
        }
        break;
      case 'share':
        batchShare(selectedIds);
        break;
      case 'export':
        exportSessions(selectedIds);
        break;
    }
  }
  
  // Share a session
  function shareSession(sessionId) {
    // Use our unified module if available
    if (window.bambiSessions && typeof window.bambiSessions.shareSession === 'function') {
      window.bambiSessions.shareSession(sessionId);
      return;
    }
    
    fetch(`/sessions/${sessionId}/share`, {
      method: 'POST'
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Show share URL
        alert(`Share this URL: ${data.shareUrl}`);
        
        // Copy to clipboard
        navigator.clipboard.writeText(data.shareUrl)
          .then(() => {
            showMessage('Share URL copied to clipboard!', 'success');
          })
          .catch(err => {
            console.error('Could not copy URL:', err);
          });
      } else {
        showMessage(`Failed to share: ${data.message}`, 'error');
      }
    })
    .catch(err => {
      console.error('Error sharing session:', err);
      showMessage('Error sharing session', 'error');
    });
  }
  
  // Edit session title
  function editSessionTitle(sessionId) {
    fetch(`/sessions/${sessionId}/details`, {
      method: 'GET'
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const newTitle = prompt('Enter new title:', data.title);
        
        if (newTitle !== null && newTitle.trim() !== '') {
          updateSessionTitle(sessionId, newTitle);
        }
      } else {
        showMessage(`Failed to get session details: ${data.message}`, 'error');
      }
    })
    .catch(err => {
      console.error('Error getting session details:', err);
      showMessage('Error loading session details', 'error');
    });
  }
  
  // Update session title
  function updateSessionTitle(sessionId, title) {
    fetch(`/sessions/${sessionId}/update-title`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showMessage('Title updated successfully', 'success');
        
        // Update title in the DOM
        const titleElement = document.querySelector(`.session-card[data-session-id="${sessionId}"] .card-title`);
        if (titleElement) {
          titleElement.textContent = title;
        }
      } else {
        showMessage(`Failed to update title: ${data.message}`, 'error');
      }
    })
    .catch(err => {
      console.error('Error updating session title:', err);
      showMessage('Error updating title', 'error');
    });
  }
  
  // Delete a session
  function deleteSession(sessionId) {
    // Use our unified module if available
    if (window.bambiSessions && typeof window.bambiSessions.deleteSession === 'function') {
      window.bambiSessions.deleteSession(sessionId);
      return;
    }
    
    if (!confirm('Are you sure you want to delete this session?')) return;
    
    fetch(`/sessions/${sessionId}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showMessage('Session deleted successfully', 'success');
        
        // Remove from DOM
        const sessionCard = document.querySelector(`.session-card[data-session-id="${sessionId}"]`);
        if (sessionCard) {
          sessionCard.remove();
        }
        
        // Update session count
        updateSessionCount();
      } else {
        showMessage(`Failed to delete: ${data.message}`, 'error');
      }
    })
    .catch(err => {
      console.error('Error deleting session:', err);
      showMessage('Error deleting session', 'error');
    });
  }
  
  // Batch delete sessions
  function batchDelete(sessionIds) {
    fetch('/sessions/batch/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionIds })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showMessage(data.message, 'success');
        
        // Remove deleted sessions from DOM
        sessionIds.forEach(id => {
          const sessionCard = document.querySelector(`.session-card[data-session-id="${id}"]`);
          if (sessionCard) {
            sessionCard.remove();
          }
        });
        
        // Reset checkboxes
        const selectAllCheckbox = document.getElementById('select-all-sessions');
        if (selectAllCheckbox) {
          selectAllCheckbox.checked = false;
        }
        
        // Update session count
        updateSessionCount();
      } else {
        showMessage(`Failed to delete sessions: ${data.message}`, 'error');
      }
    })
    .catch(err => {
      console.error('Error batch deleting sessions:', err);
      showMessage('Error deleting sessions', 'error');
    });
  }
  
  // Batch share sessions
  function batchShare(sessionIds) {
    fetch('/sessions/batch/share', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionIds })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showMessage(data.message, 'success');
        
        // Update UI to show shared status
        sessionIds.forEach(id => {
          const shareBtn = document.querySelector(`.session-card[data-session-id="${id}"] .share-session-btn`);
          if (shareBtn) {
            shareBtn.classList.add('shared');
            shareBtn.setAttribute('title', 'Session is shared');
          }
        });
      } else {
        showMessage(`Failed to share sessions: ${data.message}`, 'error');
      }
    })
    .catch(err => {
      console.error('Error batch sharing sessions:', err);
      showMessage('Error sharing sessions', 'error');
    });
  }
  
  // Export sessions
  function exportSessions(sessionIds) {
    // Create form for POST submission
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/sessions/export';
    
    // Add session IDs as hidden inputs
    sessionIds.forEach(id => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'sessionIds[]';
      input.value = id;
      form.appendChild(input);
    });
    
    // Add to document and submit
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }
  
  // Update session count display
  function updateSessionCount() {
    const sessionCards = document.querySelectorAll('.session-card');
    const countElement = document.getElementById('total-sessions-count');
    
    if (countElement) {
      countElement.textContent = sessionCards.length;
    }
  }
  
  // Show message notification
  function showMessage(message, type) {
    // Use notification function from unified sessions module if available
    if (window.bambiSessions && typeof window.bambiSessions.showNotification === 'function') {
      window.bambiSessions.showNotification(message, type);
      return;
    }
    
    // Otherwise create a simple notification
    const notificationContainer = document.querySelector('.notification-container') || 
                                  document.createElement('div');
    
    if (!document.body.contains(notificationContainer)) {
      notificationContainer.className = 'notification-container';
      document.body.appendChild(notificationContainer);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notificationContainer.appendChild(notification);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        notification.remove();
        
        // Remove container if empty
        if (notificationContainer.children.length === 0) {
          notificationContainer.remove();
        }
      }, 300);
    }, 4000);
  }
  
  // Initialize when the DOM is loaded
  document.addEventListener('DOMContentLoaded', init);
})();