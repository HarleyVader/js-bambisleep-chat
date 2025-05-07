/**
 * Error handler for BambiSleep chat components
 * Provides consistent error handling for audio, network, and UI operations
 */

// Track resources that have failed to load to avoid repeated attempts
const failedResources = new Set();

/**
 * Handle audio loading errors
 * @param {string} audioPath - Path to the audio file
 * @param {string} triggerName - Name of the trigger associated with the audio
 * @param {function} fallbackCallback - Optional callback to run if audio fails
 */
function handleAudioError(audioPath, triggerName, fallbackCallback) {
  if (failedResources.has(audioPath)) {
    // Already failed before, don't log again
    return;
  }
  
  failedResources.add(audioPath);
  console.log(`Failed to load audio: ${triggerName}`);
  
  // Check if we should try an alternative path
  if (!audioPath.includes('_alt') && !audioPath.includes('fallback')) {
    // Try alternative path with different extension
    const altPath = audioPath.replace('.mp3', '.wav');
    
    // Create new audio element with alternative path
    const altAudio = new Audio(altPath);
    
    // Only replace if this one works
    altAudio.addEventListener('canplaythrough', () => {
      // Replace the cached audio
      if (window.audioCache && window.audioCache[triggerName]) {
        window.audioCache[triggerName] = altAudio;
        // Remove from failed resources
        failedResources.delete(audioPath);
      }
    });
  }
  
  // Run fallback if provided
  if (typeof fallbackCallback === 'function') {
    fallbackCallback();
  }
}

/**
 * Handle resource fetch errors (JSON, config files)
 * @param {string} resource - Resource path that failed
 * @param {Error} error - Error object
 * @param {boolean} isCritical - Whether this is a critical resource
 * @param {function} fallbackCallback - Optional callback for fallback behavior
 */
function handleResourceError(resource, error, isCritical, fallbackCallback) {
  if (failedResources.has(resource)) {
    // Already failed before, don't log again
    return;
  }
  
  failedResources.add(resource);
  console.log(`Error loading resource: ${resource}`, error);
  
  // Show UI notification for critical errors
  if (isCritical && typeof window.showNotification === 'function') {
    window.showNotification(`Failed to load ${resource.split('/').pop()}. Some features may not work.`, 'error');
  }
  
  // Run fallback if provided
  if (typeof fallbackCallback === 'function') {
    fallbackCallback();
  }
}

/**
 * Handle API errors
 * @param {string} endpoint - API endpoint that failed
 * @param {Error} error - Error object
 * @param {function} fallbackCallback - Optional callback for fallback
 */
function handleApiError(endpoint, error, fallbackCallback) {
  console.log(`API error (${endpoint}):`, error);
  
  // For API errors, we don't track in failedResources as they might succeed on retry
  
  // Run fallback if provided
  if (typeof fallbackCallback === 'function') {
    fallbackCallback();
  }
}

/**
 * Clear a specific failed resource to allow retrying
 * @param {string} resource - Resource path to clear
 */
function clearFailedResource(resource) {
  failedResources.delete(resource);
}

/**
 * Clear all failed resources
 */
function clearAllFailedResources() {
  failedResources.clear();
}

// Make functions available globally
window.errorHandler = {
  handleAudioError,
  handleResourceError,
  handleApiError,
  clearFailedResource,
  clearAllFailedResources,
  getFailedResources: () => Array.from(failedResources)
};