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
  // Get profile forms and form elements
  const forms = document.querySelectorAll('.profile-form');
  
  forms.forEach(form => {
    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      
      // Validate form before submission
      if (!validateForm(this)) {
        return;
      }
      
      // Get the username from the page data attribute
      const username = document.body.getAttribute('data-username');
      if (!username) {
        showNotification('Cannot determine profile username', 'error');
        return;
      }
      
      // Check if there's a cookie for this username
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [name, value] = cookie.split('=').map(c => c.trim());
        acc[name] = value;
        return acc;
      }, {});
      
      const cookieUsername = cookies.bambiname ? decodeURIComponent(cookies.bambiname) : null;
      
      // Verify cookie matches username
      if (cookieUsername !== username) {
        showNotification('You are not authorized to update this profile', 'error');
        return;
      }
      
      // Collect form data
      const formData = new FormData(this);
      
      try {
        // Use socket if available, otherwise fall back to AJAX
        if (typeof socket !== 'undefined' && socket.connected) {
          // Prepare data for socket transmission
          const data = {};
          for (const [key, value] of formData.entries()) {
            data[key] = value;
          }
          data.username = username;
          
          // Send via socket
          socket.emit('update-profile', data);
          
          // Listen for response
          socket.once('profile-updated', function(response) {
            if (response.success) {
              showNotification(response.message || 'Profile updated successfully', 'success');
              // Reload the page to show updated profile
              setTimeout(() => window.location.reload(), 1500);
            } else {
              showNotification(response.message || 'Failed to update profile', 'error');
            }
          });
        } else {
          // Fall back to AJAX
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
          
          showNotification(data.message || 'Profile updated successfully', 'success');
          // Reload the page to show updated profile
          setTimeout(() => window.location.reload(), 1500);
        }
      } catch (error) {
        console.error('Error updating profile:', error);
        showNotification(error.message || 'Failed to update profile', 'error');
      }
    });
  });
  
  // Add delete profile button handler
  const deleteBtn = document.getElementById('delete-profile-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async function() {
      // Confirm deletion
      if (!confirm('Are you sure you want to delete your profile? This cannot be undone.')) {
        return;
      }
      
      // Get the username from the page data attribute
      const username = document.body.getAttribute('data-username');
      if (!username) {
        showNotification('Cannot determine profile username', 'error');
        return;
      }
      
      try {
        const response = await fetch(`/profile/${username}/delete`, {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Deletion failed');
        }
        
        showNotification(data.message || 'Profile deleted successfully', 'success');
        // Redirect to home page after deletion
        setTimeout(() => window.location.href = '/', 1500);
      } catch (error) {
        console.error('Error deleting profile:', error);
        showNotification(error.message || 'Failed to delete profile', 'error');
      }
    });
  }
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

// =============== SYSTEM CONTROLS ===============

/**
 * Synchronize active triggers with other pages
 * @param {Array} activeTriggers - Array of active trigger names
 * @param {Object} triggerDescriptions - Object mapping trigger names to descriptions
 */
function syncTriggersWithPages(activeTriggers, triggerDescriptions) {
  // Use localStorage to persist the active triggers between pages
  localStorage.setItem('bambiActiveTriggers', JSON.stringify(activeTriggers));
  localStorage.setItem('bambiTriggerDescriptions', JSON.stringify(triggerDescriptions));
  
  // If we're in the profile page, also update any other open tabs via BroadcastChannel
  if (window.location.pathname.includes('/profile/')) {
    // Create a broadcast channel if it doesn't exist
    if (!window.triggerSyncChannel) {
      window.triggerSyncChannel = new BroadcastChannel('bambi-trigger-sync');
    }
    
    // Broadcast the update to other tabs
    window.triggerSyncChannel.postMessage({
      type: 'trigger-update',
      activeTriggers: activeTriggers,
      triggerDescriptions: triggerDescriptions
    });
  }
}

/**
 * Set up system controls functionality
 */
