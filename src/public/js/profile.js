document.addEventListener('DOMContentLoaded', () => {
  // Connect to Socket.io
  const socket = io();
  let currentField = null;
  
  // Get username from page if it exists
  const usernameEl = document.querySelector('.username');
  const username = usernameEl ? usernameEl.textContent.split('@')[1]?.trim().split(' ')[0] : null;
  
  // Modal elements - safely check if they exist
  const modal = document.getElementById('edit-modal');
  const closeModal = document.querySelector('.close-modal');
  const editFieldContainer = document.getElementById('edit-field-container');
  const saveChangesBtn = document.getElementById('save-changes-btn');
  
  // Notification elements - safely check if they exist
  const notificationModal = document.getElementById('notification-modal');
  const closeNotificationModal = document.querySelector('.close-notification-modal');
  const notificationArea = document.getElementById('notification-area');
  
  // Setup edit buttons only if they exist
  const editButtons = document.querySelectorAll('.edit-btn');
  if (editButtons.length > 0) {
    editButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const fieldName = btn.dataset.target;
        const fieldElement = document.getElementById(fieldName);
        
        if (fieldElement && modal) {
          openEditModal(fieldName, getFieldValue(fieldName, fieldElement));
        }
      });
    });
  }
  
  // Get field value based on field type
  function getFieldValue(fieldName, element) {
    if (!element) return '';
    
    if (fieldName === 'favoriteSeasons') {
      return Array.from(element.querySelectorAll('.season-tag')).map(tag => tag.textContent.trim());
    } else {
      return element.textContent.trim();
    }
  }
  
  // Open edit modal with appropriate editor - only if modal exists
  function openEditModal(fieldName, fieldValue) {
    if (!modal || !editFieldContainer) return;
    
    currentField = fieldName;
    const fieldNameEl = document.getElementById('editing-field-name');
    if (fieldNameEl) fieldNameEl.textContent = formatFieldName(fieldName);
    
    // Create appropriate field editor based on field type
    let editorHTML = '';
    
    if (fieldName === 'bio' || fieldName === 'description') {
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
  
  // Close modal when clicking X - only if closeModal exists
  if (closeModal) {
    closeModal.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });
  }
  
  // Close modal when clicking outside - only if modal exists
  window.addEventListener('click', (e) => {
    if (modal && e.target === modal) {
      modal.style.display = 'none';
    }
    if (notificationModal && e.target === notificationModal) {
      notificationModal.style.display = 'none';
    }
  });
  
  // Close notification modal when clicking X - only if closeNotificationModal exists
  if (closeNotificationModal) {
    closeNotificationModal.addEventListener('click', () => {
      if (notificationModal) notificationModal.style.display = 'none';
    });
  }
  
  // Save changes when clicking save button - only if saveChangesBtn exists
  if (saveChangesBtn) {
    saveChangesBtn.addEventListener('click', () => {
      if (!currentField || !socket) return;
      
      let newValue;
      
      if (currentField === 'favoriteSeasons') {
        newValue = [];
        document.querySelectorAll('.checkbox-group input:checked').forEach(checkbox => {
          newValue.push(checkbox.value);
        });
      } else {
        const editor = document.getElementById('field-editor');
        if (!editor) return;
        newValue = editor.value.trim();
      }
      
      // Send to server via Socket.io
      socket.emit('profile:update', {
        field: currentField,
        value: newValue
      });
      
      if (modal) modal.style.display = 'none';
    });
  }
  
  // Handle socket events only if we have a socket connection
  if (socket) {
    // Handle profile updates from server
    socket.on('profile:updated', (data) => {
      const fieldElement = document.getElementById(data.field);
      if (!fieldElement) return;
      
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
  }
  
  // Display notification function - only if notificationArea exists
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