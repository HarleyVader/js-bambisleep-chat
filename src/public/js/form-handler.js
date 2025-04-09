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
          
          // Get event name from form attribute or default to update-bambi
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

// Convert socket.emit to Promise
function emitSocketPromise(event, data) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Socket request timed out'));
    }, 5000);
    
    socket.emit(event, data, (response) => {
      clearTimeout(timeout);
      if (response && response.success) {
        resolve(response);
      } else {
        reject(new Error(response?.message || 'Socket request failed'));
      }
    });
  });
}

// Handle successful form submission
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

// Handle form submission errors
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

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', setupFormHandlers);