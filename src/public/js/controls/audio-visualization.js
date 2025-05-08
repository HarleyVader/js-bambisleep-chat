/**
 * Audio visualization module for BambiSleep Chat
 * Provides visual feedback for binaural beats audio
 */
window.audioVisualizer = (function() {
  // Private variables
  let canvas = null;
  let ctx = null;
  let animationId = null;
  let isActive = false;
  let currentType = null;
  
  // Visualization settings for different brainwave types
  const visualSettings = {
    delta: { 
      color1: '#0d47a1', 
      color2: '#1976d2',
      speed: 0.5,
      complexity: 1
    },
    theta: { 
      color1: '#4a148c', 
      color2: '#7b1fa2',
      speed: 0.8,
      complexity: 2
    },
    alpha: { 
      color1: '#cc0174', 
      color2: '#0c2a2a',
      speed: 1.2,
      complexity: 3
    },
    beta: { 
      color1: '#01c69e', 
      color2: '#40002f',
      speed: 1.8,
      complexity: 4
    },
    gamma: { 
      color1: '#df0471', 
      color2: '#110000',
      speed: 2.5,
      complexity: 5
    }
  };
  
  // Initialize module
  function init(containerId = 'binaural-visualizer') {
    try {
      // Get or create container
      let container = document.getElementById(containerId);
      
      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'binaural-visualizer-container';
        
        // Find where to append the container
        const binauralPanel = document.getElementById('binaurals-panel');
        if (binauralPanel) {
          binauralPanel.appendChild(container);
        } else {
          // Fallback to system controls container
          const systemControls = document.querySelector('.system-controls');
          if (systemControls) {
            systemControls.appendChild(container);
          }
        }
      }
      
      // Create canvas if it doesn't exist
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.className = 'binaural-visualizer';
        container.appendChild(canvas);
        
        // Style the container and canvas
        container.style.display = 'none';
        container.style.width = '100%';
        container.style.height = '120px';
        container.style.marginTop = '10px';
        container.style.marginBottom = '10px';
        container.style.borderRadius = '8px';
        container.style.overflow = 'hidden';
        container.style.backgroundColor = 'rgba(12, 42, 42, 0.2)';
        
        canvas.style.width = '100%';
        canvas.style.height = '100%';
      }
      
      // Setup canvas and context
      ctx = canvas.getContext('2d');
      resizeCanvas();
      
      // Set up window resize listener
      window.addEventListener('resize', resizeCanvas);
      
      // Listen for binaural player events
      document.addEventListener('binaural-state-changed', handleBinauralStateChange);
      
      // Success message
      console.log('Audio visualizer initialized');
      
      return true;
    } catch (error) {
      console.error('Error initializing audio visualizer:', error);
      return false;
    }
  }
  
  // Clean up resources
  function tearDown() {
    try {
      // Stop animation
      stopVisualization();
      
      // Remove event listeners
      window.removeEventListener('resize', resizeCanvas);
      document.removeEventListener('binaural-state-changed', handleBinauralStateChange);
      
      // Remove canvas if it exists
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      
      // Reset variables
      canvas = null;
      ctx = null;
      isActive = false;
      currentType = null;
      
      console.log('Audio visualizer torn down');
    } catch (error) {
      console.error('Error during audio visualizer teardown:', error);
    }
  }
  
  // Handle binaural state changes
  function handleBinauralStateChange(event) {
    if (event.detail) {
      const { isPlaying, type } = event.detail;
      
      if (isPlaying && type) {
        startVisualization(type);
      } else {
        stopVisualization();
      }
    }
  }
  
  // Start visualization
  function startVisualization(type) {
    try {
      if (!visualSettings[type]) {
        console.error(`Unknown binaural type: ${type}`);
        return false;
      }
      
      // Show container
      const container = canvas.parentNode;
      if (container) {
        container.style.display = 'block';
      }
      
      // Set current type
      currentType = type;
      isActive = true;
      
      // Start animation
      if (!animationId) {
        draw();
      }
      
      return true;
    } catch (error) {
      console.error('Error starting visualization:', error);
      return false;
    }
  }
  
  // Stop visualization
  function stopVisualization() {
    try {
      isActive = false;
      currentType = null;
      
      // Stop animation
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      
      // Hide container
      const container = canvas.parentNode;
      if (container) {
        container.style.display = 'none';
      }
      
      // Clear canvas
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      return true;
    } catch (error) {
      console.error('Error stopping visualization:', error);
      return false;
    }
  }
  
  // Resize canvas to fit container
  function resizeCanvas() {
    try {
      if (!canvas) return;
      
      const container = canvas.parentNode;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // Redraw if active
      if (isActive && currentType) {
        drawFrame();
      }
    } catch (error) {
      console.error('Error resizing canvas:', error);
    }
  }
  
  // Animation loop
  function draw() {
    if (!isActive || !currentType) {
      cancelAnimationFrame(animationId);
      animationId = null;
      return;
    }
    
    drawFrame();
    animationId = requestAnimationFrame(draw);
  }
  
  // Draw single frame
  function drawFrame() {
    try {
      if (!ctx || !canvas || !currentType) return;
      
      const settings = visualSettings[currentType];
      const time = Date.now() * 0.001 * settings.speed;
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Create gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, settings.color1);
      gradient.addColorStop(1, settings.color2);
      
      // Draw waves
      ctx.beginPath();
      
      const frequency = getBrainwaveFrequency(currentType);
      const amplitude = height * 0.3;
      const waveCount = settings.complexity;
      
      for (let x = 0; x < width; x++) {
        const dx = x / width;
        let y = height / 2;
        
        // Create composite wave
        for (let i = 1; i <= waveCount; i++) {
          const freqMod = frequency * (i * 0.5);
          const phase = time * (i * 0.4);
          y += Math.sin(dx * freqMod * Math.PI * 2 + phase) * (amplitude / i);
        }
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      // Fill with gradient
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Draw circles representing frequency
      const circleCount = Math.ceil(settings.complexity * 2);
      for (let i = 0; i < circleCount; i++) {
        const circleTime = time + (i * 0.5);
        const x = width * (0.2 + 0.6 * Math.sin(circleTime));
        const y = height * (0.3 + 0.4 * Math.cos(circleTime * 0.7));
        const size = 5 + 15 * Math.sin(circleTime * 1.3);
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + 0.1 * Math.sin(circleTime)})`;
        ctx.fill();
      }
      
      // Draw frequency text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${currentType.toUpperCase()} ${frequency}Hz`, width / 2, height - 10);
      
    } catch (error) {
      console.error('Error drawing visualization frame:', error);
    }
  }
  
  // Get center frequency for each brainwave type
  function getBrainwaveFrequency(type) {
    switch (type) {
      case 'delta': return 2;
      case 'theta': return 6;
      case 'alpha': return 10;
      case 'beta': return 20;
      case 'gamma': return 40;
      default: return 10;
    }
  }
  
  // Public API
  return {
    init,
    tearDown,
    startVisualization,
    stopVisualization
  };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Create an event to notify the visualizer when binaural state changes
  if (window.binauralPlayer) {
    // Wrap the original playBinaural method to notify visualizer
    const originalPlay = window.binauralPlayer.playBinaural;
    window.binauralPlayer.playBinaural = function(type) {
      const result = originalPlay.call(this, type);
      
      // Dispatch event for visualizer
      document.dispatchEvent(new CustomEvent('binaural-state-changed', {
        detail: { isPlaying: true, type: type }
      }));
      
      return result;
    };
    
    // Wrap the original stopBinaural method
    const originalStop = window.binauralPlayer.stopBinaural;
    window.binauralPlayer.stopBinaural = function() {
      const result = originalStop.call(this);
      
      // Dispatch event for visualizer
      document.dispatchEvent(new CustomEvent('binaural-state-changed', {
        detail: { isPlaying: false, type: null }
      }));
      
      return result;
    };
  }
  
  // Initialize visualizer
  try {
    window.audioVisualizer.init();
  } catch (error) {
    console.error('Error initializing audio visualizer:', error);
  }
});