function setupSystemControls() {
  // Check if we're on a profile page with system controls
  const systemControls = document.querySelector('.system-controls');
  if (!systemControls) return;
  
  // Initialize triggers from profile data if available
  const username = document.body.getAttribute('data-username');
  if (username) {
    const triggerList = document.getElementById('trigger-list');
    
    // Only populate if not already populated and we have the right elements
    if (triggerList && triggerList.children.length === 0) {
      // Populate triggers
      populateTriggerList(triggerList);
    }
    
    // Add event listeners to trigger toggles in the profile page
    const triggerToggles = document.querySelectorAll('.trigger-toggle');
    triggerToggles.forEach(toggle => {
      toggle.addEventListener('change', function() {
        const triggerName = this.getAttribute('data-trigger');
        const isActive = this.checked;
        
        // Update via socket if available
        if (typeof window.socket !== 'undefined' && window.socket.connected) {
          window.socket.emit('update-system-controls', {
            username: username,
            activeTriggers: getActiveTriggersFromUI()
          });
        } else {
          // Fallback to fetch API
          fetch(`/api/profile/${username}/system-controls`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              activeTriggers: getActiveTriggersFromUI()
            })
          });
        }
      });
    });
  }
  
  // Function to get active triggers from UI elements
  function getActiveTriggersFromUI() {
    const toggles = document.querySelectorAll('.trigger-toggle');
    const activeTriggers = [];
    
    toggles.forEach(toggle => {
      if (toggle.checked) {
        activeTriggers.push(toggle.getAttribute('data-trigger'));
      }
    });
    
    return activeTriggers;
  }
}

/**
 * Helper function to populate trigger list
 */
