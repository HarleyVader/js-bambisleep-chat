// XP progress module for handling XP progress bar and level display

(function() {
  // Store XP requirements
  const xpRequirements = [100, 250, 450, 700, 1200];
  
  // Initialize module
  function init() {
    // Make XP requirements globally available
    window.xpRequirements = xpRequirements;
    
    // Set up socket listeners for XP updates if socket exists
    if (typeof socket !== 'undefined') {
      // Listen for profile-update events
      socket.on('profile-update', function(data) {
        updateXPDisplay(data);
      });
      
      // Listen for xp:update events
      socket.on('xp:update', function(data) {
        updateXPDisplay(data);
        if (window.bambiXP && typeof window.bambiXP.showXPNotification === 'function') {
          window.bambiXP.showXPNotification(data.xpEarned);
        }
      });
      
      // Listen for level-up events
      socket.on('level-up', function(data) {
        if (window.bambiXP && typeof window.bambiXP.showLevelUpNotification === 'function') {
          window.bambiXP.showLevelUpNotification(data.level);
        }
        
        // Reload the page after a level up to show new unlocked features
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      });
    }
  }
  
  // Update XP progress display
  function updateXPDisplay(data) {
    const xpLabel = document.getElementById('xp-progress-label');
    const xpFill = document.getElementById('xp-progress-fill');
    
    if (!xpLabel || !xpFill) return;
    
    const level = data.level || 0;
    const xp = data.xp || 0;
    
    // Add animation class and then remove it
    xpLabel.classList.add('updating');
    setTimeout(() => xpLabel.classList.remove('updating'), 600);
    
    // Update the label text
    if (level < xpRequirements.length) {
      const nextLevelXP = xpRequirements[level];
      xpLabel.textContent = `Level ${level} • ${xp} XP / ${nextLevelXP} XP`;
      
      // Update progress bar width
      const percentage = Math.min(100, (xp / Math.max(1, nextLevelXP)) * 100);
      xpFill.style.width = `${percentage}%`;
    } else {
      xpLabel.textContent = `Level ${level} • ${xp} XP (MAX LEVEL)`;
      xpFill.style.width = '100%';
    }
  }
  
  // Export functions
  window.bambiXPProgress = {
    init,
    updateXPDisplay
  };
  
  // Auto-initialize on load
  document.addEventListener('DOMContentLoaded', init);
})();