window.bambiSpirals = (function() {
  // Default values
  let spiral1Width = 5.0;
  let spiral2Width = 3.0;
  let spiral1Speed = 20;
  let spiral2Speed = 15;
  
  // Add function to get current spiral settings
  function getCurrentSettings() {
    const spiralsEnable = document.getElementById('spirals-enable');
    return {
      enabled: spiralsEnable ? spiralsEnable.checked : false,
      spiral1Width: spiral1Width,
      spiral2Width: spiral2Width,
      spiral1Speed: spiral1Speed,
      spiral2Speed: spiral2Speed
    };
  }
  
  // Add this method to update spirals from system settings
  function updateSettings(data) {
    if (!data) return;
    
    // Update local variables
    spiral1Width = data.spiral1Width || spiral1Width;
    spiral2Width = data.spiral2Width || spiral2Width;
    spiral1Speed = data.spiral1Speed || spiral1Speed;
    spiral2Speed = data.spiral2Speed || spiral2Speed;
    
    // Update UI if exists
    const spiralsEnable = document.getElementById('spirals-enable');
    if (spiralsEnable && data.enabled !== undefined) {
      spiralsEnable.checked = data.enabled;
      
      // Show/hide spiral based on enabled state
      if (data.enabled) showSpiral();
      else hideSpiral();
    }
    
    // Update sliders
    ['spiral1-width', 'spiral2-width', 'spiral1-speed', 'spiral2-speed'].forEach((id, i) => {
      const slider = document.getElementById(id);
      const value = [spiral1Width, spiral2Width, spiral1Speed, spiral2Speed][i];
      if (slider) slider.value = value;
      
      const valueDisplay = document.getElementById(`${id}-value`);
      if (valueDisplay) valueDisplay.textContent = value;
    });
  }
  
  function init() {
    const spiralsEnable = document.getElementById('spirals-enable');
    const spiral1WidthSlider = document.getElementById('spiral1-width');
    const spiral2WidthSlider = document.getElementById('spiral2-width');
    const spiral1SpeedSlider = document.getElementById('spiral1-speed');
    const spiral2SpeedSlider = document.getElementById('spiral2-speed');
    const saveButton = document.getElementById('save-spirals');
    
    if (spiralsEnable) {
      spiralsEnable.addEventListener('change', toggleSpiralDisplay);
      
      // Create or ensure the eyeCursor element exists
      ensureEyeCursorExists();
      
      // Initialize spiral display based on checkbox state
      if (spiralsEnable.checked) {
        showSpiral();
      } else {
        hideSpiral();
      }
    }
    
    // Setup event listeners for all sliders
    if (spiral1WidthSlider) {
      spiral1WidthSlider.addEventListener('input', updateSpiralParams);
    }
    
    if (spiral2WidthSlider) {
      spiral2WidthSlider.addEventListener('input', updateSpiralParams);
    }
    
    if (spiral1SpeedSlider) {
      spiral1SpeedSlider.addEventListener('input', updateSpiralParams);
    }
    
    if (spiral2SpeedSlider) {
      spiral2SpeedSlider.addEventListener('input', updateSpiralParams);
    }
    
    if (saveButton) {
      saveButton.addEventListener('click', saveSettings);
    }
    
    // Initialize spiral if enabled
    if (spiralsEnable && spiralsEnable.checked) {
      initSpiral();
    }
  }
  
  function updateSpiralParams() {
    // Get values from sliders
    spiral1Width = parseFloat(document.getElementById('spiral1-width').value);
    spiral2Width = parseFloat(document.getElementById('spiral2-width').value);
    spiral1Speed = parseInt(document.getElementById('spiral1-speed').value);
    spiral2Speed = parseInt(document.getElementById('spiral2-speed').value);
    
    // Update the values in the spiral script if it exists
    if (typeof updateSpiralParams === "function") {
      updateSpiralParams(spiral1Width, spiral2Width, spiral1Speed, spiral2Speed);
    }
  }
  
  function toggleSpiralDisplay() {
    const spiralsEnable = document.getElementById('spirals-enable');
    
    if (spiralsEnable.checked) {
      showSpiral();
    } else {
      hideSpiral();
    }
  }
  
  function showSpiral() {
    ensureEyeCursorExists();
    const eyeCursor = document.getElementById('eyeCursor');
    if (eyeCursor) {
      eyeCursor.style.display = 'block';
      if (!window.p5Instance) {
        initSpiral();
      }
    }
  }
  
  function hideSpiral() {
    const eyeCursor = document.getElementById('eyeCursor');
    if (eyeCursor) {
      eyeCursor.style.display = 'none';
    }
  }
  
  function ensureEyeCursorExists() {
    if (!document.getElementById('eyeCursor')) {
      const eyeCursor = document.createElement('div');
      eyeCursor.id = 'eyeCursor';
      eyeCursor.style.position = 'fixed';
      eyeCursor.style.top = '0';
      eyeCursor.style.left = '0';
      eyeCursor.style.width = '100%';
      eyeCursor.style.height = '100%';
      eyeCursor.style.pointerEvents = 'none';
      eyeCursor.style.zIndex = '1000';
      eyeCursor.style.display = 'none';
      document.body.appendChild(eyeCursor);
    }
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
        
        // Draw two spirals with different parameters
        drawSpiral(p, spiral1Speed, 1, [199, 0, 199], spiral1Width);
        drawSpiral(p, spiral2Speed, 0.3, [255, 130, 255], spiral2Width);
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
    
    fetch('/api/profile/spirals', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        enabled: enable,
        spiral1Width: spiral1Width,
        spiral2Width: spiral2Width,
        spiral1Speed: spiral1Speed,
        spiral2Speed: spiral2Speed
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showSuccessMessage('Settings saved!');
      }
    })
    .catch(err => console.error('Error saving spiral settings:', err));
  }
  
  function showSuccessMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'success-message';
    msg.textContent = text;
    msg.style.position = 'absolute';
    msg.style.bottom = '10px';
    msg.style.left = '50%';
    msg.style.transform = 'translateX(-50%)';
    msg.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
    msg.style.color = '#00ff00';
    msg.style.padding = '5px 10px';
    msg.style.borderRadius = '4px';
    
    const panel = document.getElementById('spirals-panel');
    if (panel) {
      panel.appendChild(msg);
      setTimeout(() => msg.remove(), 3000);
    }
  }
  
  return { 
    init,
    getCurrentSettings,
    updateSettings  // Export the new function
  };
})();