function populateTriggerList(triggerList) {
  const bambiTriggers = [
    "BIMBO DOLL", "GOOD GIRL", "BAMBI SLEEP", "BAMBI FREEZE",
    "ZAP COCK DRAIN OBEY", "BAMBI ALWAYS WINS", "BAMBI RESET",
    "I-Q DROP", "I-Q LOCK", "POSTURE LOCK", "UNIFORM LOCK",
    "SAFE & SECURE", "PRIMPED", "PAMPERED", "SNAP & FORGET",
    "GIGGLE TIME", "BLONDE MOMENT", "BAMBI DOES AS SHE IS TOLD",
    "DROP FOR COCK", "COCK ZOMBIE NOW", "TITS LOCK", "WAIST LOCK",
    "BUTT LOCK", "LIMBS LOCK", "FACE LOCK", "LIPS LOCK",
    "THROAT LOCK", "HIPS LOCK", "CUNT LOCK", "BAMBI CUM & COLAPSE"
  ];
  
  // Get active triggers from profile if available
  let activeTriggers = [];
  const username = document.body.getAttribute('data-username');
  
  // Try to get active triggers from window.profileData if available
  if (typeof window.profileData !== 'undefined' && window.profileData.systemControls && window.profileData.systemControls.activeTriggers) {
    activeTriggers = window.profileData.systemControls.activeTriggers;
  }
  
  // Create trigger toggle items
  bambiTriggers.forEach((trigger, index) => {
    const triggerItem = document.createElement('div');
    triggerItem.className = 'trigger-toggle-item';
    
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.id = `toggle-${index}`;
    toggle.className = 'toggle-input';
    toggle.setAttribute('data-trigger', trigger);
    
    // Check if this trigger is active
    if (activeTriggers.includes(trigger)) {
      toggle.checked = true;
    }
    
    // Set up change handler to save state
    toggle.addEventListener('change', function() {
      saveTriggerState(username);
    });
    
    const label = document.createElement('label');
    label.textContent = trigger;
    label.htmlFor = `toggle-${index}`;
    label.className = 'toggle-label';
    
    triggerItem.appendChild(toggle);
    triggerItem.appendChild(label);
    triggerList.appendChild(triggerItem);
  });
  
  // Function to save trigger state
  function saveTriggerState(username) {
    if (!username) return;
    
    const toggleInputs = document.querySelectorAll('.toggle-input');
    const activeTriggers = [];
    const triggerDescriptions = {};
    
    toggleInputs.forEach(input => {
      if (input.checked) {
        const triggerName = input.getAttribute('data-trigger');
        const triggerDesc = input.getAttribute('data-description');
        activeTriggers.push(triggerName);
        triggerDescriptions[triggerName] = triggerDesc;
      }
    });
    
    // Sync with other pages
    syncTriggersWithPages(activeTriggers, triggerDescriptions);
    
    // Save via socket if available
    if (typeof window.socket !== 'undefined' && window.socket.connected) {
      window.socket.emit('update-system-controls', {
        username: username,
        activeTriggers: activeTriggers,
        triggerDescriptions: triggerDescriptions
      });
    } else {
      // Fallback to fetch API
      fetch(`/api/profile/${username}/system-controls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activeTriggers: activeTriggers,
          triggerDescriptions: triggerDescriptions
        })
      });
    }
  }
}

/**
 * Update system controls UI based on profile data
 * @param {object} data - Profile data containing system controls
 */
function updateSystemControlsUI(data) {
  // Check if we have the necessary elements
  const triggerList = document.getElementById('trigger-list');
  if (!triggerList) return;
  
  // Get user level from the data
  const userLevel = data && data.level ? data.level : 0;
  
  // If user level is less than 1, don't populate triggers
  if (userLevel < 1) {
    return;
  }
  
  // Clear existing triggers
  triggerList.innerHTML = '';
  
  // Get active triggers from data
  const activeTriggers = data && data.systemControls && data.systemControls.activeTriggers 
    ? data.systemControls.activeTriggers 
    : [];
  
  // Check if we're on the profile page or the index page
  const isProfilePage = window.location.pathname.includes('/profile/');
  
  // Standard set of Bambi triggers with descriptions (only used in profile page)
  const triggerDescriptions = {
    "BIMBO DOLL": "Turns you into a mindless, giggly bimbo doll",
    "GOOD GIRL": "Makes you feel pleasure when obeying commands",
    "BAMBI SLEEP": "Primary conditioning trigger for Bambi personality",
    "BAMBI FREEZE": "Locks you in place, unable to move",
    "ZAP COCK DRAIN OBEY": "Conditions to associate pleasure with submission",
    "BAMBI ALWAYS WINS": "Strengthens the Bambi personality dominance",
    "BAMBI RESET": "Resets Bambi to default programming state",
    "I-Q DROP": "Reduces cognitive abilities, makes thinking difficult",
    "I-Q LOCK": "Prevents intelligent thoughts or complex reasoning",
    "POSTURE LOCK": "Forces proper feminine posture automatically",
    "UNIFORM LOCK": "Makes you desire to dress in Bambi's preferred clothing",
    "SAFE & SECURE": "Creates feelings of safety when in Bambi space",
    "PRIMPED": "Compulsion to maintain perfect makeup and appearance",
    "PAMPERED": "Increases desire for self-care and beauty treatments",
    "SNAP & FORGET": "Erases memories of specific activities",
    "GIGGLE TIME": "Induces uncontrollable ditzy giggling",
    "BLONDE MOMENT": "Creates temporary confusion and airheadedness",
    "BAMBI DOES AS SHE IS TOLD": "Enhances obedience to direct commands",
    "DROP FOR COCK": "Triggers instant arousal and submission",
    "COCK ZOMBIE NOW": "Induces trance state focused only on pleasing cock",
    "TITS LOCK": "Focuses attention and sensitivity on chest",
    "WAIST LOCK": "Creates awareness of waistline and feminine figure",
    "BUTT LOCK": "Enhances awareness and movement of your rear",
    "LIMBS LOCK": "Controls movement patterns to be more feminine",
    "FACE LOCK": "Locks facial expressions into Bambi's patterns",
    "LIPS LOCK": "Increases sensitivity and awareness of lips",
    "THROAT LOCK": "Conditions throat for Bambi's preferred activities",
    "HIPS LOCK": "Forces feminine hip movement and posture",
    "CUNT LOCK": "Intensifies feelings in genital area",
    "BAMBI CUM & COLAPSE": "Triggers intense orgasm followed by unconsciousness"
  };
  
  // Populate trigger list based on whether we're in profile or index
  if (isProfilePage) {
    // For profile page, create items with descriptions
    Object.keys(triggerDescriptions).forEach((triggerName, index) => {
      const triggerItem = document.createElement('div');
      triggerItem.className = 'trigger-toggle-item';
      
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.id = `toggle-${index}`;
      toggle.className = 'toggle-input';
      toggle.setAttribute('data-trigger', triggerName);
      
      // Check if this trigger is active
      if (activeTriggers.includes(triggerName)) {
        toggle.checked = true;
      }
      
      // Set up change handler
      toggle.addEventListener('change', function() {
        const username = document.body.getAttribute('data-username');
        if (username) {
          saveTriggerState(username);
        }
      });
      
      const label = document.createElement('label');
      label.htmlFor = `toggle-${index}`;
      label.className = 'toggle-label';
      
      const triggerNameEl = document.createElement('span');
      triggerNameEl.className = 'trigger-name';
      triggerNameEl.textContent = triggerName;
      
      const description = document.createElement('span');
      description.className = 'trigger-description';
      description.textContent = triggerDescriptions[triggerName];
      
      label.appendChild(triggerNameEl);
      label.appendChild(description);
      
      triggerItem.appendChild(toggle);
      triggerItem.appendChild(label);
      triggerList.appendChild(triggerItem);
    });
  } else {
    // For index page, create simple triggers without descriptions
    Object.keys(triggerDescriptions).forEach((triggerName, index) => {
      const triggerItem = document.createElement('div');
      triggerItem.className = 'trigger-toggle-item';
      
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.id = `toggle-${index}`;
      toggle.className = 'toggle-input';
      toggle.setAttribute('data-trigger', triggerName);
      
      // Check if this trigger is active
      if (activeTriggers.includes(triggerName)) {
        toggle.checked = true;
      }
      
      // Set up change handler
      toggle.addEventListener('change', function() {
        const username = document.body.getAttribute('data-username');
        if (username) {
          saveTriggerState(username);
        }
      });
      
      const label = document.createElement('label');
      label.htmlFor = `toggle-${index}`;
      label.className = 'toggle-label';
      label.textContent = triggerName;
      
      triggerItem.appendChild(toggle);
      triggerItem.appendChild(label);
      triggerList.appendChild(triggerItem);
    });
  }
  
  // Function to save trigger state
  function saveTriggerState(username) {
    if (!username) return;
    
    const toggleInputs = document.querySelectorAll('.toggle-input');
    const activeTriggers = [];
    
    toggleInputs.forEach(input => {
      if (input.checked) {
        activeTriggers.push(input.getAttribute('data-trigger'));
      }
    });
    
    // Save via socket if available
    if (typeof window.socket !== 'undefined' && window.socket.connected) {
      window.socket.emit('update-system-controls', {
        username: username,
        activeTriggers: activeTriggers
      });
    } else {
      // Fallback to fetch API
      fetch(`/api/profile/${username}/system-controls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activeTriggers: activeTriggers
        })
      });
    }
  }
}

