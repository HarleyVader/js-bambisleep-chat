/**
 * BambiSleep Triggers Management System
 * Handles trigger display, activation, and state persistence
 */

// Standard triggers that most bambis will have
const STANDARD_TRIGGERS = [
  "BIMBO DOLL",
  "BAMBI SLEEP",
  "GOOD GIRL",
  "BAMBI FREEZE",
  "BAMBI ALWAYS WINS",
  "ZAP COCK DRAIN OBEY",
"BAMBI ALWAYS WINS",
  "BAMBI RESET",
  "I-Q DROP",
  "I-Q LOCK",
  "POSTURE LOCK",
  "UNIFORM LOCK",
  "SAFE & SECURE",
  "PRIMPED",
  "PAMPERED",
  "SNAP & FORGET",
  "GIGGLE TIME",
  "BLONDE MOMENT",
  "BAMBI DOES AS SHE IS TOLD",
"BAMBI ALWAYS WINS",
  "BAMBI RESET",
  "I-Q DROP",
  "I-Q LOCK",
  "POSTURE LOCK",
  "UNIFORM LOCK",
  "SAFE & SECURE",
  "PRIMPED",
  "PAMPERED",
  "SNAP & FORGET",
  "GIGGLE TIME",
  "BLONDE MOMENT",
  "BAMBI DOES AS SHE IS TOLD",
  "DROP FOR COCK",
  "COCK ZOMBIE NOW",
  "TITS LOCK",
  "WAIST LOCK",
  "BUTT LOCK",
  "LIMBS LOCK",
  "FACE LOCK",
  "LIPS LOCK",
  "THROAT LOCK",
  "HIPS LOCK",
  "CUNT LOCK",
  "BAMBI CUM & COLAPSE"
];

const textElements = [
  document.getElementById("eyeCursorText"),
  document.getElementById("eyeCursorText2"),
  document.getElementById("eyeCursorText3"),
  document.getElementById("eyeCursorText4")
].filter(element => element !== null);

function createToggleButtons() {
  const container = document.getElementById('trigger-toggles');
  if (!container) {
    console.warn('Container with id \'trigger-toggles\' not found.');
    return;
  }
  
  // Clear the container
  container.innerHTML = '';
  
  // Create buttons for standard triggers
  STANDARD_TRIGGERS.forEach(trigger => {
    const button = document.createElement('button');
    button.className = 'trigger-toggle' + (activeTriggers.includes(trigger) ? ' active' : '');
    button.dataset.trigger = trigger;
    button.textContent = trigger;
    
    // Add click handler
    button.addEventListener('click', function() {
      const isActive = this.classList.contains('active');
      toggleTrigger(trigger, !isActive);
    });
    
    container.appendChild(button);
  });
}

// Toggle a trigger's active state
function toggleTrigger(triggerName, active) {
  // Default to true if not specified
  active = (active !== false);
  
  // Update local state
  if (active && !activeTriggers.includes(triggerName)) {
    activeTriggers.push(triggerName);
  } else if (!active) {
    activeTriggers = activeTriggers.filter(t => t !== triggerName);
  }
  
  // Update UI to match state
  updateTriggerUI();
  
  // Send to server if socket is available
  if (window.socket && window.socket.connected) {
    window.socket.emit('update-system-controls', {
      username: window.username,
      activeTriggers: activeTriggers
    });
    
    // Also send directly to LMStudio for real-time response
    window.socket.emit('triggers', {
      triggerNames: activeTriggers.join(' '),
      triggerDetails: activeTriggers.map(t => ({ name: t }))
    });
  }
  
  // Flash visual effect for trigger activation
  if (active) {
    flashTrigger(triggerName);
  }
  
  // Synchronize with other tabs
  const triggerSyncChannel = new BroadcastChannel('bambi-trigger-sync');
  triggerSyncChannel.postMessage({
    type: 'trigger-update',
    activeTriggers: activeTriggers
  });
  
  // Return the current active state
  return active;
}

// Update UI to match current trigger state
function updateTriggerUI() {
  const buttons = document.querySelectorAll('.trigger-toggle');
  buttons.forEach(button => {
    const trigger = button.dataset.trigger;
    const isActive = activeTriggers.includes(trigger);
    button.classList.toggle('active', isActive);
  });
}

// Visual effect for trigger activation
function flashTrigger(trigger) {
  // Create flash element
  const flash = document.createElement('div');
  flash.className = 'trigger-flash';
  flash.textContent = trigger;
  document.body.appendChild(flash);
  
  // Animate and remove
  setTimeout(() => {
    flash.classList.add('active');
    setTimeout(() => {
      flash.classList.remove('active');
      setTimeout(() => {
        document.body.removeChild(flash);
      }, 500);
    }, 1000);
  }, 10);
}

// Make functions available globally
window.toggleTrigger = toggleTrigger;
window.createToggleButtons = createToggleButtons;
window.getActiveTriggers = () => activeTriggers;

// Initialize on window load to ensure all resources are loaded
window.onload = function() {
  createToggleButtons();
};

/* Trigger flash animation */
.trigger-flash {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 0, 255, 0.2);
  color: #fff;
  font-size: 5rem;
  font-weight: bold;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
  z-index: 9999;
  opacity: 0;
  transition: opacity 0.5s ease;
}

.trigger-flash.active {
  opacity: 1;
}

