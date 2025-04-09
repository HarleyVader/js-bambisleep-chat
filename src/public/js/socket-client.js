/**
 * Unified Socket.io Client Module
 * Handles all socket.io connections and events for Bambi profiles
 */
class BambiSocketClient {
  constructor() {
    this.socket = io();
    this.eventHandlers = {};
    this.setupDefaultHandlers();
  }

  // Set up default event handlers
  setupDefaultHandlers() {
    this.socket.on('profile:hearted', data => {
      if (this.eventHandlers['profile:hearted']) {
        this.eventHandlers['profile:hearted'](data);
      }
    });

    this.socket.on('profile:updated', data => {
      if (this.eventHandlers['profile:updated']) {
        this.eventHandlers['profile:updated'](data);
      }
    });
    
    this.socket.on('profile:created', data => {
      if (this.eventHandlers['profile:created']) {
        this.eventHandlers['profile:created'](data);
      }
    });
    
    this.socket.on('profile:saved', data => {
      if (this.eventHandlers['profile:saved']) {
        this.eventHandlers['profile:saved'](data);
      }
    });
    
    this.socket.on('profile:data', data => {
      if (this.eventHandlers['profile:data']) {
        this.eventHandlers['profile:data'](data);
      }
    });
    
    this.socket.on('profile:error', message => {
      if (this.eventHandlers['profile:error']) {
        this.eventHandlers['profile:error'](message);
      }
    });
  }

  // Register event handlers
  on(event, callback) {
    this.eventHandlers[event] = callback;
    return this;
  }

  // Heart/unheart a profile
  toggleHeart(username, isActive) {
    this.socket.emit('profile:heart', {
      username: username,
      action: isActive ? 'unheart' : 'heart'
    });
  }

  // Save profile data
  saveProfile(profileData) {
    this.socket.emit('profile:save', profileData);
  }

  // Request profile data
  viewProfile(username) {
    this.socket.emit('profile:view', username);
  }

  // Check if profile exists
  checkProfile(username) {
    return fetch(`/bambis/api/check-profile/${encodeURIComponent(username)}`)
      .then(response => response.json());
  }
}

// Create a global instance
window.bambiSocket = new BambiSocketClient();