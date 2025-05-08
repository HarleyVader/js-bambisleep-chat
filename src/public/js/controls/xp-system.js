/**
 * XP system module for BambiSleep Chat
 * Handles XP awards, level progression and notifications
 */
window.xpSystem = (function() {
  // Private variables
  let userLevel = 0;
  let userXp = 0;
  let xpRequirements = [1000, 2500, 7500, 17000, 42000, 132000, 478000, 1000000];
  let lastNotificationTime = 0;
  const MIN_NOTIFICATION_INTERVAL = 2000; // Minimum ms between notifications
  
  // Initialize module
  function init() {
    // Load initial values from DOM if available
    const levelElement = document.getElementById('level-indicator');
    if (levelElement) {
      const levelText = levelElement.textContent;
      const match = levelText.match(/Level\s+(\d+)/i);
      if (match) {
        userLevel = parseInt(match[1]);
      }
    }
    
    // Or from system state if available
    if (window.bambiSystem) {
      const xpState = window.bambiSystem.getState('xp');
      if (xpState) {
        userLevel = xpState.level || userLevel;
        userXp = xpState.points || userXp;
      }
    }
    
    // Set up socket listener for XP awards
    setupSocketListener();
    
    // Update UI with initial values
    updateXpProgress(userXp, userLevel);
  }
  
  // Set up socket event listener
  function setupSocketListener() {
    if (!window.socket) return;
    
    // Remove existing listener to avoid duplicates
    window.socket.off('server-xp-awarded');
    
    // Listen for XP award events from server
    window.socket.on('server-xp-awarded', data => {
      if (!data) return;
      
      // Store old level for comparison
      const oldLevel = userLevel;
      
      // Update local values
      userXp = data.currentXp || userXp;
      userLevel = data.level || userLevel;
      
      // Show notification
      showXpNotification(data.amount, data.action);
      
      // Update UI
      updateXpProgress(data.currentXp, data.level);
      
      // Check if level changed
      if (oldLevel !== userLevel) {
        // Notify level change
        document.dispatchEvent(new CustomEvent('level-changed', {
          detail: { 
            level: userLevel,
            oldLevel: oldLevel
          }
        }));
      }
      
      // Dispatch event for other components
      document.dispatchEvent(new CustomEvent('xp-update', {
        detail: {
          xp: userXp,
          level: userLevel,
          gained: data.amount,
          action: data.action
        }
      }));
    });
  }
  
  // Show XP notification
  function showXpNotification(amount, action) {
    // Throttle notifications
    const now = Date.now();
    if (now - lastNotificationTime < MIN_NOTIFICATION_INTERVAL) return;
    lastNotificationTime = now;
    
    try {
      // Create notification element
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
      
      // Add to document
      document.body.appendChild(notification);
      
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
  
  // Update XP progress bar
  function updateXpProgress(xp, level) {
    if (xp === undefined) xp = userXp;
    if (level === undefined) level = userLevel;
    
    // Update stored values
    userXp = xp;
    userLevel = level;
    
    // Get DOM elements
    const progressLabel = document.getElementById('xp-progress-label');
    const progressFill = document.getElementById('xp-progress-fill');
    const levelIndicator = document.getElementById('level-indicator');
    
    if (!progressLabel || !progressFill || !levelIndicator) return;
    
    // Calculate next level XP requirement
    const nextLevelXP = level < xpRequirements.length ? xpRequirements[level] : null;
    
    // Update level indicator
    levelIndicator.textContent = `Level ${level}`;
    
    // Update progress label
    if (nextLevelXP) {
      progressLabel.textContent = `${xp} XP / ${nextLevelXP} XP`;
    } else {
      progressLabel.textContent = `${xp} XP (MAX LEVEL)`;
    }
    
    // Update progress bar fill
    if (nextLevelXP) {
      const percentage = Math.min(100, (xp / Math.max(1, nextLevelXP)) * 100);
      progressFill.style.width = `${percentage}%`;
    } else {
      progressFill.style.width = '100%';
    }
    
    // Save to bambiSystem if available
    if (window.bambiSystem) {
      window.bambiSystem.saveState('xp', {
        level: level,
        points: xp,
        lastUpdate: Date.now()
      });
    }
  }
  
  // Award XP for actions
  function awardXp(action, amount) {
    if (!window.socket || !window.socket.connected) return;
    
    window.socket.emit('client-award-xp', {
      action,
      amount,
      timestamp: Date.now()
    });
  }
  
  // Public API
  return {
    init,
    awardXp,
    showXpNotification,
    updateXpProgress,
    getUserLevel: () => userLevel,
    getUserXp: () => userXp
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.xpSystem.init);