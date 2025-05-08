/**
 * Enhanced XP notification module for BambiSleep Chat
 * Handles visual notifications for XP awards and level ups
 */
window.bambiXP = (function() {
  // Private variables
  let initialized = false;
  
  // Initialize module
  function init() {
    if (initialized) return;
    
    try {
      // Create notification elements
      createNotificationElements();
      
      // Set up event listeners
      setupEventListeners();
      
      initialized = true;
    } catch (error) {
      console.error('Error initializing XP notification system:', error);
    }
  }
  
  // Create notification elements
  function createNotificationElements() {
    // Create XP notification if it doesn't exist
    if (!document.querySelector('.xp-notification-container')) {
      const container = document.createElement('div');
      container.className = 'xp-notification-container';
      document.body.appendChild(container);
    }
    
    // Create level up notification if it doesn't exist
    if (!document.querySelector('.level-up-notification')) {
      const levelNotification = document.createElement('div');
      levelNotification.className = 'level-up-notification';
      
      const icon = document.createElement('div');
      icon.className = 'level-up-icon';
      icon.textContent = '⭐';
      
      const text = document.createElement('div');
      text.className = 'level-up-text';
      
      levelNotification.appendChild(icon);
      levelNotification.appendChild(text);
      document.body.appendChild(levelNotification);
    }
  }
  
  // Set up event listeners
  function setupEventListeners() {
    // Listen for XP updates from the system
    document.addEventListener('xp-update', handleXpUpdate);
    
    // Listen for level changes
    document.addEventListener('level-changed', handleLevelChange);
  }
  
  // Handle XP update event
  function handleXpUpdate(event) {
    if (event.detail && event.detail.gained) {
      showXPNotification(event.detail.gained, event.detail.action);
    }
  }
  
  // Handle level change event
  function handleLevelChange(event) {
    if (event.detail && event.detail.level !== undefined) {
      // Only show notification if level actually increased
      if (event.detail.oldLevel < event.detail.level) {
        showLevelUpNotification(event.detail.level);
      }
    }
  }
  
  // Show XP notification
  function showXPNotification(amount, action) {
    if (!amount) return;
    
    try {
      const container = document.querySelector('.xp-notification-container');
      if (!container) {
        createNotificationElements();
        return showXPNotification(amount, action);
      }
      
      const notification = document.createElement('div');
      notification.className = 'xp-notification';
      
      // Add XP amount
      const xpAmount = document.createElement('div');
      xpAmount.className = 'xp-amount';
      xpAmount.textContent = `+${amount} XP`;
      notification.appendChild(xpAmount);
      
      // Add action description if present
      if (action) {
        const actionText = document.createElement('div');
        actionText.className = 'xp-action';
        actionText.textContent = formatActionText(action);
        notification.appendChild(actionText);
      }
      
      container.appendChild(notification);
      
      // Force reflow
      notification.offsetHeight;
      
      // Add show class for animation
      notification.classList.add('show');
      
      // Remove after animation completes
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 500);
      }, 3000);
    } catch (error) {
      console.error('Error showing XP notification:', error);
    }
  }
  
  // Format action text for display
  function formatActionText(action) {
    if (!action) return '';
    
    // Replace underscores with spaces and capitalize
    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  
  // Show level up notification
  function showLevelUpNotification(level) {
    if (!level) return;
    
    try {
      const notification = document.querySelector('.level-up-notification');
      if (!notification) {
        createNotificationElements();
        return showLevelUpNotification(level);
      }
      
      const textElement = notification.querySelector('.level-up-text');
      if (textElement) {
        textElement.textContent = `Level Up! You are now level ${level}!`;
      }
      
      // Show notification
      notification.classList.add('show');
      
      // Add sound effect if available
      if (window.audioPlayer && typeof window.audioPlayer.play === 'function') {
        window.audioPlayer.play('/audio/level-up.mp3', 0.7);
      }
      
      // Remove after animation completes
      setTimeout(() => {
        notification.classList.remove('show');
      }, 5000);
      
      // Check if new features are unlocked at this level
      checkFeatureUnlocks(level);
    } catch (error) {
      console.error('Error showing level up notification:', error);
    }
  }
  
  // Check if any features are unlocked at the new level
  function checkFeatureUnlocks(level) {
    // Feature level requirements 
    const featureUnlocks = {
      1: 'triggers',
      2: 'collar',
      3: 'sessions',
      4: 'spirals',
      5: 'hypnosis',
      6: 'audio',
      7: 'binaurals'
    };
    
    // Show feature unlock notification if applicable
    if (featureUnlocks[level]) {
      const featureName = featureUnlocks[level];
      showFeatureUnlockNotification(featureName, level);
    }
    
    // Update UI to reflect unlocked features
    if (window.bambiSystem && typeof window.bambiSystem.checkFeatureAvailability === 'function') {
      window.bambiSystem.checkFeatureAvailability();
    }
  }
  
  // Show feature unlock notification
  function showFeatureUnlockNotification(featureName, level) {
    try {
      const notification = document.createElement('div');
      notification.className = 'feature-unlock-notification';
      
      const icon = document.createElement('div');
      icon.className = 'feature-unlock-icon';
      icon.textContent = '🔓';
      
      const text = document.createElement('div');
      text.className = 'feature-unlock-text';
      text.innerHTML = `<strong>${formatFeatureName(featureName)}</strong> feature unlocked!`;
      
      notification.appendChild(icon);
      notification.appendChild(text);
      document.body.appendChild(notification);
      
      // Show notification
      setTimeout(() => notification.classList.add('show'), 10);
      
      // Remove after animation completes
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 500);
      }, 6000);
    } catch (error) {
      console.error('Error showing feature unlock notification:', error);
    }
  }
  
  // Format feature name for display
  function formatFeatureName(name) {
    if (!name) return '';
    
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  
  // Public API
  return {
    init,
    showXPNotification,
    showLevelUpNotification,
    showFeatureUnlockNotification
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.bambiXP.init);