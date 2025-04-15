/**
 * BambiSleep Profile JS
 * Combines functionality from:
 * - form-validation.js: Form validation utilities
 * - form-handler.js: AJAX and Socket.IO form submission
 * - inline-editing.js: In-place editing for profile fields
 */

// =============== FORM VALIDATION ===============

/**
 * Validates form inputs based on required attributes and data-validate types
 * @param {HTMLFormElement} form - The form to validate
 * @returns {boolean} - Whether the form is valid
 */
function validateForm(form) {
  const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
  let isValid = true;
  
  // Reset previous validation messages
  form.querySelectorAll('.validation-message').forEach(el => el.remove());
  
  inputs.forEach(input => {
    input.classList.remove('invalid-input');
    
    if (!input.value.trim()) {
      isValid = false;
      
      // Mark as invalid
      input.classList.add('invalid-input');
      
      // Add validation message
      const message = document.createElement('div');
      message.className = 'validation-message';
      message.textContent = `${input.getAttribute('data-label') || input.name} is required`;
      
      input.parentNode.appendChild(message);
    } else if (input.type === 'email' && !validateEmail(input.value)) {
      isValid = false;
      input.classList.add('invalid-input');
      
      const message = document.createElement('div');
      message.className = 'validation-message';
      message.textContent = 'Please enter a valid email address';
      
      input.parentNode.appendChild(message);
    } else if (input.getAttribute('data-validate') === 'url' && !validateURL(input.value)) {
      isValid = false;
      input.classList.add('invalid-input');
      
      const message = document.createElement('div');
      message.className = 'validation-message';
      message.textContent = 'Please enter a valid URL';
      
      input.parentNode.appendChild(message);
    }
  });
  
  return isValid;
}

/**
 * Validates an email address
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether the email is valid
 */
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validates a URL
 * @param {string} url - URL to validate
 * @returns {boolean} - Whether the URL is valid
 */
function validateURL(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

// =============== FORM HANDLERS ===============

/**
 * Universal form submission handler
 * Supports both socket.io and traditional form submissions
 */
function setupFormHandlers() {
  const forms = document.querySelectorAll('form[data-submit-method]');
  
  forms.forEach(form => {
    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      
      const submitMethod = this.getAttribute('data-submit-method');
      const endpoint = this.getAttribute('action') || '';
      const formData = new FormData(this);
      const submitBtn = this.querySelector('[type="submit"]');
      
      // Validate the form if validateForm function exists
      if (typeof validateForm === 'function' && !validateForm(this)) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = submitBtn.getAttribute('data-original-text') || 'Submit';
        }
        return;
      }
      
      // Disable submit button and show loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Processing...';
      }
      
      try {
        let response;
        
        // Determine submission method
        if (submitMethod === 'socket' && typeof socket !== 'undefined' && socket.connected) {
          // Socket submission
          const formObject = {};
          formData.forEach((value, key) => {
            formObject[key] = value;
          });
          
          // Add username if available
          const username = document.body.getAttribute('data-username');
          if (username) formObject.username = username;
          
          // Get event name from form attribute or default to update-profile
          const eventName = this.getAttribute('data-socket-event') || 'update-profile';
          
          response = await emitSocketPromise(eventName, formObject);
          handleSuccess(response, this);
        } else {
          // Traditional AJAX submission
          response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            headers: {
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.message || 'Form submission failed');
          }
          
          handleSuccess(data, this);
        }
      } catch (error) {
        handleError(error, this);
      } finally {
        // Re-enable submit button
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = submitBtn.getAttribute('data-original-text') || 'Submit';
        }
      }
    });
    
    // Store original button text
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.setAttribute('data-original-text', submitBtn.innerHTML);
    }
  });
}

/**
 * Convert socket.emit to Promise
 * @param {string} event - Socket event name
 * @param {object} data - Data to send
 * @returns {Promise} - Promise that resolves with response
 */
