window.audioUtils = (function() {
  // Audio cache to prevent reloading
  const audioCache = {};
  
  // Default volume
  let volume = 0.7;
  
  // Try to load from localStorage
  try {
    const settings = JSON.parse(localStorage.getItem('audioSettings') || '{}');
    if (settings.volume !== undefined) volume = settings.volume;
  } catch (e) {
    console.error('Error loading audio settings:', e);
  }
  
  // Play trigger audio with multiple fallback paths
  function playTriggerAudio(triggerName) {
    if (!triggerName) return null;
    
    // Skip if sound is disabled
    try {
      const settings = JSON.parse(localStorage.getItem('audioSettings') || '{}');
      if (settings.enableSound === false) return null;
    } catch (e) {
      // Continue with default
    }
    
    // Format trigger name in different ways to try
    const formattedName = triggerName.replace(/\s+/g, '-').toUpperCase();
    const altFormattedName = triggerName.replace(/\s+/g, '-');
    const lowerFormattedName = triggerName.replace(/\s+/g, '-').toLowerCase();
    
    // Possible paths to try
    const pathsToTry = [
      `/audio/triggers/${formattedName}.mp3`,
      `/audio/triggers/${altFormattedName}.mp3`,
      `/audio/triggers/${lowerFormattedName}.mp3`,
      `/audio/${formattedName}.mp3`,
      `/audio/${altFormattedName}.mp3`,
      `/audio/${lowerFormattedName}.mp3`,
      `/audio/triggers/${triggerName}.mp3`,
      `/audio/${triggerName}.mp3`
    ];
    
    // Try each path until one works
    return tryNextPath(pathsToTry, 0);
  }
  
  // Recursively try paths until one works
  function tryNextPath(paths, index) {
    if (index >= paths.length) {
      console.error(`Could not find audio for trigger`);
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
    
    // Create new audio
    const audio = new Audio();
    audio.volume = volume;
    
    // Handle success
    audio.oncanplaythrough = () => {
      audioCache[path] = audio;
      audio.play().catch(err => {
        console.error(`Error playing audio: ${err}`);
      });
    };
    
    // Handle error - try next path
    audio.onerror = () => {
      console.log(`Could not load audio from ${path}, trying next path`);
      return tryNextPath(paths, index + 1);
    };
    
    // Start loading
    audio.src = path;
    return audio;
  }
  
  // Set volume for all audio
  function setVolume(newVolume) {
    volume = Math.max(0, Math.min(1, newVolume));
    
    // Update all cached audio
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