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
      
      const refresh = document.createElement('button');
      refresh.className = 'level-up-refresh';
      refresh.textContent = 'Refresh for Full Features';
      refresh.addEventListener('click', function() {
        window.location.reload();
      });
      
      levelNotification.appendChild(icon);
      levelNotification.appendChild(text);
      levelNotification.appendChild(refresh);
      document.body.appendChild(levelNotification);
    }

    // Add styles for the new button
    if (!document.getElementById('xp-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'xp-notification-styles';
      style.textContent = `
        .level-up-refresh {
          background: linear-gradient(45deg, #00ffff, #ff00ff);
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          margin-top: 10px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.3s ease;
        }
        .level-up-refresh:hover {
          transform: scale(1.05);
          box-shadow: 0 0 15px rgba(255, 0, 255, 0.7);
        }
        .level-up-notification {
          padding-bottom: 10px;
        }
      `;
      document.head.appendChild(style);
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
      textElement.innerHTML += '<br><span style="font-size: 0.8em; opacity: 0.8;">New features unlocked!</span>';
    }
    
    notification.classList.add('show');
    
    // Keep notification visible longer
    setTimeout(() => {
      notification.classList.remove('show');
      notification.classList.add('fade-out');
    }, 10000);
  }

  // Export functions to global scope
  window.bambiXP = {
    showXPNotification,
    showLevelUpNotification
  };
})();