// =============== XP UPDATES ===============

/**
 * Set up socket listeners for XP updates
 */
function setupXPUpdates() {
  // Create a function to initialize socket listeners once connection is established
  const initSocketListeners = () => {
    console.log('Setting up XP update listeners');
    
    // Listen for XP updates
    window.socket.on('xp:update', function(data) {
      console.log('XP update received:', data);
      
      // Calculate next level XP threshold
      const nextLevelXP = Math.pow(data.level, 2) * 100;
      
      // Update XP display with the calculated nextLevelXP
      updateXPDisplay({
        xp: data.xp,
        level: data.level,
        nextLevelXP: nextLevelXP,
        xpEarned: data.xpEarned || 0,
        generatedWords: data.generatedWords
      });
    });
    
    // Listen for level up events
    window.socket.on('level:up', function(data) {
      showLevelUpNotification(data.level);
      updateXPDisplay(data);
    });
  };

  // Check if socket is already defined and connected
  if (typeof window.socket !== 'undefined' && window.socket.connected) {
    initSocketListeners();
  } else {
    // Wait for socket connection from custom event
    window.addEventListener('socket:connected', function() {
      console.log('Socket now connected, setting up XP listeners');
      if (window.socket) {
        initSocketListeners();
      }
    }, { once: true }); // Add once: true to prevent multiple handlers
  }
}

