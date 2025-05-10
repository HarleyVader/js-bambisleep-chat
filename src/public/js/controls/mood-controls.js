/**
 * Mood tracking and visualization system for BambiSleep
 */
window.bambiMood = (function() {
  // Private variables
  let currentMood = 'neutral';
  let moodIntensity = 50;
  let moodHistory = [];
  let uiElements = {};
  
  // State initialization
  function init() {
    try {
      // Setup DOM references
      uiElements.moodSelector = document.getElementById('mood-selector');
      uiElements.intensitySlider = document.getElementById('mood-intensity');
      uiElements.moodDisplay = document.getElementById('current-mood-display');
      
      // Load saved state
      loadSavedState();
      
      // Setup event listeners
      setupEventListeners();
      
      // Register with system controller
      if (window.bambiSystem) {
        window.bambiSystem.registerModule('mood', {
          getState: getMoodState,
          setState: setMoodState
        });
      }
      
      // Socket event listeners
      if (window.socket) {
        window.socket.on('server-mood-update', handleServerMoodUpdate);
      }
      
      // Initialize UI
      updateUI();
      
      console.log('Mood system initialized');
    } catch (error) {
      console.error('Error initializing mood system:', error);
    }
  }
  
  function loadSavedState() {
    try {
      // Check bambiSystem first
      if (window.bambiSystem) {
        const savedState = window.bambiSystem.getState('mood');
        if (savedState) {
          currentMood = savedState.currentMood || currentMood;
          moodIntensity = savedState.intensity || moodIntensity;
          return;
        }
      }
      
      // Fallback to localStorage
      const savedMood = localStorage.getItem('bambi-mood');
      if (savedMood) {
        const parsed = JSON.parse(savedMood);
        currentMood = parsed.mood || currentMood;
        moodIntensity = parsed.intensity || moodIntensity;
      }
    } catch (error) {
      console.error('Error loading mood state:', error);
    }
  }
  
  function setupEventListeners() {
    // Mood selection change
    if (uiElements.moodSelector) {
      uiElements.moodSelector.addEventListener('change', handleMoodChange);
    }
    
    // Intensity slider change
    if (uiElements.intensitySlider) {
      uiElements.intensitySlider.addEventListener('input', handleIntensityChange);
      uiElements.intensitySlider.addEventListener('change', saveState);
    }
    
    // System events
    document.addEventListener('session-loaded', handleSessionLoaded);
  }
  
  function handleMoodChange(event) {
    currentMood = event.target.value;
    updateUI();
    saveState();
    
    // Award XP for changing mood
    if (window.socket && window.socket.connected) {
      window.socket.emit('client-award-xp', {
        action: 'mood-change',
        amount: 5,
        timestamp: Date.now()
      });
    }
    
    // Notify server of mood change
    emitMoodUpdate();
  }
  
  function handleIntensityChange(event) {
    moodIntensity = parseInt(event.target.value);
    updateUI();
    // Don't save on input, only on change (to reduce writes)
  }
  
  function handleServerMoodUpdate(data) {
    if (data && data.mood) {
      currentMood = data.mood;
      moodIntensity = data.intensity || moodIntensity;
      updateUI();
      
      // Don't save to avoid loops
    }
  }
  
  function handleSessionLoaded(event) {
    if (event.detail && event.detail.mood) {
      currentMood = event.detail.mood.currentMood || currentMood;
      moodIntensity = event.detail.mood.intensity || moodIntensity;
      updateUI();
    }
  }
  
  function updateUI() {
    // Update mood selector
    if (uiElements.moodSelector) {
      uiElements.moodSelector.value = currentMood;
    }
    
    // Update intensity slider
    if (uiElements.intensitySlider) {
      uiElements.intensitySlider.value = moodIntensity;
    }
    
    // Update mood display
    if (uiElements.moodDisplay) {
      uiElements.moodDisplay.textContent = `${currentMood} (${moodIntensity}%)`;
      uiElements.moodDisplay.className = `mood-display mood-${currentMood}`;
    }
    
    // Apply mood effects to page
    applyMoodEffects();
  }
  
  function applyMoodEffects() {
    document.body.setAttribute('data-mood', currentMood);
    document.body.style.setProperty('--mood-intensity', `${moodIntensity}%`);
  }
  
  function saveState() {
    // Save to bambiSystem
    if (window.bambiSystem) {
      window.bambiSystem.saveState('mood', getMoodState());
    }
    
    // Also save to localStorage as fallback
    localStorage.setItem('bambi-mood', JSON.stringify({
      mood: currentMood,
      intensity: moodIntensity,
      timestamp: Date.now()
    }));
  }
  
  function getMoodState() {
    return {
      currentMood: currentMood,
      intensity: moodIntensity
    };
  }
  
  function setMoodState(state) {
    if (!state) return;
    
    currentMood = state.currentMood || currentMood;
    moodIntensity = state.intensity || moodIntensity;
    updateUI();
  }
  
  function emitMoodUpdate() {
    if (window.socket && window.socket.connected) {
      window.socket.emit('client-mood-update', {
        mood: currentMood,
        intensity: moodIntensity,
        timestamp: Date.now()
      });
    }
  }
  
  // Track mood over time
  function recordMoodHistory() {
    moodHistory.push({
      mood: currentMood,
      intensity: moodIntensity,
      timestamp: Date.now()
    });
    
    // Keep history limited to recent entries
    if (moodHistory.length > 50) {
      moodHistory.shift();
    }
  }
  
  // Public API
  return {
    init,
    getCurrentMood: () => currentMood,
    getMoodIntensity: () => moodIntensity,
    setMood: (mood, intensity) => {
      currentMood = mood || currentMood;
      moodIntensity = intensity || moodIntensity;
      updateUI();
      saveState();
      emitMoodUpdate();
    }
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', window.bambiMood.init);