/**
 * BambiSocket - Unified Socket.io Client for BambiSleep Community
 */
class BambiSocket {
  constructor() {
    this.socket = io();
    this.eventHandlers = {};
    this.setupSocketListeners();
    this.setupErrorHandling();
  }

  setupSocketListeners() {
    const events = [
      'profile:hearted', 'profile:created', 'profile:updated',
      'profile:saved', 'profile:data', 'profile:error',
      'profile:follow', 'redirect to profile editor'
    ];
    
    events.forEach(event => {
      this.socket.on(event, data => {
        if (this.eventHandlers[event]) {
          this.eventHandlers[event](data);
        }
      });
    });
  }
  
  setupErrorHandling() {
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      if (this.eventHandlers['connection:error']) {
        this.eventHandlers['connection:error'](error);
      }
    });
    
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      if (this.eventHandlers['socket:error']) {
        this.eventHandlers['socket:error'](error);
      }
    });
  }

  // Register event handlers with chainable pattern
  on(event, callback) {
    this.eventHandlers[event] = callback;
    return this;
  }

  // Heart/unheart a profile
  toggleHeart(username, isActive) {
    this.socket.emit('profile:heart', {
      username,
      action: isActive ? 'unheart' : 'heart'
    });
    return this;
  }

  // View a profile to get its data
  viewProfile(username) {
    this.socket.emit('profile:view', username);
    return this;
  }

  // Save profile changes
  saveProfile(profileData) {
    this.socket.emit('profile:save', profileData);
    return this;
  }

  // Check if profile exists
  async checkProfile(username) {
    try {
      const response = await fetch(`/bambis/api/check-profile/${encodeURIComponent(username)}`);
      return await response.json();
    } catch (error) {
      console.error('Error checking profile:', error);
      return { exists: false, error: true };
    }
  }

  // Follow/unfollow a profile
  toggleFollow(username, isFollowing) {
    this.socket.emit('profile:follow', {
      username,
      action: isFollowing ? 'unfollow' : 'follow'
    });
    return this;
  }
}

// Create global instance
window.bambiSocket = new BambiSocket();