// Spiral controls
document.addEventListener('DOMContentLoaded', function() {
  // Core elements
  const saveBtn = document.getElementById('save-spirals');
  const enableToggle = document.getElementById('spirals-enable');
  const width1Slider = document.getElementById('spiral1-width');
  const width2Slider = document.getElementById('spiral2-width');
  const speed1Slider = document.getElementById('spiral1-speed');
  const speed2Slider = document.getElementById('spiral2-speed');
  
  // Current values
  let spiral1Width = 5.0;
  let spiral2Width = 3.0;
  let spiral1Speed = 20;
  let spiral2Speed = 15;
  
  // Skip if no spirals panel
  if (!saveBtn || !enableToggle) return;
  
  // P5 instance for spiral drawing
  let p5Instance = null;
  
  // Initialize
  function init() {
    loadSettings();
    setupListeners();
    
    // Set initial spiral state
    if (enableToggle.checked) {
      showSpiral();
    }
  }
  
  // Setup event listeners
  function setupListeners() {
    // Enable toggle
    enableToggle.addEventListener('change', function() {
      if (this.checked) showSpiral();
      else hideSpiral();
    });
    
    // Sliders
    [width1Slider, width2Slider, speed1Slider, speed2Slider].forEach(slider => {
      if (!slider) return;
      
      slider.addEventListener('input', function() {
        updateValues();
        updateSpiral();
      });
    });
    
    // Save button
    saveBtn.addEventListener('click', saveSettings);
  }
  
  // Load saved settings
  function loadSettings() {
    if (window.bambiSystem?.state?.spirals) {
      const settings = window.bambiSystem.state.spirals;
      
      // Update DOM
      enableToggle.checked = settings.enabled;
      
      if (width1Slider) width1Slider.value = settings.spiral1Width;
      if (width2Slider) width2Slider.value = settings.spiral2Width;
      if (speed1Slider) speed1Slider.value = settings.spiral1Speed;
      if (speed2Slider) speed2Slider.value = settings.spiral2Speed;
      
      // Update values
      spiral1Width = settings.spiral1Width;
      spiral2Width = settings.spiral2Width;
      spiral1Speed = settings.spiral1Speed;
      spiral2Speed = settings.spiral2Speed;
      
      // Update value displays
      const spiral1WidthEl = document.getElementById('spiral1-width-value');
      const spiral2WidthEl = document.getElementById('spiral2-width-value');
      const spiral1SpeedEl = document.getElementById('spiral1-speed-value');
      const spiral2SpeedEl = document.getElementById('spiral2-speed-value');
      
      if (spiral1WidthEl) spiral1WidthEl.textContent = spiral1Width;
      if (spiral2WidthEl) spiral2WidthEl.textContent = spiral2Width;
      if (spiral1SpeedEl) spiral1SpeedEl.textContent = spiral1Speed;
      if (spiral2SpeedEl) spiral2SpeedEl.textContent = spiral2Speed;
    }
  }
  
  // Update current values from sliders
  function updateValues() {
    spiral1Width = parseFloat(width1Slider.value);
    spiral2Width = parseFloat(width2Slider.value);
    spiral1Speed = parseInt(speed1Slider.value);
    spiral2Speed = parseInt(speed2Slider.value);
    
    // Update displays
    const spiral1WidthEl = document.getElementById('spiral1-width-value');
    const spiral2WidthEl = document.getElementById('spiral2-width-value');
    const spiral1SpeedEl = document.getElementById('spiral1-speed-value');
    const spiral2SpeedEl = document.getElementById('spiral2-speed-value');
    
    if (spiral1WidthEl) spiral1WidthEl.textContent = spiral1Width;
    if (spiral2WidthEl) spiral2WidthEl.textContent = spiral2Width;
    if (spiral1SpeedEl) spiral1SpeedEl.textContent = spiral1Speed;
    if (spiral2SpeedEl) spiral2SpeedEl.textContent = spiral2Speed;
  }
  
  // Save current settings
  function saveSettings() {
    const settings = {
      enabled: enableToggle.checked,
      spiral1Width,
      spiral2Width,
      spiral1Speed,
      spiral2Speed
    };
    
    if (window.bambiSystem?.saveState) {
      window.bambiSystem.saveState('spirals', settings);
      showMessage('Spiral settings saved!');
    }
  }
  
  // Show spirals
  function showSpiral() {
    ensureEyeCursor();
    const eyeCursor = document.getElementById('eyeCursor');
    if (!eyeCursor) return;
    
    eyeCursor.style.display = 'block';
    
    if (!p5Instance && typeof p5 !== 'undefined') {
      initP5();
    }
  }
  
  // Hide spirals
  function hideSpiral() {
    const eyeCursor = document.getElementById('eyeCursor');
    if (eyeCursor) eyeCursor.style.display = 'none';
  }
  
  // Ensure eye cursor element exists
  function ensureEyeCursor() {
    if (!document.getElementById('eyeCursor')) {
      const cursor = document.createElement('div');
      cursor.id = 'eyeCursor';
      cursor.style.position = 'fixed';
      cursor.style.top = '0';
      cursor.style.left = '0';
      cursor.style.width = '100%';
      cursor.style.height = '100%';
      cursor.style.pointerEvents = 'none';
      cursor.style.zIndex = '1000';
      cursor.style.display = 'none';
      document.body.appendChild(cursor);
    }
  }
  
  // Initialize p5 drawing
  function initP5() {
    if (p5Instance) return;
    
    p5Instance = new p5(function(p) {
      let width, height;
      
      p.setup = function() {
        const container = document.getElementById('eyeCursor');
        width = container.clientWidth;
        height = container.clientHeight;
        
        p.createCanvas(width, height).parent('eyeCursor');
        
        // Resize handler
        window.addEventListener('resize', function() {
          width = container.clientWidth;
          height = container.clientHeight;
          p.resizeCanvas(width, height);
        });
      };
      
      p.draw = function() {
        p.clear();
        p.translate(width / 2, height / 2);
        
        // Animation values
        const a = p.map(p.sin(p.frameCount / spiral1Speed), -1, 1, 0.5, 1.5);
        const b = p.map(p.cos(p.frameCount / spiral2Speed), -1, 1, 1, 1.5);
        
        p.rotate(p.frameCount / 5);
        
        // Draw spirals
        drawSpiral(p, a, 1, [199, 0, 199], spiral1Width);
        drawSpiral(p, b, 0.3, [255, 130, 255], spiral2Width);
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
  
  // Update spiral parameters
  function updateSpiral() {
    // Nothing to do if no instance
    if (!p5Instance) return;
  }
  
  // Show message
  function showMessage(text) {
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
  
  // Start initialization
  init();
});