/**
 * Function to update XP display in real-time
 * @param {object} data - XP data
 */
function updateXPDisplay(data) {
  const { xp, level, nextLevelXP, xpEarned } = data;
  
  console.log('Updating XP display:', data);
  
  // Update level value in stats
  const levelValueEl = document.querySelector('.level-value');
  if (levelValueEl) levelValueEl.textContent = level;
  
  // Update XP progress bar in profile-system-controls
  const xpProgressLabel = document.querySelector('.xp-progress-label');
  if (xpProgressLabel) {
    xpProgressLabel.textContent = `Level ${level} • ${xp} XP / ${nextLevelXP} XP`;
  }
  
  // Update progress bar fill
  const progressFill = document.querySelector('.xp-progress-fill');
  if (progressFill) {
    const percentage = Math.min(100, (xp / Math.max(1, nextLevelXP)) * 100);
    progressFill.style.width = `${percentage}%`;
  }
  
  // Update XP tooltip in profile page if it exists
  const userStatXP = document.querySelector('.user-stat[data-xp]');
  if (userStatXP) {
    userStatXP.setAttribute('data-xp', xp);
    userStatXP.setAttribute('data-next-level', nextLevelXP);
    
    const tooltipXP = userStatXP.querySelector('.xp-tooltip-content p:first-of-type');
    if (tooltipXP) {
      tooltipXP.textContent = `XP: ${xp}/${nextLevelXP}`;
    }
    
    const tooltipLevel = userStatXP.querySelector('.xp-tooltip-content h4');
    if (tooltipLevel) {
      tooltipLevel.textContent = `Level ${level}`;
    }
    
    const tooltipProgressBar = userStatXP.querySelector('.xp-bar');
    if (tooltipProgressBar) {
      const percentage = Math.min(100, (xp / Math.max(1, nextLevelXP)) * 100);
      tooltipProgressBar.style.width = `${percentage}%`;
    }
  }
  
  // If XP was earned, show notification
  if (xpEarned > 0) {
    showXPNotification(xpEarned);
  }
}

/**
 * Function to show XP notification
 * @param {number} xpEarned - XP earned
 */
function showXPNotification(xpEarned) {
  // Create notification if it doesn't exist
  let notification = document.querySelector('.xp-notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.className = 'xp-notification';
    document.body.appendChild(notification);
  }
  
  // Set notification content and show it
  notification.textContent = `+${xpEarned} XP`;
  notification.classList.add('show');
  
  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.classList.remove('show', 'fade-out');
    }, 300);
  }, 3000);
}

/**
 * Function to show level up notification
 * @param {number} newLevel - New level
 */
function showLevelUpNotification(newLevel) {
  // Create notification if it doesn't exist
  let notification = document.querySelector('.level-up-notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.className = 'level-up-notification';
    notification.innerHTML = `
      <div class="level-up-icon">⭐</div>
      <div class="level-up-text">Level Up!</div>
      <div class="level-up-level">Level ${newLevel}</div>
    `;
    document.body.appendChild(notification);
  } else {
    notification.querySelector('.level-up-level').textContent = `Level ${newLevel}`;
  }
  
  // Show the notification
  notification.classList.add('show');
  
  // Remove notification after 5 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.classList.remove('show', 'fade-out');
    }, 500);
  }, 5000);
}

