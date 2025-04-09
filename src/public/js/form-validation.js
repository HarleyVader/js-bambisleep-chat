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
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validateURL(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}