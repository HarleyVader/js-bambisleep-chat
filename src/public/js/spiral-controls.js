window.bambiSpirals = (function() {
  // Default values
  let speedValue = 5;
  let widthValue = 5;
  
  function init() {
    const spiralsEnable = document.getElementById('spirals-enable');
    const spiralSpeed = document.getElementById('spiral-speed');
    const spiralWidth = document.getElementById('spiral-width');
    const saveButton = document.getElementById('save-spirals');
    
    if (spiralsEnable) {
      spiralsEnable.addEventListener('change', toggleSpiralDisplay);
    }
    
    if (spiralSpeed) {
      spiralSpeed.addEventListener('input', function() {
        updateSpeedLabel(this.value);
        speedValue = parseInt(this.value);
        updateSpiralPreview();
      });
      updateSpeedLabel(spiralSpeed.value);
    }
    
    if (spiralWidth) {
      spiralWidth.addEventListener('input', function() {
        updateWidthLabel(this.value);
        widthValue = parseInt(this.value);
        updateSpiralPreview();
      });
      updateWidthLabel(spiralWidth.value);
    }
    
    if (saveButton) {
      saveButton.addEventListener('click', saveSettings);
    }
    
    // Initialize spiral if enabled
    if (spiralsEnable && spiralsEnable.checked) {
      initSpiral();
    }
  }
  
  function updateSpeedLabel(value) {
    const speedText = document.getElementById('spiral-speed-value');
    if (!speedText) return;
    
    const labels = ['Very Slow', 'Slow', 'Moderate', 'Normal', 'Medium', 'Fast', 'Faster', 'Very Fast', 'Super Fast', 'Extreme'];
    speedText.textContent = labels[parseInt(value) - 1] || 'Normal';
  }
  
  function updateWidthLabel(value) {
    const widthText = document.getElementById('spiral-width-value');
    if (!widthText) return;
    
    const labels = ['Very Thin', 'Thin', 'Slender', 'Normal', 'Medium', 'Wide', 'Wider', 'Very Wide', 'Super Wide', 'Extreme'];
    widthText.textContent = labels[parseInt(value) - 1] || 'Normal';
  }
  
  function toggleSpiralDisplay() {
    const spiralsEnable = document.getElementById('spirals-enable');
    
    if (spiralsEnable.checked) {
      initSpiral();
    } else if (window.p5Instance) {
      window.p5Instance.remove();
      window.p5Instance = null;
    }
  }
  
  function updateSpiralPreview() {
    // This will be handled by p5 draw loop
  }
  
  function initSpiral() {
    if (typeof p5 === 'undefined') {
      console.warn('p5.js library not loaded');
      return;
    }
    
    if (window.p5Instance) return; // Already initialized
    
    window.p5Instance = new p5(function(p) {
      let width, height;
      
      p.setup = function() {
        const container = document.getElementById('eyeCursor');
        if (!container) return;
        
        width = container.clientWidth;
        height = container.clientHeight;
        
        const canvas = p.createCanvas(width, height);
        canvas.parent('eyeCursor');
        
        window.addEventListener('resize', function() {
          if (!container) return;
          width = container.clientWidth;
          height = container.clientHeight;
          p.resizeCanvas(width, height);
        });
      };
      
      p.draw = function() {
        p.clear();
        p.translate(width / 2, height / 2);
        
        // Map slider values to actual spiral parameters
        const speed = p.map(speedValue, 1, 10, 0.5, 2.5);
        const spiralWidth = p.map(widthValue, 1, 10, 2, 10);
        
        p.rotate(p.frameCount / (11 - speedValue)); // Rotation speed based on slider
        
        // Draw two spirals with different parameters
        drawSpiral(p, speed, 1, [199, 0, 199], spiralWidth);
        drawSpiral(p, speed * 0.8, 0.3, [255, 130, 255], spiralWidth * 0.7);
      };
      
      function drawSpiral(p, step, ang, color, width) {
        p.fill(color[0], color[1], color[2]);
        p.stroke(color[0], color[1], color[2]);
        
        let r1 = 0;
        let r2 = 2;
        let spiralWidth = width;
        let dw = spiralWidth / 350;
        
        p.beginShape(p.TRIANGLE_STRIP);
        for (let i = 0; i < 450; i++) {
          r1 += step;
          spiralWidth -= dw;
          r2 = r1 + spiralWidth;
          
          const r1x = r1 * p.sin(ang * i);
          const r1y = r1 * p.cos(ang * i);
          const r2x = r2 * p.sin(ang * i);
          const r2y = r2 * p.cos(ang * i);
          
          p.vertex(r1x, r1y);
          p.vertex(r2x, r2y);
        }
        p.endShape();
      }
    });
  }
  
  function saveSettings() {
    const enable = document.getElementById('spirals-enable').checked;
    const speed = document.getElementById('spiral-speed').value;
    const width = document.getElementById('spiral-width').value;
    
    fetch('/api/profile/spirals', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        enabled: enable,
        speed: speed,
        width: width
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const msg = document.createElement('div');
        msg.className = 'success-message';
        msg.textContent = 'Settings saved!';
        msg.style.position = 'absolute';
        msg.style.bottom = '10px';
        msg.style.left = '50%';
        msg.style.transform = 'translateX(-50%)';
        msg.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
        msg.style.color = '#00ff00';
        msg.style.padding = '5px 10px';
        msg.style.borderRadius = '4px';
        
        document.querySelector('.spirals-preview').appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
      }
    })
    .catch(err => console.error('Error saving spiral settings:', err));
  }
  
  return { init };
})();