function emitSocketPromise(event, data) {
  return new Promise((resolve, reject) => {
    if (typeof socket === 'undefined' || !socket.connected) {
      reject(new Error('Socket not connected'));
      return;
    }
    
    socket.emit(event, data, (response) => {
      if (response && response.success === false) {
        reject(new Error(response.message || 'Operation failed'));
      } else {
        resolve(response);
      }
    });
    
    // Add timeout
    setTimeout(() => {
      reject(new Error('Socket request timed out'));
    }, 10000);
  });
}

/**
 * Handle successful form submission
 * @param {object} response - Response from server
 * @param {HTMLFormElement} form - The form that was submitted
 */
function handleSuccess(response, form) {
  // Show success message
  showNotification(response.message || 'Changes saved successfully', 'success');
  
  // Check if form should be reset after submission
  if (form.getAttribute('data-reset-on-submit') === 'true') {
    form.reset();
  }
  
  // Check if we should redirect
  const redirectUrl = response.redirectUrl || form.getAttribute('data-redirect');
  if (redirectUrl) {
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 1500);
  }
  
  // Execute any custom callback
  const customCallback = form.getAttribute('data-success-callback');
  if (customCallback && window[customCallback]) {
    window[customCallback](response, form);
  }
}

/**
 * Handle form submission errors
 * @param {Error} error - Error object
 * @param {HTMLFormElement} form - The form that was submitted
 */
function handleError(error, form) {
  console.error('Form submission error:', error);
  
  // Show error notification
  showNotification(error.message || 'An error occurred', 'error');
  
  // Update any error elements in the form
  const errorContainer = form.querySelector('.form-errors');
  if (errorContainer) {
    errorContainer.textContent = error.message || 'An error occurred';
    errorContainer.style.display = 'block';
  }
  
  // Execute any custom error callback
  const errorCallback = form.getAttribute('data-error-callback');
  if (errorCallback && window[errorCallback]) {
    window[errorCallback](error, form);
  }
}

/**
 * Show a notification message
 * @param {string} message - Message to display
 * @param {string} type - Notification type (success, error, info, warning)
 * @param {number} duration - Duration in milliseconds
 * @returns {HTMLElement} - The notification element
 */
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

// =============== INLINE EDITING ===============

/**
 * Set up inline editing functionality for profile fields
 */
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
            displayEl.textContent = value || `Default ${field.charAt(0).toUpperCase() + field.slice(1)}`;
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
          
          const response = await fetch(`/profile/${username}/update`, {
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
            displayEl.textContent = value || `Default ${field.charAt(0).toUpperCase() + field.slice(1)}`;
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

// Initialize on DOM load - Setup form handlers and inline editing
document.addEventListener('DOMContentLoaded', function() {
  // Initialize form handlers
  setupFormHandlers();
  
  // Initialize inline editing if on profile page
  if (document.querySelector('.editable-field')) {
    setupInlineEditing();
  }
  
  // Setup character counters for textareas
  const limitedTextareas = document.querySelectorAll('textarea[maxlength]');
  limitedTextareas.forEach(textarea => {
    const maxLength = parseInt(textarea.getAttribute('maxlength'));
    const counterEl = document.createElement('div');
    counterEl.className = 'char-counter';
    counterEl.textContent = `${textarea.value.length}/${maxLength}`;
    
    textarea.parentNode.appendChild(counterEl);
    
    textarea.addEventListener('input', function() {
      counterEl.textContent = `${this.value.length}/${maxLength}`;
      
      // Update color based on length
      if (this.value.length > maxLength * 0.9) {
        counterEl.style.color = 'var(--error)';
      } else if (this.value.length > maxLength * 0.7) {
        counterEl.style.color = 'var(--button-color)';
      } else {
        counterEl.style.color = 'var(--primary-alt)';
      }
    });
  });
  
  // Make enter key submit inline edit forms
  const inlineInputs = document.querySelectorAll('.inline-form input');
  inlineInputs.forEach(input => {
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const saveBtn = this.closest('form').querySelector('.save-field-btn');
        if (saveBtn) {
          saveBtn.click();
        }
      }
    });
  });
});

// Make the functions available globally
window.validateForm = validateForm;
window.validateEmail = validateEmail;
window.validateURL = validateURL;
window.showNotification = showNotification;
window.emitSocketPromise = emitSocketPromise;