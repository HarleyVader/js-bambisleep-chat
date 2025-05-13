document.addEventListener('DOMContentLoaded', function() {
  // Core audio components
  let audioCtx = null;
  let leftOsc = null;
  let rightOsc = null;
  let gainNode = null;
  let isPlaying = false;
  let activePattern = null;
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
  
  // Skip if elements don't exist
  if (!patternSelect || !playBtn) return;
  
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
  
  // Set up event listeners
  patternSelect?.addEventListener('change', function() {
    const pattern = this.value;
    customContainer.style.display = pattern === 'custom' ? '' : 'none';
    patternDesc.textContent = descriptions[pattern] || descriptions.custom;
    renderVisualization();
  });
  
  durationSlider?.addEventListener('input', function() {
    durationValue.textContent = this.value + ' minutes';
    renderVisualization();
  });
  
  transitionSlider?.addEventListener('input', function() {
    transitionValue.textContent = this.value + ' seconds';
  });
  
  addSegmentBtn?.addEventListener('click', function() {
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
    
    segment.querySelector('.remove-segment').addEventListener('click', function() {
      container.removeChild(segment);
      renderVisualization();
    });
    
    renderVisualization();
  });
  
  scienceLink?.addEventListener('click', showScienceInfo);
  playBtn?.addEventListener('click', playPattern);
  stopBtn?.addEventListener('click', stopPattern);
  saveBtn?.addEventListener('click', saveSettings);
  
  // Initialize visualization
  if (canvas) {
    renderVisualization();
  }
  
  // Core functions
  function getFrequency(waveType) {
    const frequencies = { beta: 20, alpha: 10, theta: 6, delta: 2 };
    return frequencies[waveType] || 10;
  }
  
  function getPatternSequence() {
    const pattern = patternSelect.value;
    
    if (pattern === 'custom') {
      const segments = document.querySelectorAll('.pattern-segment');
      const customPattern = [];
      
      segments.forEach(segment => {
        const wave = segment.querySelector('.segment-wave').value;
        const time = parseInt(segment.querySelector('.segment-duration').value);
        
        customPattern.push({
          wave: wave,
          freq: getFrequency(wave),
          time: time
        });
      });
      
      return customPattern.length ? customPattern : patterns.descent;
    }
    
    return patterns[pattern] || patterns.descent;
  }
  
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
      
      // Show notification
      showNotification("Pattern playback started");
      
    } catch (error) {
      console.error('Binaural playback error:', error);
      showNotification("Failed to start audio");
    }
  }
  
  function schedulePattern(sequence) {
    if (!sequence.length) return;
    
    const totalDuration = parseInt(durationSlider.value || 20);
    const transitionTime = parseInt(transitionSlider.value || 30) / 1000;
    
    // Calculate timing
    const totalSegmentTime = sequence.reduce((sum, seg) => sum + seg.time, 0);
    const scaleFactor = totalDuration / totalSegmentTime;
    
    activePattern = {
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
  
  function scheduleNextTransition() {
    const pattern = activePattern;
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
    
    showNotification("Pattern playback stopped");
  }
  
  function renderVisualization() {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Add background
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
    
    // Draw pattern
    const sequence = getPatternSequence();
    if (!sequence.length) return;
    
    const totalTime = sequence.reduce((sum, seg) => sum + seg.time, 0);
    let xPos = 0;
    
    ctx.beginPath();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    
    sequence.forEach((segment, i) => {
      const segWidth = (segment.time / totalTime) * canvas.width;
      const yPos = canvas.height - (segment.freq / 30 * canvas.height); // Map 0-30Hz
      
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
  
  function saveSettings() {
    const settings = {
      advancedBinauralEnabled: enableToggle.checked,
      binauralPattern: patternSelect.value,
      patternDuration: parseInt(durationSlider.value),
      transitionTime: parseInt(transitionSlider.value),
      customPattern: []
    };
    
    // Get custom pattern if selected
    if (patternSelect.value === 'custom') {
      const segments = document.querySelectorAll('.pattern-segment');
      
      segments.forEach(segment => {
        settings.customPattern.push({
          wave: segment.querySelector('.segment-wave').value,
          duration: parseInt(segment.querySelector('.segment-duration').value)
        });
      });
    }
    
    // Save to system state
    if (window.bambiSystem?.saveAdvancedBinaural) {
      window.bambiSystem.saveAdvancedBinaural(settings);
      showNotification("Settings saved");
    } else {
      // Fallback to localStorage
      const state = JSON.parse(localStorage.getItem('bambiSystemState') || '{}');
      state.advancedBinaural = settings;
      localStorage.setItem('bambiSystemState', JSON.stringify(state));
      showNotification("Settings saved");
    }
  }
  
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
  
  function showNotification(message, type = 'info') {
    // Simple notification display
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 15px';
    notification.style.background = type === 'error' ? '#ff3366' : '#0088ff';
    notification.style.color = 'white';
    notification.style.borderRadius = '4px';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.style.opacity = '1', 10);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
  }
  
  // Clean up on page unload
  window.addEventListener('beforeunload', function() {
    if (isPlaying) stopPattern();
  });
  
  // Signal component ready
  document.dispatchEvent(new CustomEvent('advanced-binaural-loaded'));
});