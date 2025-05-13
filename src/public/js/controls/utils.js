// Utility functions for bambi controls
window.bambiControls = {
  // Show notification
  showMessage: function(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification notification-' + type;
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 15px';
    notification.style.background = type === 'error' ? '#ff3366' : '#0088ff';
    notification.style.color = 'white';
    notification.style.borderRadius = '4px';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.style.opacity = '1', 10);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  },
  
  // Safe localStorage get with fallback
  getStoredValue: function(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value !== null ? JSON.parse(value) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  
  // Safe localStorage set
  storeValue: function(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  },
  
  // Add event listener with safe check for element
  addListener: function(selector, event, handler) {
    const element = 
      typeof selector === 'string' ? document.querySelector(selector) : selector;
    
    if (element) {
      element.addEventListener(event, handler);
      return true;
    }
    return false;
  },
  
  // Update text content of element (if exists)
  updateText: function(selector, text) {
    const element = 
      typeof selector === 'string' ? document.querySelector(selector) : selector;
    
    if (element) {
      element.textContent = text;
      return true;
    }
    return false;
  }
};