// XP notification module for handling XP and level up notifications

(function() {
  // Create notification elements on initialization
  function initNotifications() {
    // Create XP notification if it doesn't exist
    if (!document.querySelector('.xp-notification')) {
      const xpNotification = document.createElement('div');
      xpNotification.className = 'xp-notification';
      document.body.appendChild(xpNotification);
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

  // Display XP notification
  function showXPNotification(amount) {
    if (!amount) return;
    
    let notification = document.querySelector('.xp-notification');
    if (!notification) {
      initNotifications();
      notification = document.querySelector('.xp-notification');
    }
    
    notification.textContent = `+${amount} XP`;
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
      notification.classList.add('fade-out');
    }, 3000);
  }
  
  // Display level up notification
  function showLevelUpNotification(level) {
    if (!level) return;
    
    let notification = document.querySelector('.level-up-notification');
    if (!notification) {
      initNotifications();
      notification = document.querySelector('.level-up-notification');
    }
    
    const textElement = notification.querySelector('.level-up-text');
    if (textElement) {
      textElement.textContent = `Level Up! You are now level ${level}!`;
    }
    
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
      notification.classList.add('fade-out');
    }, 5000);
  }

  // Export functions to global scope
  window.bambiXP = {
    showXPNotification,
    showLevelUpNotification
  };
})();