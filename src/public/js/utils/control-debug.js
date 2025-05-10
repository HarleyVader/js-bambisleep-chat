/**
 * Debug utility for control elements
 */
window.controlDebug = (function() {
  // Store DOM structure for controls
  function logControlElements() {
    console.group('Control Elements Debug');
    
    // Log mood selector
    const moodSelector = document.getElementById('mood-selector');
    console.log('Mood Selector:', moodSelector || 'NOT FOUND');
    
    // Log control panels
    const controlPanels = document.querySelectorAll('.control-panel');
    console.log('Control Panels:', controlPanels.length > 0 ? controlPanels : 'NONE FOUND');
    
    // Log system control panel
    const systemControlPanel = document.getElementById('system-control-panel');
    console.log('System Control Panel:', systemControlPanel || 'NOT FOUND');
    
    // Log toggle buttons
    const toggles = document.querySelectorAll('.system-toggle');
    console.log('System Toggles:', toggles.length > 0 ? toggles : 'NONE FOUND');
    
    // Check mood-specific elements
    console.group('Mood System Elements');
    logMoodElements();
    console.groupEnd();
    
    // Check for HTML templates that might contain controls
    console.group('Control Templates');
    logTemplates();
    console.groupEnd();
    
    console.groupEnd();
  }
  
  // Log mood-specific elements
  function logMoodElements() {
    // Check for any mood-related elements
    const moodElements = document.querySelectorAll('[data-mood], [class*="mood-"]');
    console.log('Mood Elements:', moodElements.length > 0 ? moodElements : 'NONE FOUND');
  }
  
  // Log HTML templates that might contain controls
  function logTemplates() {
    const templates = document.querySelectorAll('template');
    console.log('Templates:', templates.length > 0 ? templates : 'NONE FOUND');
    
    templates.forEach(template => {
      console.group(`Template: ${template.id || 'unnamed'}`);
      console.log('Content:', template.content);
      console.groupEnd();
    });
  }
  
  // Create missing mood controls
  function createMoodSelector() {
    try {
      // Check if mood selector already exists
      if (document.getElementById('mood-selector')) {
        console.log('Mood selector already exists');
        return;
      }
      
      // Find a suitable container
      let container = document.querySelector('.control-container') || 
                      document.querySelector('.control-panel') ||
                      document.querySelector('.system-controls-container');
      
      // Create container if none exists
      if (!container) {
        container = document.createElement('div');
        container.className = 'control-container mood-control-container';
        document.body.appendChild(container);
      }
      
      // Create mood control panel
      const moodPanel = document.createElement('div');
      moodPanel.className = 'control-panel mood-control-panel';
      moodPanel.innerHTML = `
        <h3>Mood Controls</h3>
        <div class="control-group">
          <label for="mood-selector">Current Mood:</label>
          <select id="mood-selector" class="form-control">
            <option value="neutral">Neutral</option>
            <option value="happy">Happy</option>
            <option value="excited">Excited</option>
            <option value="sad">Sad</option>
            <option value="angry">Angry</option>
          </select>
        </div>
      `;
      
      container.appendChild(moodPanel);
      
      console.log('Created mood selector element');
      return document.getElementById('mood-selector');
    } catch (error) {
      console.error('Error creating mood selector:', error);
    }
  }
  
  // Create system control panel if missing
  function createSystemControlPanel() {
    try {
      // Check if panel already exists
      if (document.getElementById('system-control-panel')) {
        console.log('System control panel already exists');
        return;
      }
      
      // Find a suitable container
      let container = document.querySelector('.control-container') || 
                      document.querySelector('.system-controls-container');
      
      // Create container if none exists
      if (!container) {
        container = document.createElement('div');
        container.className = 'control-container system-controls-container';
        document.body.appendChild(container);
      }
      
      // Create system control panel
      const controlPanel = document.createElement('div');
      controlPanel.id = 'system-control-panel';
      controlPanel.className = 'control-panel system-control-panel';
      controlPanel.innerHTML = `
        <h3>System Controls</h3>
        <div class="control-group">
          <button class="system-toggle" data-control="feature1">Feature 1</button>
          <button class="system-toggle" data-control="feature2">Feature 2</button>
        </div>
      `;
      
      container.appendChild(controlPanel);
      
      console.log('Created system control panel');
      return document.getElementById('system-control-panel');
    } catch (error) {
      console.error('Error creating system control panel:', error);
    }
  }
  
  // Run diagnostics and fix common issues
  function diagnoseAndFix() {
    console.group('Control System Diagnostics');
    
    // Log current DOM state
    logControlElements();
    
    // Check for mood selector and create if missing
    const moodSelector = document.getElementById('mood-selector');
    if (!moodSelector) {
      console.log('Creating missing mood selector...');
      createMoodSelector();
    }
    
    // Check for system control panel and create if missing
    const systemPanel = document.getElementById('system-control-panel');
    if (!systemPanel) {
      console.log('Creating missing system control panel...');
      createSystemControlPanel();
    }
    
    // Reinitialize mood system if needed
    if (window.bambiMood && !document.querySelector('.mood-neutral')) {
      console.log('Reinitializing mood system...');
      window.bambiMood.init();
    }
    
    // Reinitialize system controls if needed
    if (window.systemControlUI && !document.querySelector('.system-controls-container')) {
      console.log('Reinitializing system controls...');
      window.systemControlUI.init();
    }
    
    console.log('Diagnostics and fixes complete');
    console.groupEnd();
  }
  
  return {
    logControlElements,
    createMoodSelector,
    createSystemControlPanel,
    diagnoseAndFix
  };
})();

// Run diagnostics when script loads
document.addEventListener('DOMContentLoaded', function() {
  // Wait a short time for other scripts to initialize
  setTimeout(function() {
    if (window.bambiConsole) {
      window.bambiConsole.log('controlDebug', 'Running control system diagnostics');
    }
    window.controlDebug.diagnoseAndFix();
  }, 1000);
});