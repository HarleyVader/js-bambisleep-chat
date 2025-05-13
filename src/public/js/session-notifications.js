js-bambisleep-chat\src\public\js\session-notifications.js

/**
 * Session Notifications Manager
 * Handles creating, displaying and managing notifications for the session dashboard
 */
const SessionNotifications = {
  container: null,
  notificationCount: 0,
  
  /**
   * Initialize the notification system
   */
  init() {
    this.container = document.getElementById('session-notifications');
    if (!this.container) return;
    
    // Check for any pending notifications in localStorage
    this.checkPendingNotifications();
    
    // Listen for session-related events
    document.addEventListener('session-updated', e => {
      if (e.detail && e.detail.message) {
        this.show({
          type: 'success',
          message: e.detail.message,
          icon: 'fas fa-check-circle'
        });
      }
    });
    
    document.addEventListener('session-error', e => {
      if (e.detail && e.detail.message) {
        this.show({
          type: 'error',
          message: e.detail.message,
          icon: 'fas fa-exclamation-circle'
        });
      }
    });
  },
  
  /**
   * Show a notification
   * @param {Object} options Notification options
   * @param {string} options.type Type of notification (info, success, warning, error)
   * @param {string} options.message Message to display
   * @param {string} options.icon Icon class (FontAwesome)
   * @param {boolean} options.persist Whether to store the notification
   * @param {number} options.duration Auto-dismiss duration in ms (0 = no auto-dismiss)
   */
  show(options) {
    const { 
      type = 'info',
      message,
      icon = 'fas fa-info-circle',
      persist = false,
      duration = 5000
    } = options;
    
    if (!this.container) return;
    
    // Create notification element
    const id = `notification-${Date.now()}-${this.notificationCount++}`;
    const notification = document.createElement('div');
    notification.id = id;
    notification.className = `session-notification ${type}`;
    
    notification.innerHTML = `
      <div class="notification-content">
        <i class="notification-icon ${icon}"></i>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close" aria-label="Close notification">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    // Add to DOM
    this.container.appendChild(notification);
    
    // Store in localStorage if persistent
    if (persist) {
      this.persistNotification({
        id,
        type,
        message,
        icon,
        timestamp: Date.now()
      });
    }
    
    // Set up close button
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.dismiss(id);
      });
    }
    
    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
    
    return id;
  },
  
  /**
   * Dismiss a notification
   * @param {string} id Notification ID
   */
  dismiss(id) {
    const notification = document.getElementById(id);
    if (!notification) return;
    
    // Animate out
    notification.classList.add('notification-slide-out');
    
    // Remove from DOM after animation
    notification.addEventListener('animationend', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      
      // Remove from localStorage if persisted
      this.removePersistedNotification(id);
    });
  },
  
  /**
   * Persist a notification to localStorage
   * @param {Object} notification Notification data
   */
  persistNotification(notification) {
    let notifications = JSON.parse(localStorage.getItem('session-notifications') || '[]');
    notifications.push(notification);
    
    // Keep only the last 5 notifications
    if (notifications.length > 5) {
      notifications = notifications.slice(-5);
    }
    
    localStorage.setItem('session-notifications', JSON.stringify(notifications));
  },
  
  /**
   * Remove a persisted notification from localStorage
   * @param {string} id Notification ID
   */
  removePersistedNotification(id) {
    const notifications = JSON.parse(localStorage.getItem('session-notifications') || '[]');
    const filtered = notifications.filter(n => n.id !== id);
    localStorage.setItem('session-notifications', JSON.stringify(filtered));
  },
  
  /**
   * Check for pending notifications in localStorage
   */
  checkPendingNotifications() {
    const notifications = JSON.parse(localStorage.getItem('session-notifications') || '[]');
    const now = Date.now();
    
    // Only show notifications from the last 24 hours
    const recentNotifications = notifications.filter(n => {
      return (now - n.timestamp) < 24 * 60 * 60 * 1000;
    });
    
    // Show each notification
    recentNotifications.forEach(n => {
      this.show({
        type: n.type,
        message: n.message,
        icon: n.icon,
        persist: true,
        duration: 0 // Don't auto-dismiss persisted notifications
      });
    });
    
    // Update localStorage with only recent notifications
    localStorage.setItem('session-notifications', JSON.stringify(recentNotifications));
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  SessionNotifications.init();
});

// Make it available globally
window.SessionNotifications = SessionNotifications;