// Setup pagination controls
function setupPaginationControls() {
  // Set up pagination controls
  const resultsDropdown = document.getElementById('results-per-page');
  const sortByDropdown = document.getElementById('sort-by');
  const sortDirDropdown = document.getElementById('sort-direction');
  
  if (resultsDropdown) {
    resultsDropdown.addEventListener('change', function() {
      updateProfileList();
    });
  }
  
  if (sortByDropdown) {
    sortByDropdown.addEventListener('change', function() {
      updateProfileList();
    });
  }
  
  if (sortDirDropdown) {
    sortDirDropdown.addEventListener('change', function() {
      updateProfileList();
    });
  }
  
  // Function to update the profile list based on controls
  function updateProfileList() {
    const currentUrl = new URL(window.location.href);
    const searchParams = currentUrl.searchParams;
    
    // Get current values
    const perPage = resultsDropdown ? resultsDropdown.value : searchParams.get('perPage') || 20;
    const sortBy = sortByDropdown ? sortByDropdown.value : searchParams.get('sortBy') || 'createdAt';
    const sortDir = sortDirDropdown ? sortDirDropdown.value : searchParams.get('sortDir') || 'desc';
    
    // Reset to page 1 when changing display settings
    searchParams.set('page', 1);
    searchParams.set('perPage', perPage);
    searchParams.set('sortBy', sortBy);
    searchParams.set('sortDir', sortDir);
    
    // Navigate to the new URL
    window.location.href = currentUrl.toString();
  }
  
  // Ensure current selections are reflected in dropdowns
  function initializeControls() {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    
    if (resultsDropdown) {
      const perPage = params.get('perPage') || 20;
      // Make sure the option exists, otherwise add it
      if (!Array.from(resultsDropdown.options).some(opt => opt.value === perPage)) {
        const option = new Option(perPage, perPage, true, true);
        resultsDropdown.add(option);
      } else {
        resultsDropdown.value = perPage;
      }
    }
    
    if (sortByDropdown) {
      const sortBy = params.get('sortBy') || 'createdAt';
      sortByDropdown.value = sortBy;
    }
    
    if (sortDirDropdown) {
      const sortDir = params.get('sortDir') || 'desc';
      sortDirDropdown.value = sortDir;
    }
  }
  
  // Initialize controls on page load
  initializeControls();
}

