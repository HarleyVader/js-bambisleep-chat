(function() {
  // Image generator presets
  const imagePresets = {
    presets: [
      {
        name: 'Portrait',
        prompt: 'Portrait of a beautiful woman with blonde hair, soft lighting, high quality, photorealistic',
        negativePrompt: 'blurry, distorted, ugly, low quality, deformed face',
        width: 512,
        height: 768
      },
      {
        name: 'Landscape',
        prompt: 'Beautiful landscape scene with mountains, sunset, trees, reflective lake, high detail',
        negativePrompt: 'blurry, distorted, ugly, low quality',
        width: 768,
        height: 512
      },
      {
        name: 'Anime Style',
        prompt: 'Anime style woman, casual outfit, colorful background, detailed',
        negativePrompt: 'blurry, distorted, ugly, low quality, photorealistic',
        width: 512,
        height: 768
      },
      {
        name: 'Fantasy',
        prompt: 'Fantasy castle in the mountains, magic, dragons, epic, detailed landscape',
        negativePrompt: 'blurry, distorted, ugly, low quality',
        width: 768,
        height: 512
      }
    ],
    
    init() {
      this.createPresetButtons();
      this.bindEvents();
    },
    
    createPresetButtons() {
      const container = document.getElementById('preset-container');
      if (!container) return;
      
      // Clear existing buttons
      container.innerHTML = '';
      
      // Create a button for each preset
      this.presets.forEach(preset => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'preset-button';
        btn.dataset.preset = JSON.stringify(preset);
        btn.textContent = preset.name;
        container.appendChild(btn);
      });
    },
    
    bindEvents() {
      // Click handler for preset buttons
      document.addEventListener('click', (e) => {
        if (!e.target.matches('.preset-button')) return;
        
        try {
          const preset = JSON.parse(e.target.dataset.preset);
          this.applyPreset(preset);
        } catch (error) {
          console.error('Error applying preset:', error);
        }
      });
    },
    
    applyPreset(preset) {
      const promptInput = document.getElementById('image-prompt');
      const negativePromptInput = document.getElementById('image-negative-prompt');
      const widthInput = document.getElementById('image-width');
      const heightInput = document.getElementById('image-height');
      
      if (promptInput && preset.prompt) {
        promptInput.value = preset.prompt;
      }
      
      if (negativePromptInput && preset.negativePrompt) {
        negativePromptInput.value = preset.negativePrompt;
      }
      
      if (widthInput && preset.width) {
        widthInput.value = preset.width;
      }
      
      if (heightInput && preset.height) {
        heightInput.value = preset.height;
      }
    }
  };
  
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    imagePresets.init();
  });
  
  // Make accessible globally
  window.imagePresets = imagePresets;
})();
