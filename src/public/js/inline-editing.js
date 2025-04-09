function setupInlineEditing() {
  // Edit buttons
  const editButtons = document.querySelectorAll('.edit-field-btn');
  editButtons.forEach(button => {
    button.addEventListener('click', function() {
      const field = this.getAttribute('data-field');
      const displayEl = document.getElementById(`${field}-display`);
      const formEl = document.getElementById(`${field}-form`);
      
      // Hide display, show form
      displayEl.closest('.editable-field').style.display = 'none';
      formEl.style.display = 'block';
      
      // Focus on the input
      const inputEl = document.getElementById(field);
      if (inputEl) {
        inputEl.focus();
      }
    });
  });
  
  // Cancel buttons
  const cancelButtons = document.querySelectorAll('.cancel-edit-btn');
  cancelButtons.forEach(button => {
    button.addEventListener('click', function() {
      const field = this.getAttribute('data-field');
      const displayEl = document.getElementById(`${field}-display`);
      const formEl = document.getElementById(`${field}-form`);
      
      // Show display, hide form
      displayEl.closest('.editable-field').style.display = 'flex';
      formEl.style.display = 'none';
    });
  });
  
  // Save buttons with improved handling
  const saveButtons = document.querySelectorAll('.save-field-btn');
  saveButtons.forEach(button => {
    button.addEventListener('click', async function() {
      const field = this.getAttribute('data-field');
      const inputEl = document.getElementById(field);
      const value = inputEl.value;
      const username = document.body.getAttribute('data-username');
      
      // Show loading state
      this.disabled = true;
      this.innerHTML = '<span class="spinner"></span> Saving...';
      
      try {
        // Validate if needed
        if (inputEl.hasAttribute('required') && !value.trim()) {
          throw new Error(`${field} cannot be empty`);
        }
        
        // Special validation for specific fields
        if (field === 'avatar' || field === 'headerImage') {
          if (value && !validateURL(value)) {
            throw new Error('Please enter a valid URL');
          }
        }
        
        // Update via socket
        if (typeof socket !== 'undefined' && socket.connected) {
          const updateData = { username };
          updateData[field] = value;
          
          const response = await emitSocketPromise('update-profile', updateData);
          
          // Update the display value
          const displayEl = document.getElementById(`${field}-display`);
          
          if (field === 'about') {
            // For about field, handle links
            displayEl.innerHTML = value.replace(/https?:\/\/[^\s]+/g, '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>');
          } else {
            displayEl.innerHTML = value.replace(/https?:\/\/[^\s]+/g, '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>');
          }
          
          // Show display, hide form
          displayEl.closest('.editable-field').style.display = 'flex';
          document.getElementById(`${field}-form`).style.display = 'none';
          
          // Show success notification
          showNotification(response.message || `${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully`, 'success');
        } else {
          // Fallback to traditional AJAX
          const formData = new FormData();
          formData.append(field, value);
          formData.append('username', username);
          
          const response = await fetch(`/bambi/${username}/update`, {
            method: 'POST',
            body: formData,
            headers: {
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.message || 'Update failed');
          }
          
          // Update the display value (same as socket approach)
          const displayEl = document.getElementById(`${field}-display`);
          
          if (field === 'about') {
            displayEl.innerHTML = value.replace(/https?:\/\/[^\s]+/g, '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>');
          } else {
            displayEl.innerHTML = value.replace(/https?:\/\/[^\s]+/g, '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>');
          }
          
          // Show display, hide form
          displayEl.closest('.editable-field').style.display = 'flex';
          document.getElementById(`${field}-form`).style.display = 'none';
          
          // Show success notification
          showNotification(data.message || `${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully`, 'success');
        }
      } catch (error) {
        console.error(`Error updating ${field}:`, error);
        
        // Show error in form
        const errorEl = document.getElementById(`${field}-error`);
        if (errorEl) {
          errorEl.textContent = error.message || `Failed to update ${field}`;
          errorEl.style.display = 'block';
        } else {
          // Show notification if no error element
          showNotification(error.message || `Failed to update ${field}`, 'error');
        }
      } finally {
        // Restore button state
        this.disabled = false;
        this.textContent = 'Save';
      }
    });
  });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', setupInlineEditing);