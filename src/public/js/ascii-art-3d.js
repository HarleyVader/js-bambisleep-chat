/**
 * 3D ASCII Art Generator
 * Creates animated 3D ASCII art with customizable text and effects
 */

class AsciiArt3D {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    this.options = {
      text: options.text || 'MELKANEA',
      charSet: options.charSet || '@#$%?*+;:,. ',
      colors: options.colors || ['#ff66cc', '#cc66ff', '#9966ff', '#6699ff', '#66ccff'],
      speed: options.speed || 50,
      depth: options.depth || 5,
      size: options.size || '20px',
      backgroundColor: options.backgroundColor || '#000',
      rotate: options.rotate !== undefined ? options.rotate : true,
      pulse: options.pulse !== undefined ? options.pulse : true,
      rainbow: options.rainbow !== undefined ? options.rainbow : true
    };
    
    this.init();
  }
  
  init() {
    // Create container with appropriate styling
    this.container.style.fontFamily = 'monospace';
    this.container.style.whiteSpace = 'pre';
    this.container.style.textAlign = 'center';
    this.container.style.fontSize = this.options.size;
    this.container.style.color = this.options.colors[0];
    this.container.style.background = this.options.backgroundColor;
    this.container.style.overflow = 'hidden';
    this.container.style.padding = '20px';
    this.container.style.perspective = '1000px';
    
    // Generate layers for 3D effect
    this.layers = [];
    for (let i = 0; i < this.options.depth; i++) {
      const layer = document.createElement('div');
      layer.style.position = 'relative';
      layer.style.transformStyle = 'preserve-3d';
      layer.style.transition = 'all 0.3s ease';
      this.container.appendChild(layer);
      this.layers.push(layer);
    }
    
    // Generate initial ASCII art
    this.generateAsciiArt();
    
    // Start animation
    this.animate();
  }
  
  generateAsciiArt() {
    const { text } = this.options;
    const ascii = this.textToAscii(text);
    
    // Apply to each layer with different effects
    this.layers.forEach((layer, index) => {
      const depth = index / this.options.depth;
      layer.innerHTML = ascii;
      layer.style.opacity = 1 - (depth * 0.6);
      layer.style.transform = `translateZ(${index * -10}px)`;
      layer.style.color = this.options.colors[index % this.options.colors.length];
    });
  }
  
  textToAscii(text) {
    // Simple conversion - for more complex conversion, use a library
    // or implement more sophisticated ASCII art generation
    let result = '';
    const letters = {
      'M': [
        '  M   M  ',
        ' MMM MMM ',
        ' MM M MM ',
        ' M  M  M ',
        ' M     M '
      ],
      'E': [
        ' EEEEEEE ',
        ' E       ',
        ' EEEEE   ',
        ' E       ',
        ' EEEEEEE '
      ],
      'L': [
        ' L       ',
        ' L       ',
        ' L       ',
        ' L       ',
        ' LLLLLLL '
      ],
      'K': [
        ' K    K  ',
        ' K   K   ',
        ' KKK     ',
        ' K   K   ',
        ' K    K  '
      ],
      'A': [
        '    A    ',
        '   A A   ',
        '  AAAAA  ',
        ' A     A ',
        'A       A'
      ],
      'N': [
        ' N     N ',
        ' NN    N ',
        ' N N   N ',
        ' N  N  N ',
        ' N    NN '
      ],
      'B': [
        ' BBBBBB  ',
        ' B     B ',
        ' BBBBBB  ',
        ' B     B ',
        ' BBBBBB  '
      ],
      'I': [
        ' IIIIIII ',
        '    I    ',
        '    I    ',
        '    I    ',
        ' IIIIIII '
      ],
      'S': [
        '  SSSSS  ',
        ' S       ',
        '  SSSSS  ',
        '       S ',
        '  SSSSS  '
      ],
      'P': [
        ' PPPPPP  ',
        ' P     P ',
        ' PPPPPP  ',
        ' P       ',
        ' P       '
      ],
      ' ': [
        '         ',
        '         ',
        '         ',
        '         ',
        '         '
      ]
    };
    
    // Process each character in the text
    const upperText = text.toUpperCase();
    const rows = ['', '', '', '', ''];
    
    for (const char of upperText) {
      const letterPattern = letters[char] || letters[' '];
      for (let i = 0; i < rows.length; i++) {
        rows[i] += letterPattern[i];
      }
    }
    
    return rows.join('\n');
  }
  
  animate() {
    let frame = 0;
    const animateFrame = () => {
      frame++;
      
      // Apply different animation effects
      this.layers.forEach((layer, index) => {
        const depth = index / this.options.depth;
        
        if (this.options.rotate) {
          const rotateY = Math.sin(frame / 60) * 10;
          const rotateX = Math.cos(frame / 60) * 5;
          layer.style.transform = `translateZ(${index * -10}px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
        }
        
        if (this.options.pulse) {
          const scale = 1 + Math.sin(frame / 30) * 0.05;
          layer.style.transform += ` scale(${scale})`;
        }
        
        if (this.options.rainbow) {
          const hue = (frame + index * 30) % 360;
          layer.style.color = `hsl(${hue}, 100%, 70%)`;
        }
      });
      
      requestAnimationFrame(animateFrame);
    };
    
    animateFrame();
  }
  
  setText(newText) {
    this.options.text = newText;
    this.generateAsciiArt();
  }
  
  setColors(colors) {
    this.options.colors = colors;
    this.generateAsciiArt();
  }
  
  toggleEffect(effect, state) {
    if (this.options[effect] !== undefined) {
      this.options[effect] = state;
    }
  }
}

// Demo function to showcase the ASCII art generator
function createAsciiArtDemo(containerId, text) {
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with ID '${containerId}' not found`);
      return;
    }
    
    const asciiArt = new AsciiArt3D(container, {
      text: text || 'MELKANEA',
      colors: ['#ff66cc', '#cc66ff', '#9966ff', '#6699ff', '#66ccff'],
      depth: 5,
      size: '14px',
      speed: 50
    });
    
    // Optional: Create controls for the demo
    const controls = document.createElement('div');
    controls.className = 'ascii-controls';
    controls.style.marginTop = '20px';
    
    // Text input
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = asciiArt.options.text;
    textInput.placeholder = 'Enter text';
    textInput.addEventListener('input', () => {
      asciiArt.setText(textInput.value);
    });
    
    // Toggle buttons
    const effectTypes = ['rotate', 'pulse', 'rainbow'];
    const toggles = effectTypes.map(effect => {
      const label = document.createElement('label');
      label.style.marginLeft = '10px';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = asciiArt.options[effect];
      checkbox.addEventListener('change', () => {
        asciiArt.toggleEffect(effect, checkbox.checked);
      });
      
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${effect}`));
      
      return label;
    });
    
    controls.appendChild(textInput);
    toggles.forEach(toggle => controls.appendChild(toggle));
    
    container.parentNode.insertBefore(controls, container.nextSibling);
  });
}

// Export the class and demo function
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AsciiArt3D, createAsciiArtDemo };
} else {
  window.AsciiArt3D = AsciiArt3D;
  window.createAsciiArtDemo = createAsciiArtDemo;
}