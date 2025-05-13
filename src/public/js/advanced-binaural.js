document.addEventListener('DOMContentLoaded', function() {
  // Audio context and oscillator variables
  let audioContext = null;
  let oscillatorLeft = null;
  let oscillatorRight = null;
  let gainNode = null;
  let isPlaying = false;
  let patternInterval = null;
  let transitionInterval = null;
  let currentSegmentIndex = 0;
  let currentTime = 0;
  let patternStartTime = 0;
  
  // Canvas and visualization variables
  let canvas = null;
  let ctx = null;
  let visualizationDrawInterval = null;
  
  // Pattern configuration
  const patternSteps = {
    descent: [
      { wave: "alpha", frequency: 10, duration: 5 },
      { wave: "theta", frequency: 6, duration: 10 },
      { wave: "delta", frequency: 2, duration: 5 }
    ],
    ascent: [
      { wave: "delta", frequency: 2, duration: 5 },
      { wave: "theta", frequency: 6, duration: 10 },
      { wave: "alpha", frequency: 10, duration: 5 }
    ],
    focus: [
      { wave: "alpha", frequency: 10, duration: 5 },
      { wave: "beta", frequency: 18, duration: 10 },
      { wave: "alpha", frequency: 10, duration: 5 }
    ],
    trance: [
      { wave: "alpha", frequency: 10, duration: 5 },
      { wave: "theta", frequency: 6, duration: 10 },
      { wave: "alpha", frequency: 9, duration: 5 }
    ]
  };
  
  // Wave frequency ranges for visualization
  const waveRanges = {
    beta: { min: 14, max: 30 },
    alpha: { min: 8, max: 13 },
    theta: { min: 4, max: 7 },
    delta: { min: 1, max: 3 }
  };
  
  // Get DOM elements
  const enableToggle = document.getElementById('advanced-binaural-enable');
  const patternSelect = document.getElementById('pattern-select');
  const patternDescription = document.getElementById('pattern-description');
  const customPatternContainer = document.getElementById('custom-pattern-container');
  const addSegmentButton = document.getElementById('add-segment');
  const patternDurationSlider = document.getElementById('pattern-duration');
  const patternDurationValue = document.getElementById('pattern-duration-value');
  const transitionTimeSlider = document.getElementById('transition-time');
  const transitionTimeValue = document.getElementById('transition-time-value');
  const playButton = document.getElementById('play-advanced-binaural');
  const stopButton = document.getElementById('stop-advanced-binaural');
  const saveButton = document.getElementById('save-advanced-binaural');
  const scienceLink = document.getElementById('science-link');
  
  // Initialize canvas if it exists
  canvas = document.getElementById('pattern-visualization');
  if (canvas) {
    ctx = canvas.getContext('2d');
    drawVisualization();
  }
  
  // Check if required elements exist
  if (!patternSelect || !patternDescription) return;
  
  // Pattern descriptions
  const descriptions = {
    descent: "Descent pattern gradually moves from alert Alpha waves down through Theta into deep Delta, creating a natural descent into trance.",
    ascent: "Ascent pattern guides you from deep Delta through Theta up to Alpha, perfect for waking from trance.",
    focus: "Focus cycle alternates between relaxed Alpha and alert Beta states to enhance concentration and mental clarity.",
    trance: "Deep trance loop cycles between Alpha and Theta waves to maintain a sustained hypnotic state.",
    custom: "Custom pattern allows you to design your own sequence of brainwave states."
  };
  
  // Handle pattern selection change
  patternSelect.addEventListener('change', function() {
    const pattern = this.value;
    
    if (pattern === 'custom') {
      customPatternContainer.style.display = '';
    } else {
      customPatternContainer.style.display = 'none';
    }
    
    // Update description
    patternDescription.textContent = descriptions[pattern] || descriptions.custom;
    
    // Update visualization
    drawVisualization();
  });
  
  // Duration slider
  patternDurationSlider.addEventListener('input', function() {
    patternDurationValue.textContent = this.value + ' minutes';
    drawVisualization();
  });
  
  // Transition time slider
  transitionTimeSlider.addEventListener('input', function() {
    transitionTimeValue.textContent = this.value + ' seconds';
  });
  
  // Add segment button for custom patterns
  if (addSegmentButton) {
    addSegmentButton.addEventListener('click', function() {
      const segmentsContainer = document.querySelector('.pattern-segments');
      if (!segmentsContainer) return;
      
      const newSegment = document.createElement('div');
      newSegment.className = 'pattern-segment';
      newSegment.innerHTML = `
        <select class="segment-wave">
          <option value="alpha">Alpha</option>
          <option value="theta">Theta</option>
          <option value="delta">Delta</option>
          <option value="beta">Beta</option>
        </select>
        <input type="number" class="segment-duration" min="1" max="60" value="5"> mins
        <button class="remove-segment">×</button>
      `;
      
      segmentsContainer.appendChild(newSegment);
      
      // Add remove button event listener
      const removeButton = newSegment.querySelector('.remove-segment');
      removeButton.addEventListener('click', function() {
        segmentsContainer.removeChild(newSegment);
        drawVisualization();
      });
      
      // Update visualization when segment is added
      drawVisualization();
    });
  }
  
  // Science info link
  if (scienceLink) {
    scienceLink.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Create and show modal with scientific information
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>The Science of Binaural Beats</h3>
            <button class="modal-close">×</button>
          </div>
          <div class="modal-body">
            <p>Binaural beats work through a process called frequency following response. When two tones of slightly different frequencies are played in separate ears, your brain creates a third phantom beat equal to the difference between them.</p>
            <p>For example, if a 200 Hz tone plays in your left ear and a 210 Hz tone in your right, your brain perceives a 10 Hz beat, which is in the alpha wave range.</p>
            <p>Research published in journals like Frontiers in Human Neuroscience suggests that prolonged exposure to these beats may enhance meditative states and potentially influence cognitive processes.</p>
            <p>While scientific evidence is still emerging, many users report binaural beats help with relaxation, focus, creativity, and sleep quality.</p>
            <p class="citation">Source: ABC Science, "What are binaural beats and how do they affect your brain?", April 2022</p>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Handle modal close
      const closeButton = modal.querySelector('.modal-close');
      closeButton.addEventListener('click', function() {
        document.body.removeChild(modal);
      });
      
      // Close on outside click
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          document.body.removeChild(modal);
        }
      });
    });
  }
  
  // Play button
  playButton.addEventListener('click', function() {
    if (isPlaying) return;
    
    try {
      // Create audio context if it doesn't exist
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Create gain node
      gainNode = audioContext.createGain();
      gainNode.gain.value = 0.5; // Start at mid volume
      gainNode.connect(audioContext.destination);
      
      // Create oscillators
      oscillatorLeft = audioContext.createOscillator();
      oscillatorRight = audioContext.createOscillator();
      
      // Create channel merger for stereo
      const merger = audioContext.createChannelMerger(2);
      
      // Connect oscillators to specific channels
      oscillatorLeft.connect(merger, 0, 0);  // Left channel
      oscillatorRight.connect(merger, 0, 1); // Right channel
      merger.connect(gainNode);
      
      // Get pattern configuration
      const pattern = patternSelect.value;
      let segments = [];
      
      if (pattern === 'custom') {
        // Get custom segments
        const segmentElements = document.querySelectorAll('.pattern-segment');
        segmentElements.forEach(segmentEl => {
          const waveType = segmentEl.querySelector('.segment-wave').value;
          const duration = parseInt(segmentEl.querySelector('.segment-duration').value);
          
          segments.push({
            wave: waveType,
            frequency: getWaveFrequency(waveType),
            duration: duration
          });
        });
        
        if (segments.length === 0) {
          throw new Error("No segments defined for custom pattern");
        }
      } else {
        segments = patternSteps[pattern] || patternSteps.descent;
      }
      
      // Start with the first segment
      currentSegmentIndex = 0;
      const firstSegment = segments[0];
      
      // Set initial frequencies
      const carrierFreq = 200; // Base carrier frequency
      oscillatorLeft.frequency.value = carrierFreq;
      oscillatorRight.frequency.value = carrierFreq + firstSegment.frequency;
      
      // Start oscillators
      oscillatorLeft.start();
      oscillatorRight.start();
      
      isPlaying = true;
      playButton.disabled = true;
      stopButton.disabled = false;
      patternStartTime = Date.now();
      
      // Set up pattern progression
      setupPatternProgression(segments);
      
      showNotification("Pattern playback started", "success");
    } catch (error) {
      console.error('Error starting binaural pattern:', error);
      showNotification("Failed to start audio: " + error.message, "error");
    }
  });
  
  // Stop button
  stopButton.addEventListener('click', function() {
    stopPattern();
  });
  
  // Save settings
  saveButton.addEventListener('click', function() {
    const pattern = patternSelect.value;
    let customPattern = [];
    
    if (pattern === 'custom') {
      // Get custom segments
      const segmentElements = document.querySelectorAll('.pattern-segment');
      segmentElements.forEach(segmentEl => {
        const waveType = segmentEl.querySelector('.segment-wave').value;
        const duration = parseInt(segmentEl.querySelector('.segment-duration').value);
        
        customPattern.push({
          wave: waveType,
          duration: duration
        });
      });
    }
    
    const settings = {
      advancedBinauralEnabled: enableToggle.checked,
      binauralPattern: pattern,
      customPattern: customPattern,
      patternDuration: parseInt(patternDurationSlider.value),
      transitionTime: parseInt(transitionTimeSlider.value)
    };
    
    // Save to system state
    if (window.bambiSystem && typeof window.bambiSystem.saveAdvancedBinaural === 'function') {
      window.bambiSystem.saveAdvancedBinaural(settings);
      showNotification("Advanced binaural settings saved", "success");
    } else {
      // Fallback - save directly to localStorage
      try {
        // Get existing state
        let state = {};
        try {
          const stateJson = localStorage.getItem('bambiSystemState');
          if (stateJson) {
            state = JSON.parse(stateJson);
          }
        } catch(e) {
          console.error('Error parsing system state:', e);
          state = {};
        }
        
        // Update with advanced binaural settings
        state.advancedBinaural = settings;
        
        // Save back to localStorage
        localStorage.setItem('bambiSystemState', JSON.stringify(state));
        showNotification("Advanced binaural settings saved", "success");
      } catch(e) {
        console.error('Error saving to localStorage:', e);
        showNotification("Failed to save settings", "error");
      }
    }
  });
  
  // Helper function to get frequency for a wave type
  function getWaveFrequency(waveType) {
    switch(waveType) {
      case 'beta': return 20;
      case 'alpha': return 10;
      case 'theta': return 6;
      case 'delta': return 2;
      default: return 10;
    }
  }
  
  // Set up pattern progression
  function setupPatternProgression(segments) {
    if (!segments || segments.length === 0) return;
    
    const totalDuration = parseInt(patternDurationSlider.value || 20);
    const transitionTime = parseInt(transitionTimeSlider.value || 30);
    
    // Calculate total time for all segments
    const segmentDurations = segments.map(s => s.duration);
    const totalSegmentTime = segmentDurations.reduce((a, b) => a + b, 0);
    
    // Scale segment durations to fit within total duration
    const scaleFactor = totalDuration / totalSegmentTime;
    
    let scheduledTime = 0;
    
    // Schedule each segment
    segments.forEach((segment, index) => {
      const scaledDuration = segment.duration * scaleFactor;
      const startTime = scheduledTime;
      const endTime = startTime + scaledDuration;
      
      // Schedule next segment
      setTimeout(() => {
        if (!isPlaying) return;
        
        // Update current segment index
        currentSegmentIndex = index;
        
        // If it's not the last segment, transition to the next one
        if (index < segments.length - 1) {
          const nextSegment = segments[index + 1];
          transitionToFrequency(segment.frequency, nextSegment.frequency, transitionTime / 1000);
        }
      }, startTime * 60 * 1000);
      
      scheduledTime = endTime;
    });
    
    // Stop at the end
    setTimeout(() => {
      if (isPlaying) {
        stopPattern();
      }
    }, totalDuration * 60 * 1000);
    
    // Start visualization update
    if (canvas && ctx) {
      visualizationDrawInterval = setInterval(() => {
        const elapsedMinutes = (Date.now() - patternStartTime) / (60 * 1000);
        drawPlaybackProgress(elapsedMinutes, totalDuration);
      }, 1000);
    }
  }
  
  // Smooth transition between frequencies
  function transitionToFrequency(startFreq, endFreq, duration) {
    if (!oscillatorRight || !isPlaying) return;
    
    const carrierFreq = 200;
    const steps = Math.max(20, duration * 20); // At least 20 steps, more for longer durations
    const stepTime = duration * 1000 / steps;
    const freqStep = (endFreq - startFreq) / steps;
    
    let currentStep = 0;
    
    // Clear any existing transition
    if (transitionInterval) {
      clearInterval(transitionInterval);
    }
    
    transitionInterval = setInterval(() => {
      if (!isPlaying || !oscillatorRight) {
        clearInterval(transitionInterval);
        return;
      }
      
      currentStep++;
      
      if (currentStep <= steps) {
        const newFreq = startFreq + (freqStep * currentStep);
        oscillatorRight.frequency.value = carrierFreq + newFreq;
      } else {
        // Done with transition
        clearInterval(transitionInterval);
      }
    }, stepTime);
  }
  
  // Stop pattern playback
  function stopPattern() {
    if (!isPlaying) return;
    
    try {
      // Stop any ongoing transition
      if (transitionInterval) {
        clearInterval(transitionInterval);
        transitionInterval = null;
      }
      
      // Stop visualization update
      if (visualizationDrawInterval) {
        clearInterval(visualizationDrawInterval);
        visualizationDrawInterval = null;
      }
      
      // Stop audio
      if (oscillatorLeft) oscillatorLeft.stop();
      if (oscillatorRight) oscillatorRight.stop();
      
      oscillatorLeft = null;
      oscillatorRight = null;
      
      isPlaying = false;
      playButton.disabled = false;
      stopButton.disabled = true;
      
      // Redraw visualization without progress
      drawVisualization();
      
      showNotification("Pattern playback stopped", "info");
    } catch (error) {
      console.error('Error stopping binaural pattern:', error);
    }
  }
  
  // Draw pattern visualization on canvas
  function drawVisualization() {
    if (!canvas || !ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get pattern configuration
    const pattern = patternSelect.value;
    let segments = [];
    
    if (pattern === 'custom') {
      // Get custom segments
      const segmentElements = document.querySelectorAll('.pattern-segment');
      
      segmentElements.forEach(segmentEl => {
        const waveType = segmentEl.querySelector('.segment-wave').value;
        const duration = parseInt(segmentEl.querySelector('.segment-duration').value);
        
        segments.push({
          wave: waveType,
          frequency: getWaveFrequency(waveType),
          duration: duration
        });
      });
    } else {
      segments = patternSteps[pattern] || patternSteps.descent;
    }
    
    if (segments.length === 0) return;
    
    // Calculate total time
    const totalDuration = parseInt(patternDurationSlider.value || 20);
    
    // Calculate total time for all segments
    const segmentDurations = segments.map(s => s.duration);
    const totalSegmentTime = segmentDurations.reduce((a, b) => a + b, 0);
    
    // Scale segment durations to fit within total duration
    const scaleFactor = totalDuration / totalSegmentTime;
    
    // Draw segments
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(255, 51, 102, 0.5)');   // Beta at top
    gradient.addColorStop(0.25, 'rgba(51, 170, 255, 0.5)'); // Alpha
    gradient.addColorStop(0.5, 'rgba(170, 85, 255, 0.5)');  // Theta
    gradient.addColorStop(0.75, 'rgba(85, 255, 170, 0.5)'); // Delta at bottom
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw frequency range background
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw horizontal lines for each wave boundary
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    
    // Beta-Alpha boundary line
    let y = canvas.height * 0.25;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
    
    // Alpha-Theta boundary line
    y = canvas.height * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
    
    // Theta-Delta boundary line
    y = canvas.height * 0.75;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
    
    // Draw the pattern line
    let xPosition = 0;
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;
    
    segments.forEach((segment, index) => {
      const segmentWidth = (segment.duration * scaleFactor / totalDuration) * canvas.width;
      
      // Map frequency to y position
      const frequencyRange = 30; // Max frequency range
      const yPosition = canvas.height - (segment.frequency / frequencyRange * canvas.height);
      
      if (index === 0) {
        ctx.moveTo(xPosition, yPosition);
      } else {
        // Draw a line to this segment
        ctx.lineTo(xPosition, yPosition);
      }
      
      // Draw a line across this segment
      ctx.lineTo(xPosition + segmentWidth, yPosition);
      
      xPosition += segmentWidth;
    });
    
    ctx.stroke();
    
    // Draw dots at each segment junction
    xPosition = 0;
    segments.forEach(segment => {
      const segmentWidth = (segment.duration * scaleFactor / totalDuration) * canvas.width;
      
      // Map frequency to y position
      const frequencyRange = 30; // Max frequency range
      const yPosition = canvas.height - (segment.frequency / frequencyRange * canvas.height);
      
      // Draw dot
      ctx.beginPath();
      ctx.fillStyle = 'white';
      ctx.arc(xPosition, yPosition, 4, 0, Math.PI * 2);
      ctx.fill();
      
      xPosition += segmentWidth;
      
      // Draw final dot for the last segment
      if (xPosition >= canvas.width - 5) {
        ctx.beginPath();
        ctx.arc(xPosition, yPosition, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  
  // Draw playback progress on visualization
  function drawPlaybackProgress(elapsedMinutes, totalDuration) {
    if (!canvas || !ctx) return;
    
    // First redraw the visualization
    drawVisualization();
    
    // Calculate progress position
    const progressX = (elapsedMinutes / totalDuration) * canvas.width;
    
    // Draw progress line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.moveTo(progressX, 0);
    ctx.lineTo(progressX, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw progress indicator
    ctx.beginPath();
    ctx.fillStyle = '#ff00ff';
    ctx.arc(progressX, 10, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Show notification
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification notification-' + type;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
  
  // Listen for page unload to stop audio
  window.addEventListener('beforeunload', function() {
    if (isPlaying) {
      stopPattern();
    }
  });
  
  // Send loaded event when component is ready
  document.dispatchEvent(new CustomEvent('advanced-binaural-loaded'));
});