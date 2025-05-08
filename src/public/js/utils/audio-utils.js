window.audioUtils = (function() {
  // Simple cache for loaded audio
  const audioCache = {};
  
  // Default volume
  let volume = 0.7;
  
  // Load settings from localStorage
  try {
    const settings = JSON.parse(localStorage.getItem('audioSettings') || '{}');
    if (settings.volume !== undefined) volume = settings.volume;
  } catch (e) {
    console.error('Error loading audio settings:', e);
  }
  
  // Play trigger audio with multiple fallback paths
  function playTriggerAudio(triggerName) {
    if (!triggerName) return null;
    
    // Check if sound is disabled
    try {
      const settings = JSON.parse(localStorage.getItem('audioSettings') || '{}');
      if (settings.enableSound === false) return null;
    } catch (e) {
      // Continue with default enabled
    }
    
    // Convert trigger name to different formats to try
    const formats = [
      triggerName,
      triggerName.replace(/\s+/g, '-'),
      triggerName.replace(/\s+/g, '-').toUpperCase(),
      triggerName.replace(/\s+/g, '-').toLowerCase()
    ];
    
    // Create list of paths to try
    const pathsToTry = [];
    
    // Add both /audio/ and /audio/triggers/ paths
    formats.forEach(format => {
      pathsToTry.push(`/audio/triggers/${format}.mp3`);
    });
    
    // Try to load and play from the list of paths
    return tryNextPath(pathsToTry, 0);
  }
  
  // Try paths one by one until success
  function tryNextPath(paths, index) {
    if (index >= paths.length) {
      console.error('Could not find audio for trigger');
      return null;
    }
    
    const path = paths[index];
    
    // Check cache first
    if (audioCache[path]) {
      const audio = audioCache[path];
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.error(`Error playing cached audio: ${err}`);
        return tryNextPath(paths, index + 1);
      });
      return audio;
    }
    
    // Create new audio element
    const audio = new Audio();
    audio.volume = volume;
    
    // Set up success handler
    audio.oncanplaythrough = () => {
      audioCache[path] = audio;
      audio.play().catch(err => {
        console.error(`Error playing audio: ${err}`);
      });
    };
    
    // Set up error handler to try next path
    audio.onerror = () => {
      console.log(`Could not load audio from ${path}, trying next path`);
      return tryNextPath(paths, index + 1);
    };
    
    // Start loading
    audio.src = path;
    return audio;
  }
  
  // Update volume for all audio
  function setVolume(newVolume) {
    volume = Math.max(0, Math.min(1, newVolume));
    
    // Update all cached audio elements
    Object.values(audioCache).forEach(audio => {
      audio.volume = volume;
    });
    
    // Save to localStorage
    try {
      const settings = JSON.parse(localStorage.getItem('audioSettings') || '{}');
      settings.volume = volume;
      localStorage.setItem('audioSettings', JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving audio settings:', e);
    }
  }
  
  // Return public API
  return {
    playTriggerAudio,
    setVolume
  };
})();