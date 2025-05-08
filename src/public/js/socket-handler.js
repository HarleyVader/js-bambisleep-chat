window.socketHandler = (function() {
  let socket = null;
  
  // Initialize socket connection
  function connect() {
    if (socket) return; // Already connected
    
    try {
      // Get auth token from cookie using utility or inline fallback
      let authToken = '';
      
      if (window.cookieUtils && window.cookieUtils.getCookie) {
        authToken = window.cookieUtils.getCookie('auth_token') || '';
      } else {
        // Fallback implementation
        const value = `; ${document.cookie}`;
        const parts = value.split(`; auth_token=`);
        if (parts.length === 2) authToken = parts.pop().split(';').shift() || '';
      }
      
      // Connect with auth token
      const options = {};
      if (authToken) {
        options.query = { token: authToken };
      }
      
      socket = io(options);
      
      // Basic handlers
      socket.on('connect', () => {
        console.log('Socket connected');
        document.dispatchEvent(new CustomEvent('socket-connected'));
      });
      
      socket.on('disconnect', () => {
        console.log('Socket disconnected');
        document.dispatchEvent(new CustomEvent('socket-disconnected'));
      });
      
      // Export for global use
      window.socket = socket;
    } catch (error) {
      console.error('Socket connection error:', error);
    }
  }
  
  // Connect on page load
  document.addEventListener('DOMContentLoaded', connect);
  
  // Public API
  return {
    connect,
    getSocket: () => socket
  };
})();