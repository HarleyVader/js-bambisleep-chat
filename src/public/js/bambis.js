document.addEventListener('DOMContentLoaded', () => {
  <% if (locals.bambi) { %>
    // SINGLE PROFILE VIEW JAVASCRIPT
    const editProfileBtn = document.getElementById('editProfileBtn');
    const editForm = document.getElementById('editForm');
    const profileEditForm = document.getElementById('profileEditForm');
    const displayNameEdit = document.getElementById('displayNameEdit');
    const descriptionEdit = document.getElementById('descriptionEdit');
    const profilePictureEdit = document.getElementById('profilePictureEdit');
    const newTriggerInput = document.getElementById('newTrigger');
    const triggersList = document.getElementById('triggersList');
    const charCounter = document.createElement('div');
    
    // Validation flags
    let isDescriptionValid = true;
    let isFileValid = true;
    
    // Add character counter to edit form
    Object.assign(charCounter, {
      className: 'char-counter',
      style: {
        textAlign: 'right',
        fontSize: '0.8rem',
        color: 'var(--text-muted)'
      }
    });
    descriptionEdit.parentNode.appendChild(charCounter);
    
    // Toggle edit form visibility
    editProfileBtn.addEventListener('click', () => {
      editForm.style.display = editForm.style.display === 'block' ? 'none' : 'block';
    });
    
    // Handle adding new triggers
    newTriggerInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const triggerValue = e.target.value.trim();
        
        if (triggerValue) {
          // Validate trigger - max length and max count
          if (triggerValue.length > 30) {
            alert('Trigger text cannot exceed 30 characters');
            return;
          }
          
          if (triggersList.querySelectorAll('.trigger-pill').length >= 20) {
            alert('You cannot add more than 20 triggers');
            return;
          }
          
          // Create new trigger pill
          const triggerPill = document.createElement('div');
          triggerPill.className = 'trigger-pill';
          triggerPill.dataset.value = triggerValue;
          triggerPill.innerHTML = `${triggerValue}<span class="remove-trigger">×</span>`;
          
          triggersList.appendChild(triggerPill);
          e.target.value = '';
          
          // Add event listener to the new remove button
          triggerPill.querySelector('.remove-trigger').addEventListener('click', () => {
            triggerPill.remove();
          });
        }
      }
    });
    
    // Add event listeners to existing remove buttons
    document.querySelectorAll('.remove-trigger').forEach(button => {
      button.addEventListener('click', () => button.parentElement.remove());
    });
    
    // Validate display name
    displayNameEdit.addEventListener('input', e => {
      const displayName = e.target.value.trim();
      if (displayName.length > 50) {
        e.target.value = displayName.substring(0, 50);
      }
    });
    
    // Validate file uploads
    profilePictureEdit.addEventListener('change', e => {
      const file = e.target.files[0];
      
      // Reset validation
      isFileValid = true;
      
      if (file) {
        // Check file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          alert('Please select a valid image file (JPEG, PNG, GIF, or WEBP)');
          e.target.value = '';
          isFileValid = false;
          return;
        }
        
        // Check file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
          alert('File size must be less than 10MB');
          e.target.value = '';
          isFileValid = false;
          return;
        }
      }
      
      updateSubmitButton();
    });
    
    // Update character count function
    const updateCharCount = () => {
      const remaining = 500 - descriptionEdit.value.length;
      charCounter.textContent = `${remaining} characters remaining`;
      
      charCounter.style.color = remaining < 0 ? 'var(--error)' : 'var(--text-muted)';
      isDescriptionValid = remaining >= 0;
      
      updateSubmitButton();
    };
    
    // Enable/disable submit button based on form validity
    const updateSubmitButton = () => {
      const submitButton = profileEditForm.querySelector('button[type="submit"]');
      
      submitButton.disabled = !(isDescriptionValid && isFileValid);
      submitButton.style.opacity = submitButton.disabled ? '0.5' : '1';
    };
    
    // Add event listeners
    descriptionEdit.addEventListener('input', updateCharCount);
    updateCharCount(); // Initial count
    
    // Update submit button state initially
    updateSubmitButton();
    
    // Handle form submission
    profileEditForm.addEventListener('submit', async e => {
      e.preventDefault();
      
      // Final validation checks
      if (!isDescriptionValid) {
        alert('Description cannot exceed 500 characters');
        return;
      }
      
      if (!isFileValid) {
        alert('Please select a valid image file');
        return;
      }
      
      // Collect all triggers
      const triggers = [...triggersList.querySelectorAll('.trigger-pill')].map(pill => pill.dataset.value);
      
      // First update profile data
      const profileData = {
        displayName: displayNameEdit.value.trim(),
        description: descriptionEdit.value.trim(),
        triggers,
        profileTheme: {
          primaryColor: document.getElementById('primaryColor').value,
          secondaryColor: document.getElementById('secondaryColor').value,
          textColor: document.getElementById('textColor').value
        }
      };
      
      try {
        const submitButton = profileEditForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';
        
        const response = await fetch(`/bambis/api/profile/<%= bambi.username %>`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(profileData)
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Apply new theme immediately
          const profileHeader = document.querySelector('.profile-header');
          const { primaryColor, secondaryColor, textColor } = profileData.profileTheme;
          profileHeader.style.background = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;
          profileHeader.style.color = textColor;
          
          // If there's a profile picture, upload it separately
          const profilePictureInput = document.getElementById('profilePictureEdit');
          
          if (profilePictureInput.files.length > 0) {
            submitButton.textContent = 'Uploading image...';
            
            const formData = new FormData();
            formData.append('profilePicture', profilePictureInput.files[0]);
            
            const pictureResponse = await fetch(`/bambis/api/profile/<%= bambi.username %>/picture`, {
              method: 'POST',
              body: formData
            });
            
            const pictureResult = await pictureResponse.json();
            
            if (pictureResult.success) {
              // Reload page to show updates
              window.location.reload();
            } else {
              alert(pictureResult.message || 'Failed to upload profile picture');
              submitButton.disabled = false;
              submitButton.textContent = 'Save Changes';
            }
          } else {
            // Reload page to show updates if no picture was uploaded
            window.location.reload();
          }
        } else {
          alert(result.message || 'Failed to update profile');
          submitButton.disabled = false;
          submitButton.textContent = 'Save Changes';
        }
      } catch (error) {
        console.error('Error updating profile:', error);
        alert('An error occurred while updating your profile');
        
        const submitButton = profileEditForm.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.textContent = 'Save Changes';
      }
    });
    
    // Theme customizer script
    const primaryColorInput = document.getElementById('primaryColor');
    const secondaryColorInput = document.getElementById('secondaryColor');
    const textColorInput = document.getElementById('textColor');
    const themePreview = document.getElementById('themePreview');
    
    const updateThemePreview = () => {
      const primary = primaryColorInput.value;
      const secondary = secondaryColorInput.value;
      const text = textColorInput.value;
      
      themePreview.style.background = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
      themePreview.style.color = text;
    };
    
    // Update on input change
    primaryColorInput.addEventListener('input', updateThemePreview);
    secondaryColorInput.addEventListener('input', updateThemePreview);
    textColorInput.addEventListener('input', updateThemePreview);
    
    // Initial update
    updateThemePreview();

    // Add heart functionality
    const heartButton = document.getElementById('heartButton');
    const heartCount = document.getElementById('heartCount');
    let isHearted = false;

    // Get cookie for current user
    const getCookie = name => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
      return null;
    };
    
    const bambiname = getCookie('bambiname') || 'Anonymous';

    // Check initial heart status
    const checkHeartStatus = async () => {
      try {
        const response = await fetch(`/bambis/api/profile/<%= bambi.username %>/heart-status?currentUser=${encodeURIComponent(bambiname)}`);
        const result = await response.json();
        
        if (result.success) {
          isHearted = result.hearted;
          heartCount.textContent = result.heartCount;
          
          heartButton.classList[isHearted ? 'add' : 'remove']('active');
        }
      } catch (error) {
        console.error('Error checking heart status:', error);
      }
    };

    // Toggle heart when clicked
    heartButton.addEventListener('click', async () => {
      if (bambiname === 'Anonymous') {
        alert('Please log in to heart this profile');
        return;
      }
      
      try {
        const response = await fetch(`/bambis/api/profile/<%= bambi.username %>/heart`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            hearterUsername: bambiname
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          isHearted = result.hearted;
          heartCount.textContent = result.heartCount;
          
          heartButton.classList[isHearted ? 'add' : 'remove']('active');
        } else {
          alert(result.message || 'Failed to update heart');
        }
      } catch (error) {
        console.error('Error toggling heart:', error);
        alert('An error occurred while updating heart');
      }
    });

    // Check heart status on page load
    checkHeartStatus();

    // Apply profile theme to header
    const profileHeader = document.querySelector('.profile-header');
    const primaryColor = '<%= bambi.profileTheme?.primaryColor || "#fa81ff" %>';
    const secondaryColor = '<%= bambi.profileTheme?.secondaryColor || "#ff4fa2" %>';
    const textColor = '<%= bambi.profileTheme?.textColor || "#ffffff" %>';
    
    if (profileHeader) {
      profileHeader.style.background = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;
      profileHeader.style.color = textColor;
    }

    // Share profile functionality
    const shareButton = document.getElementById('shareProfileBtn');
    
    if (shareButton) {
      shareButton.addEventListener('click', function() {
        const bambiName = document.querySelector('.profile-name').textContent;
        const shareUrl = window.location.href;
        
        if (navigator.share) {
          navigator.share({
            title: `${bambiName} on Bambisleep.chat`,
            text: `Check out ${bambiName}'s profile on Bambisleep.chat!`,
            url: shareUrl
          })
          .catch(error => console.log('Error sharing:', error));
        } else {
          // Fallback for browsers that don't support Web Share API
          try {
            navigator.clipboard.writeText(shareUrl);
            alert('Profile URL copied to clipboard!');
          } catch (err) {
            alert('Copy this URL to share: ' + shareUrl);
          }
        }
      });
    }

  <% } else { %>
    // PROFILE LIST VIEW JAVASCRIPT
    const form = document.getElementById('createProfileForm');
    const usernameField = document.getElementById('username');
    const displayNameField = document.getElementById('displayName');
    const descriptionField = document.getElementById('description');
    const charCounter = document.createElement('div');
    const usernameMessage = document.createElement('div');
    
    // Add validation message containers
    Object.assign(usernameMessage, {
      className: 'validation-message',
      style: {
        fontSize: '0.8rem',
        marginTop: '0.25rem'
      }
    });
    usernameField.parentNode.appendChild(usernameMessage);
    
    // Add character counter
    Object.assign(charCounter, {
      className: 'char-counter',
      style: {
        textAlign: 'right',
        fontSize: '0.8rem',
        color: 'var(--text-muted)'
      }
    });
    descriptionField.parentNode.appendChild(charCounter);
    
    // Validation flags
    let isUsernameValid = false;
    let isDescriptionValid = true;
    
    // Validate username format
    const validateUsernameFormat = username => {
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      return usernameRegex.test(username);
    };
    
    // Check username uniqueness via API
    const checkUsernameUniqueness = async username => {
      try {
        const response = await fetch(`/bambis/api/check-username?username=${encodeURIComponent(username)}`);
        const data = await response.json();
        return data.available;
      } catch (error) {
        console.error('Error checking username:', error);
        return false;
      }
    };
    
    // Validate username with debounce
    let usernameTimer;
    usernameField.addEventListener('input', e => {
      clearTimeout(usernameTimer);
      
      const username = e.target.value.trim();
      
      // Reset validation
      isUsernameValid = false;
      
      // Check basic format first
      if (!validateUsernameFormat(username)) {
        usernameMessage.textContent = 'Username must be 3-20 characters using only letters, numbers, and underscores';
        usernameMessage.style.color = 'var(--error)';
        return;
      }
      
      usernameMessage.textContent = 'Checking username availability...';
      usernameMessage.style.color = 'var(--text-muted)';
      
      // Debounce API call
      usernameTimer = setTimeout(async () => {
        const isAvailable = await checkUsernameUniqueness(username);
        
        usernameMessage.textContent = isAvailable ? 'Username is available' : 'Username is already taken';
        usernameMessage.style.color = isAvailable ? 'green' : 'var(--error)';
        isUsernameValid = isAvailable;
        
        updateSubmitButton();
      }, 500);
    });
    
    // Validate display name
    displayNameField.addEventListener('input', e => {
      const displayName = e.target.value.trim();
      if (displayName.length > 50) {
        e.target.value = displayName.substring(0, 50);
      }
    });
    
    // Update character count function
    const updateCharCount = () => {
      const remaining = 500 - descriptionField.value.length;
      charCounter.textContent = `${remaining} characters remaining`;
      
      charCounter.style.color = remaining < 0 ? 'var(--error)' : 'var(--text-muted)';
      isDescriptionValid = remaining >= 0;
      
      updateSubmitButton();
    };
    
    // Enable/disable submit button based on form validity
    const updateSubmitButton = () => {
      const submitButton = form.querySelector('button[type="submit"]');
      
      submitButton.disabled = !(isUsernameValid && isDescriptionValid);
      submitButton.style.opacity = submitButton.disabled ? '0.5' : '1';
    };
    
    // Add event listeners
    descriptionField.addEventListener('input', updateCharCount);
    updateCharCount(); // Initial count
    
    // Update submit button state initially
    updateSubmitButton();
    
    form.addEventListener('submit', async e => {
      e.preventDefault();
      
      // Final validation check
      if (!isUsernameValid) {
        alert('Please enter a valid username');
        return;
      }
      
      if (!isDescriptionValid) {
        alert('Description cannot exceed 500 characters');
        return;
      }
      
      const formData = {
        username: usernameField.value.trim(),
        displayName: displayNameField.value.trim(),
        description: descriptionField.value.trim()
      };
      
      try {
        const response = await fetch('/bambis/api/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
          window.location.href = `/bambis/${result.data.username}`;
        } else {
          alert(result.message || 'Failed to create profile');
        }
      } catch (error) {
        console.error('Error creating profile:', error);
        alert('An error occurred while creating your profile');
      }
    });
  <% } %>
});

// Share profile functionality
document.addEventListener('DOMContentLoaded', function() {
  const shareButton = document.getElementById('shareProfileBtn');
  
  if (shareButton) {
    shareButton.addEventListener('click', function() {
      const bambiName = document.querySelector('.profile-name').textContent;
      const shareUrl = window.location.href;
      
      if (navigator.share) {
        navigator.share({
          title: `${bambiName} on Bambisleep.chat`,
          text: `Check out ${bambiName}'s profile on Bambisleep.chat!`,
          url: shareUrl
        })
        .catch(error => console.log('Error sharing:', error));
      } else {
        // Fallback for browsers that don't support Web Share API
        try {
          navigator.clipboard.writeText(shareUrl);
          alert('Profile URL copied to clipboard!');
        } catch (err) {
          alert('Copy this URL to share: ' + shareUrl);
        }
      }
    });
  }
  
  // Add other existing bambis.js functionality here
});