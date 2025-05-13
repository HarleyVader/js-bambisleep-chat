// Advanced binaural pattern control system
document.addEventListener('DOMContentLoaded', function() {
  // Audio elements
  let audioCtx = null;
  let leftOsc = null;
  let rightOsc = null;
  let gainNode = null;
  let isPlaying = false;
  let pattern = null;
  let transitionTimer = null;
  
  // DOM elements
  const enableToggle = document.getElementById('advanced-binaural-enable');
  const patternSelect = document.getElementById('pattern-select');
  const patternDesc = document.getElementById('pattern-description');
  const customContainer = document.getElementById('custom-pattern-container');
  const addSegmentBtn = document.getElementById('add-segment');
  const durationSlider = document.getElementById('pattern-duration');
  const durationValue = document.getElementById('pattern-duration-value');
  const transitionSlider = document.getElementById('transition-time');
  const transitionValue = document.getElementById('transition-time-value');
  const playBtn = document.getElementById('play-advanced-binaural');
  const stopBtn = document.getElementById('stop-advanced-binaural');
  const saveBtn = document.getElementById('save-advanced-binaural');
  const scienceLink = document.getElementById('science-link');
  const canvas = document.getElementById('pattern-visualization');
  
  // Skip if not on advanced panel
  if (!playBtn || !patternSelect) return;
  
  // Predefined patterns
  const patterns = {
    descent: [
      { wave: "alpha", freq: 10, time: 5 },
      { wave: "theta", freq: 6, time: 10 },
      { wave: "delta", freq: 2, time: 5 }
    ],
    ascent: [
      { wave: "delta", freq: 2, time: 5 },
      { wave: "theta", freq: 6, time: 10 },
      { wave: "alpha", freq: 10, time: 5 }
    ],
    focus: [
      { wave: "alpha", freq: 10, time: 5 },
      { wave: "beta", freq: 18, time: 10 },
      { wave: "alpha", freq: 10, time: 5 }
    ],
    trance: [
      { wave: "alpha", freq: 10, time: 5 },
      { wave: "theta", freq: 6, time: 10 },
      { wave: "alpha", freq: 9, time: 5 }
    ]
  };
  
  // Pattern descriptions
  const descriptions = {
    descent: "Gradually moves from Alpha down to Delta, creating a natural descent into trance.",
    ascent: "Guides you from deep Delta up to Alpha, perfect for waking from trance.",
    focus: "Alternates between Alpha and Beta states to enhance concentration.",
    trance: "Cycles between Alpha and Theta waves to maintain a hypnotic state.",
    custom: "Design your own sequence of brainwave states."
  };
  
  // Initialize
  function init() {
    loadSettings();
    setupListeners();
    drawVisualization();
  }
  
  // Load saved settings
  function loadSettings() {
    if (window.bambiSystem?.state?.advanced) {
      const settings = window.bambiSystem.state.advanced;
      
      // Update controls
      if (enableToggle) enableToggle.checked = settings.enabled;
      if (patternSelect) patternSelect.value = settings.pattern || 'descent';
      if (durationSlider) durationSlider.value = settings.duration || 20;
      if (transitionSlider) transitionSlider.value = settings.transition || 30;
      
      // Update displays
      if (durationValue) durationValue.textContent = (settings.duration || 20) + ' minutes';
      if (transitionValue) transitionValue.textContent = (settings.transition || 30) + ' seconds';
      
      // Update description
      if (patternDesc) {
        patternDesc.textContent = descriptions[settings.pattern] || descriptions.descent;
      }
      
      // Show/hide custom pattern
      if (customContainer) {
        customContainer.style.display = settings.pattern === 'custom' ? '' : 'none';
      }
      
      // Load custom pattern segments
      if (settings.pattern === 'custom' && settings.custom?.length > 0) {
        loadCustomPatternSegments(settings.custom);
      }
    }
  }
  
  // Setup event listeners
  function setupListeners() {
    if (patternSelect) {
      patternSelect.addEventListener('change', function() {
        const pattern = this.value;
        
        // Toggle custom pattern editor
        if (customContainer) {
          customContainer.style.display = pattern === 'custom' ? '' : 'none';
        }
        
        // Update description
        if (patternDesc) {
          patternDesc.textContent = descriptions[pattern] || descriptions.custom;
        }
        
        // Update visualization
        drawVisualization();
      });
    }
    
    if (durationSlider) {
      durationSlider.addEventListener('input', function() {
        if (durationValue) durationValue.textContent = this.value + ' minutes';
        drawVisualization();
      });
    }
    
    if (transitionSlider) {
      transitionSlider.addEventListener('input', function() {
        if (transitionValue) transitionValue.textContent = this.value + ' seconds';
      });
    }
    
    if (addSegmentBtn) {
      addSegmentBtn.addEventListener('click', addPatternSegment);
    }
    
    if (scienceLink) {
      scienceLink.addEventListener('click', showScienceInfo);
    }
    
    if (playBtn) {
      playBtn.addEventListener('click', playPattern);
    }
    
    if (stopBtn) {
      stopBtn.addEventListener('click', stopPattern);
    }
    
    if (saveBtn) {
      saveBtn.addEventListener('click', saveSettings);
    }
  }
  
  // Add a new pattern segment
  function addPatternSegment() {
    const container = document.querySelector('.pattern-segments');
    if (!container) return;
    
    const segment = document.createElement('div');
    segment.className = 'pattern-segment';
    segment.innerHTML = `
      <select class="segment-wave">
        <option value="alpha">Alpha</option>
        <option value="theta">Theta</option>
        <option value="delta">Delta</option>
        <option value="beta">Beta</option>
      </select>
      <input type="number" class="segment-duration" min="1" max="60" value="5"> mins
      <button class="remove-segment">×</button>
    `;
    
    container.appendChild(segment);
    
    // Add remove button handler
    segment.querySelector('.remove-segment').addEventListener('click', function() {
      container.removeChild(segment);
      drawVisualization();
    });
    
    drawVisualization();
  }
  
  // Load custom pattern segments
  function loadCustomPatternSegments(segments) {
    const container = document.querySelector('.pattern-segments');
    if (!container) return;
    
    // Clear existing segments
    container.innerHTML = '';
    
    // Add saved segments
    segments.forEach(segment => {
      const element = document.createElement('div');
      element.className = 'pattern-segment';
      element.innerHTML = `
        <select class="segment-wave">
          <option value="alpha" ${segment.wave === 'alpha' ? 'selected' : ''}>Alpha</option>
          <option value="theta" ${segment.wave === 'theta' ? 'selected' : ''}>Theta</option>
          <option value="delta" ${segment.wave === 'delta' ? 'selected' : ''}>Delta</option>
          <option value="beta" ${segment.wave === 'beta' ? 'selected' : ''}>Beta</option>
        </select>
        <input type="number" class="segment-duration" min="1" max="60" value="${segment.duration}"> mins
        <button class="remove-segment">×</button>
      `;
      
      container.appendChild(element);
      
      // Add remove button handler
      element.querySelector('.remove-segment').addEventListener('click', function() {
        container.removeChild(element);
        drawVisualization();
      });
    });
  }
  
  // Draw pattern visualization
  function drawVisualization() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw frequency bands
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(255, 51, 102, 0.3)');  // Beta
    gradient.addColorStop(0.25, 'rgba(51, 170, 255, 0.3)'); // Alpha
    gradient.addColorStop(0.5, 'rgba(170, 85, 255, 0.3)');  // Theta
    gradient.addColorStop(0.75, 'rgba(85, 255, 170, 0.3)'); // Delta
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw band lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    
    [0.25, 0.5, 0.75].forEach(pos => {
      const y = canvas.height * pos;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    });
    
    // Get current pattern
    const sequence = getPatternSequence();
    if (!sequence.length) return;
    
    // Draw pattern line
    const totalTime = sequence.reduce((sum, seg) => sum + seg.time, 0);
    let xPos = 0;
    
    ctx.beginPath();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    
    sequence.forEach((segment, i) => {
      const segWidth = (segment.time / totalTime) * canvas.width;
      const yPos = canvas.height - (segment.freq / 30 * canvas.height);
      
      if (i === 0) {
        ctx.moveTo(xPos, yPos);
      } else {
        ctx.lineTo(xPos, yPos);
      }
      
      ctx.lineTo(xPos + segWidth, yPos);
      
      // Draw segment marker
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(xPos, yPos, 3, 0, Math.PI * 2);
      ctx.fill();
      
      xPos += segWidth;
    });
    
    // Draw last marker
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(xPos, canvas.height - (sequence[sequence.length-1].freq / 30 * canvas.height), 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Finish line
    ctx.stroke();
  }
  
  // Get current pattern sequence
  function getPatternSequence() {
    const patternType = patternSelect.value;
    
    if (patternType === 'custom') {
      const segments = document.querySelectorAll('.pattern-segment');
      const customPattern = [];
      
      segments.forEach(segment => {
        const wave = segment.querySelector('.segment-wave').value;
        const time = parseInt(segment.querySelector('.segment-duration').value);
        
        customPattern.push({
          wave: wave,
          freq: getWaveFrequency(wave),
          time: time
        });
      });
      
      return customPattern.length ? customPattern : patterns.descent;
    }
    
    return patterns[patternType] || patterns.descent;
  }
  
  // Get frequency for a wave type
  function getWaveFrequency(waveType) {
    const frequencies = { beta: 20, alpha: 10, theta: 6, delta: 2 };
    return frequencies[waveType] || 10;
  }
  
  // Play pattern
  function playPattern() {
    if (isPlaying) return;
    
    try {
      // Create audio context
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      gainNode = audioCtx.createGain();
      gainNode.gain.value = 0.5;
      gainNode.connect(audioCtx.destination);
      
      // Create oscillators
      leftOsc = audioCtx.createOscillator();
      rightOsc = audioCtx.createOscillator();
      
      // Setup stereo output
      const merger = audioCtx.createChannelMerger(2);
      leftOsc.connect(merger, 0, 0);
      rightOsc.connect(merger, 0, 1);
      merger.connect(gainNode);
      
      // Get pattern and start with first segment
      const sequence = getPatternSequence();
      const firstSegment = sequence[0];
      const carrierFreq = 200;
      
      leftOsc.frequency.value = carrierFreq;
      rightOsc.frequency.value = carrierFreq + firstSegment.freq;
      
      leftOsc.start();
      rightOsc.start();
      
      // Set up playback
      isPlaying = true;
      playBtn.disabled = true;
      stopBtn.disabled = false;
      
      // Process pattern sequence
      schedulePattern(sequence);
      
      showMessage("Pattern playback started");
    } catch (error) {
      console.error('Binaural playback error:', error);
      showMessage("Failed to start audio", true);
    }
  }
  
  // Schedule pattern progression
  function schedulePattern(sequence) {
    if (!sequence.length) return;
    
    const totalDuration = parseInt(durationSlider.value || 20);
    const transitionTime = parseInt(transitionSlider.value || 30) / 1000;
    
    // Calculate timing
    const totalSegmentTime = sequence.reduce((sum, seg) => sum + seg.time, 0);
    const scaleFactor = totalDuration / totalSegmentTime;
    
    pattern = {
      sequence: sequence,
      startTime: Date.now(),
      segmentIndex: 0,
      scaleFactor: scaleFactor,
      totalDuration: totalDuration,
      transitionTime: transitionTime
    };
    
    // Schedule first transition
    scheduleNextTransition();
  }
  
  // Schedule next transition
  function scheduleNextTransition() {
    if (!pattern || !isPlaying) return;
    
    const currentSeg = pattern.sequence[pattern.segmentIndex];
    const scaledDuration = currentSeg.time * pattern.scaleFactor;
    
    // Schedule next segment if not the last one
    if (pattern.segmentIndex < pattern.sequence.length - 1) {
      transitionTimer = setTimeout(() => {
        pattern.segmentIndex++;
        const nextSeg = pattern.sequence[pattern.segmentIndex];
        
        // Transition to new frequency
        transitionFrequency(currentSeg.freq, nextSeg.freq, pattern.transitionTime);
        
        // Schedule the next transition
        scheduleNextTransition();
      }, scaledDuration * 60 * 1000);
    } else {
      // End of pattern
      transitionTimer = setTimeout(() => {
        stopPattern();
      }, scaledDuration * 60 * 1000);
    }
  }
  
  // Transition between frequencies
  function transitionFrequency(fromFreq, toFreq, duration) {
    if (!rightOsc || !isPlaying) return;
    
    const carrierFreq = 200;
    const steps = 20;
    const stepTime = duration * 1000 / steps;
    const freqStep = (toFreq - fromFreq) / steps;
    let step = 0;
    
    const interval = setInterval(() => {
      if (!isPlaying || !rightOsc) {
        clearInterval(interval);
        return;
      }
      
      step++;
      
      if (step <= steps) {
        const newFreq = fromFreq + (freqStep * step);
        rightOsc.frequency.value = carrierFreq + newFreq;
      } else {
        clearInterval(interval);
      }
    }, stepTime);
  }
  
  // Stop pattern playback
  function stopPattern() {
    if (!isPlaying) return;
    
    clearTimeout(transitionTimer);
    
    if (leftOsc) leftOsc.stop();
    if (rightOsc) rightOsc.stop();
    
    leftOsc = null;
    rightOsc = null;
    audioCtx = null;
    
    isPlaying = false;
    playBtn.disabled = false;
    stopBtn.disabled = true;
    
    showMessage("Pattern playback stopped");
  }
  
  // Save current settings
  function saveSettings() {
    const settings = {
      enabled: enableToggle.checked,
      pattern: patternSelect.value,
      duration: parseInt(durationSlider.value),
      transition: parseInt(transitionSlider.value),
      custom: []
    };
    
    // Get custom pattern if selected
    if (patternSelect.value === 'custom') {
      const segments = document.querySelectorAll('.pattern-segment');
      
      segments.forEach(segment => {
        settings.custom.push({
          wave: segment.querySelector('.segment-wave').value,
          duration: parseInt(segment.querySelector('.segment-duration').value)
        });
      });
    }
    
    if (window.bambiSystem?.saveState) {
      window.bambiSystem.saveState('advanced', settings);
      showMessage("Settings saved");
    }
  }
  
  // Show science info modal
  function showScienceInfo(e) {
    e.preventDefault();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>The Science of Binaural Beats</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <p>Binaural beats occur when two slightly different frequencies are played in separate ears. Your brain creates a third beat equal to the difference between them.</p>
          <p>For example, a 200 Hz tone in your left ear and 210 Hz in your right creates a perceived 10 Hz beat (alpha wave range).</p>
          <p>Research suggests these beats may enhance meditative states and potentially influence cognitive processes through a mechanism called "frequency following response."</p>
          <p class="citation">Source: ABC Science, April 2022</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', e => {
      if (e.target === modal) document.body.removeChild(modal);
    });
  }
  
  // Show message
  function showMessage(message, isError) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 15px';
    notification.style.background = isError ? '#ff3366' : '#0088ff';
    notification.style.color = 'white';
    notification.style.borderRadius = '4px';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.style.opacity = '1', 10);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', function() {
    if (isPlaying) stopPattern();
  });
  
  // Start initialization
  init();
  
  // Notify system
  document.dispatchEvent(new CustomEvent('advanced-binaural-loaded'));
});