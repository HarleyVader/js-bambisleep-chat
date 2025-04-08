document.addEventListener('DOMContentLoaded', () => {
  // Connect to Socket.io
  const socket = io();
  let currentField = null;
  
  // Get username from page
  const username = document.querySelector('.username').textContent.split('@')[1].trim().split(' ')[0];
  
  // Modal elements
  const modal = document.getElementById('edit-modal');
  const closeModal = document.querySelector('.close-modal');
  const editFieldContainer = document.getElementById('edit-field-container');
  const saveChangesBtn = document.getElementById('save-changes-btn');
  
  // Notification elements
  const notificationModal = document.getElementById('notification-modal');
  const closeNotificationModal = document.querySelector('.close-notification-modal');
  const notificationContainer = document.getElementById('notification-container');
  const notificationArea = document.getElementById('notification-area');
  
  // Setup edit buttons
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fieldName = btn.dataset.target;
      const fieldElement = document.getElementById(fieldName);
      
      openEditModal(fieldName, getFieldValue(fieldName, fieldElement));
    });
  });
  
  // Get field value based on field type
  function getFieldValue(fieldName, element) {
    if (fieldName === 'favoriteSeasons') {
      return Array.from(element.querySelectorAll('.season-tag')).map(tag => tag.textContent.trim());
    } else {
      return element.textContent.trim();
    }
  }
  
  // Open edit modal with appropriate editor
  function openEditModal(fieldName, fieldValue) {
    currentField = fieldName;
    document.getElementById('editing-field-name').textContent = formatFieldName(fieldName);
    
    // Create appropriate field editor based on field type
    let editorHTML = '';
    
    if (fieldName === 'bio') {
      editorHTML = `<textarea id="field-editor" class="field-editor" rows="5">${fieldValue}</textarea>`;
    } else if (fieldName === 'woodland') {
      editorHTML = `<input type="text" id="field-editor" class="field-editor" value="${fieldValue}">`;
    } else if (fieldName === 'favoriteSeasons') {
      editorHTML = `
        <div class="checkbox-group">
          <label><input type="checkbox" value="spring" ${fieldValue.includes('spring') ? 'checked' : ''}> Spring</label>
          <label><input type="checkbox" value="summer" ${fieldValue.includes('summer') ? 'checked' : ''}> Summer</label>
          <label><input type="checkbox" value="autumn" ${fieldValue.includes('autumn') ? 'checked' : ''}> Autumn</label>
          <label><input type="checkbox" value="winter" ${fieldValue.includes('winter') ? 'checked' : ''}> Winter</label>
        </div>
      `;
    } else {
      editorHTML = `<input type="text" id="field-editor" class="field-editor" value="${fieldValue}">`;
    }
    
    editFieldContainer.innerHTML = editorHTML;
    modal.style.display = 'block';
  }
  
  // Format field name for display
  function formatFieldName(fieldName) {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }
  
  // Close modal when clicking X
  closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
    if (e.target === notificationModal) {
      notificationModal.style.display = 'none';
    }
  });
  
  // Close notification modal when clicking X
  if (closeNotificationModal) {
    closeNotificationModal.addEventListener('click', () => {
      notificationModal.style.display = 'none';
    });
  }
  
  // Save changes when clicking save button
  saveChangesBtn.addEventListener('click', () => {
    let newValue;
    
    if (currentField === 'favoriteSeasons') {
      newValue = [];
      document.querySelectorAll('.checkbox-group input:checked').forEach(checkbox => {
        newValue.push(checkbox.value);
      });
    } else {
      const editor = document.getElementById('field-editor');
      newValue = editor.value.trim();
    }
    
    // Send to server via Socket.io
    socket.emit('profile:update', {
      field: currentField,
      value: newValue
    });
    
    modal.style.display = 'none';
  });
  
  // Handle profile updates from server
  socket.on('profile:updated', (data) => {
    const fieldElement = document.getElementById(data.field);
    
    if (data.field === 'favoriteSeasons') {
      fieldElement.innerHTML = '';
      data.value.forEach(season => {
        const span = document.createElement('span');
        span.className = 'season-tag';
        span.textContent = season;
        fieldElement.appendChild(span);
      });
    } else {
      fieldElement.textContent = data.value;
    }
    
    showNotification('Profile updated successfully!');
  });
  
  // Handle online users list
  socket.on('online:users', (users) => {
    document.querySelectorAll('.friend-chip').forEach(chip => {
      const friendId = chip.dataset.userId;
      const indicator = chip.querySelector('.online-indicator');
      
      if (indicator) {
        indicator.classList.toggle('online', users.includes(friendId));
        indicator.classList.toggle('offline', !users.includes(friendId));
      }
    });
  });
  
  // Handle friend coming online
  socket.on('user:online', (userId) => {
    const friendChips = document.querySelectorAll(`.friend-chip[data-user-id="${userId}"]`);
    friendChips.forEach(chip => {
      const indicator = chip.querySelector('.online-indicator');
      if (indicator) {
        indicator.classList.add('online');
        indicator.classList.remove('offline');
      }
    });
    
    showNotification('A forest friend has entered the woodland!');
  });
  
  // Handle friend going offline
  socket.on('user:offline', (userId) => {
    const friendChips = document.querySelectorAll(`.friend-chip[data-user-id="${userId}"]`);
    friendChips.forEach(chip => {
      const indicator = chip.querySelector('.online-indicator');
      if (indicator) {
        indicator.classList.remove('online');
        indicator.classList.add('offline');
      }
    });
  });
  
  // Handle friend profile update notifications
  socket.on('friend:profile:updated', (data) => {
    const fieldName = formatFieldName(data.field);
    showNotification(`${data.username} updated their ${fieldName}`);
  });
  
  // Handle friend request accepted notification
  socket.on('friend:request:accepted', (data) => {
    showNotification(`${data.username} accepted your friend request!`);
  });
  
  // Display notification function
  function showNotification(message) {
    if (!notificationArea) return;
    
    notificationArea.style.display = 'block';
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    notificationArea.appendChild(notification);
    
    // Remove notification after animation completes
    setTimeout(() => {
      notification.remove();
      if (notificationArea.children.length === 0) {
        notificationArea.style.display = 'none';
      }
    }, 4000);
  }
});