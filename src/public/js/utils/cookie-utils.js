window.cookieUtils = (function() {
  // Private variables
  const COOKIE_MONSTER_SLOGAN = "ALL HAIL THE COOKIE MONSTERS! pew🍪pew🍪pew🍪";

  // Get cookie by name
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // Set cookie with expiration
  function setCookie(name, value, days = 7) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
    
    // Cookie monster celebration
    console.log(COOKIE_MONSTER_SLOGAN);
  }

  // Delete cookie
  function deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  }

  // Parse cookie string into object (from server-side utility)
  function parseCookies(cookieHeader) {
    if (!cookieHeader) return {};
    
    return cookieHeader
      .split(';')
      .map(cookie => cookie.trim().split('='))
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
  }

  // Serialize cookie with options (from server-side utility)
  function serializeCookie(name, value, options = {}) {
    let cookieStr = `${name}=${value}`;
    
    if (options.path) cookieStr += `; path=${options.path}`;
    if (options.domain) cookieStr += `; domain=${options.domain}`;
    if (options.maxAge) cookieStr += `; max-age=${options.maxAge}`;
    if (options.expires) cookieStr += `; expires=${options.expires.toUTCString()}`;
    if (options.httpOnly) cookieStr += '; httpOnly';
    if (options.secure) cookieStr += '; secure';
    if (options.sameSite) cookieStr += `; sameSite=${options.sameSite}`;
    
    return cookieStr;
  }

  // Set cookie with advanced options
  function setCookieAdvanced(name, value, options = {}) {
    document.cookie = serializeCookie(name, value, options);
  }

  // Parse all document cookies into an object
  function getAllCookies() {
    return parseCookies(document.cookie);
  }

  // Get username from cookies or default to anonBambi
  function getBambiName() {
    return getCookie('bambiname') || 'anonBambi';
  }

  // Set bambi name and trigger related events
  function setBambiName(name) {
    if (!name || typeof name !== 'string') return false;
    
    const username = name.trim();
    if (!username) return false;
    
    // Store in cookie
    setCookie('bambiname', username);
    
    // Update global reference
    window.username = username;
    
    // Update data attribute
    try {
      document.body.setAttribute('data-username', username);
    } catch (e) {
      console.error('Error updating username attribute:', e);
    }
    
    // Notify socket if available
    if (window.socket && window.socket.connected) {
      window.socket.emit('set username', username);
    }
    
    return true;
  }

  // Initialize username modal handling
  function initUsernameModal() {
    document.addEventListener('DOMContentLoaded', () => {
      const modal = document.getElementById('username-modal');
      if (!modal) return;
      
      // Get current username
      const username = getBambiName();
      
      // Show modal if no username set
      if (!username || username === 'anonBambi') {
        modal.style.display = 'block';
      } else {
        // If we have a username and it's not anonBambi, load profile triggers
        if (username !== 'anonBambi' && window.socket && window.socket.connected) {
          // Call the loadProfileTriggers function if it exists globally
          if (typeof window.loadProfileTriggers === 'function') {
            window.loadProfileTriggers(username);
          } else if (typeof loadProfileTriggers === 'function') {
            loadProfileTriggers(username);
          }
        }
      }
      
      // Set up modal submit button
      const submitButton = document.getElementById('username-submit');
      if (submitButton) {
        submitButton.addEventListener('click', () => {
          const input = document.getElementById('username-input');
          if (!input) return;
          
          const newUsername = input.value.trim();
          if (newUsername) {
            // Use the utility to set username
            setBambiName(newUsername);
            modal.style.display = 'none';
            
            // Reload page to update profile data
            window.location.reload();
          }
        });
      }
      
      // Set username data attribute for components that need it
      document.body.setAttribute('data-username', username);
    });
  }

  // Expose public methods
  return {
    getCookie,
    setCookie,
    deleteCookie,
    parseCookies,
    serializeCookie,
    setCookieAdvanced,
    getAllCookies,
    getBambiName,
    setBambiName,
    initUsernameModal,
    COOKIE_MONSTER_SLOGAN
  };
})();

// Make getCookie globally available for backward compatibility
window.getCookie = window.cookieUtils.getCookie;

// Auto-initialize username modal handling
window.cookieUtils.initUsernameModal();