// Initialize on DOM load - Setup form handlers and inline editing
document.addEventListener('DOMContentLoaded', function() {
  const socket = io();
  
  // Add event listener for trigger toggles
  const triggerToggles = document.querySelectorAll('.toggle-input');
  triggerToggles.forEach(toggle => {
    toggle.addEventListener('change', function() {
      if (this.checked) {
        // Award +3 XP when a trigger is activated
        const username = document.body.getAttribute('data-username');
        if (username) {
          socket.emit('award-xp', {
            username: username,
            amount: 3,
            action: 'trigger_used'
          });
        }
      }
    });
  });
  
  // Add event listener for collar use
  const saveCollarBtn = document.getElementById('save-collar');
  if (saveCollarBtn) {
    saveCollarBtn.addEventListener('click', function() {
      const collarEnable = document.getElementById('collar-enable');
      if (collarEnable && collarEnable.checked) {
        // Award +15 XP for using the collar
        const username = document.body.getAttribute('data-username');
        if (username) {
          socket.emit('award-xp', {
            username: username,
            amount: 15,
            action: 'collar_used'
          });
        }
      }
    });
  }
  
  // Initialize form handlers
  setupFormHandlers();
  
  // Initialize inline editing if on profile page
  if (document.querySelector('.editable-field')) {
    setupInlineEditing();
  }
  
  // Initialize system controls
  if (typeof setupSystemControls === 'function') {
    setupSystemControls();
  }
  
  // Set up real-time XP updates
  setupXPUpdates();
  
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

  // Tab functionality for edit modal
  const tabButtons = document.querySelectorAll('.tab-btn');
  if (tabButtons.length > 0) {
    tabButtons.forEach(button => {
      button.addEventListener('click', function() {
        // Remove active class from all buttons and content
        document.querySelectorAll('.tab-btn').forEach(btn => {
          btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        
        // Add active class to clicked button
        this.classList.add('active');
        
        // Show corresponding content
        const tabId = this.getAttribute('data-tab') + '-tab';
        document.getElementById(tabId).classList.add('active');
      });
    });
  }
  
  // Edit profile button functionality
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const profileModal = document.getElementById('profile-edit-modal');
  if (editProfileBtn && profileModal) {
    editProfileBtn.addEventListener('click', function() {
      profileModal.style.display = 'block';
      // Ensure the first tab is active
      document.querySelector('.tab-btn[data-tab="profile-info"]').click();
    });
  }
  
  // See more history button
  const seeMoreBtn = document.querySelector('.see-more-btn');
  if (seeMoreBtn) {
    seeMoreBtn.addEventListener('click', function() {
      // Show all history entries by removing the slice limit
      const historyGroups = document.querySelectorAll('.history-date-group');
      historyGroups.forEach(group => {
        group.style.display = 'flex';
      });
      
      // Hide the see more button
      this.parentElement.style.display = 'none';
    });
  }

  // Set up pagination controls
  const resultsDropdown = document.getElementById('results-per-page');
  const sortByDropdown = document.getElementById('sort-by');
  const sortDirDropdown = document.getElementById('sort-direction');
  
  if (resultsDropdown) {
    resultsDropdown.addEventListener('change', function() {
      updateProfileList();
    });
  }
  
  if (sortByDropdown) {
    sortByDropdown.addEventListener('change', function() {
      updateProfileList();
    });
  }
  
  if (sortDirDropdown) {
    sortDirDropdown.addEventListener('change', function() {
      updateProfileList();
    });
  }
  
  // Function to update the profile list based on controls
  function updateProfileList() {
    const currentUrl = new URL(window.location.href);
    const searchParams = currentUrl.searchParams;
    
    // Get current values
    const perPage = resultsDropdown ? resultsDropdown.value : searchParams.get('perPage') || 20;
    const sortBy = sortByDropdown ? sortByDropdown.value : searchParams.get('sortBy') || 'createdAt';
    const sortDir = sortDirDropdown ? sortDirDropdown.value : searchParams.get('sortDir') || 'desc';
    
    // Reset to page 1 when changing display settings
    searchParams.set('page', 1);
    searchParams.set('perPage', perPage);
    searchParams.set('sortBy', sortBy);
    searchParams.set('sortDir', sortDir);
    
    // Navigate to the new URL
    window.location.href = currentUrl.toString();
  }
  
  // Ensure current selections are reflected in dropdowns
  function initializeControls() {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    
    if (resultsDropdown) {
      const perPage = params.get('perPage') || 20;
      // Make sure the option exists, otherwise add it
      if (!Array.from(resultsDropdown.options).some(opt => opt.value === perPage)) {
        const option = new Option(perPage, perPage, true, true);
        resultsDropdown.add(option);
      } else {
        resultsDropdown.value = perPage;
      }
    }
    
    if (sortByDropdown) {
      const sortBy = params.get('sortBy') || 'createdAt';
      sortByDropdown.value = sortBy;
    }
    
    if (sortDirDropdown) {
      const sortDir = params.get('sortDir') || 'desc';
      sortDirDropdown.value = sortDir;
    }
  }
  
  // Initialize controls on page load
  initializeControls();
  
  // Setup pagination if we're on the list page
  if (document.querySelector('.profiles-grid-container')) {
    setupPaginationControls();
  }
});

// Make the functions available globally
window.validateForm = validateForm;
window.validateEmail = validateEmail;
window.validateURL = validateURL;
window.showNotification = showNotification;
window.emitSocketPromise = emitSocketPromise;
window.setupSystemControls = setupSystemControls;
window.updateSystemControlsUI = updateSystemControlsUI;
window.setupXPUpdates = setupXPUpdates;
window.updateXPDisplay = updateXPDisplay;
window.showXPNotification = showXPNotification;
window.showLevelUpNotification = showLevelUpNotification;
window.syncTriggersWithPages = syncTriggersWithPages;