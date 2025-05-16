(function() {
  // Image generator UI functionality
  const imageGeneratorUI = {
    form: null,
    promptInput: null,
    negativePromptInput: null,
    widthInput: null,
    heightInput: null,
    generateButton: null,
    resultContainer: null,
    statusElement: null,
    activeJobId: null,
    pollInterval: null,
    heartbeatInterval: null,
    lastHeartbeatTime: 0,
    
    init() {
      // Find elements
      this.form = document.getElementById('image-generator-form');
      if (!this.form) return;
      
      this.promptInput = document.getElementById('image-prompt');
      this.negativePromptInput = document.getElementById('image-negative-prompt');
      this.widthInput = document.getElementById('image-width');
      this.heightInput = document.getElementById('image-height');
      this.generateButton = document.getElementById('generate-image-btn');
      this.resultContainer = document.getElementById('image-result');
      this.statusElement = document.getElementById('image-generation-status');
      
      // Bind events
      this.bindEvents();
      
      // Start heartbeat to keep worker active
      this.startHeartbeat();
    },
    
    bindEvents() {
      if (!this.form) return;
      
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.generateImage();
      });
      
      // Listen for socket events
      if (window.socket) {
        socket.on('image-generated', this.handleImageGenerated.bind(this));
        socket.on('image-generation-error', this.handleImageGenerationError.bind(this));
        socket.on('image-generation-started', this.handleImageGenerationStarted.bind(this));
        socket.on('image-generation-status', this.handleImageGenerationStatus.bind(this));
        socket.on('image-heartbeat-response', this.handleHeartbeatResponse.bind(this));
        
        // Listen for reconnection events
        socket.on('connect', () => {
          console.log('Socket reconnected, restarting heartbeat');
          this.startHeartbeat();
        });
        
        socket.on('disconnect', () => {
          console.log('Socket disconnected, pausing heartbeat');
          this.stopHeartbeat();
        });
      }
    },
    
    generateImage() {
      if (!this.promptInput || !window.socket) return;
      
      // Clear any existing job polling
      this.clearJobPolling();
      
      const prompt = this.promptInput.value.trim();
      if (!prompt) {
        this.updateStatus('Please enter a prompt', 'error');
        return;
      }
      
      // Prepare data
      const data = {
        prompt,
        negativePrompt: this.negativePromptInput ? this.negativePromptInput.value.trim() : '',
        width: this.widthInput ? parseInt(this.widthInput.value) || 512 : 512,
        height: this.heightInput ? parseInt(this.heightInput.value) || 512 : 512
      };
      
      // Show loading state
      this.updateStatus('Generating image...', 'loading');
      this.disableForm(true);
      
      // Send request via socket
      socket.emit('generate-image', data);
    },
    
    handleImageGenerated(result) {
      this.disableForm(false);
      this.clearJobPolling();
      this.activeJobId = null;
      
      if (!result || !result.success) {
        this.updateStatus('Error generating image', 'error');
        return;
      }
      
      // Display the generated image
      this.displayImage(result.data);
      this.updateStatus('Image generated successfully', 'success');
    },
    
    handleImageGenerationError(error) {
      this.disableForm(false);
      this.clearJobPolling();
      this.activeJobId = null;
      this.updateStatus(error.error || 'Error generating image', 'error');
    },
    
    handleImageGenerationStarted(data) {
      this.activeJobId = data.jobId;
      this.updateStatus(`Image generation started (Job ID: ${data.jobId})`, 'loading');
      
      // Start polling for updates
      this.startJobPolling();
    },
    
    handleImageGenerationStatus(data) {
      this.updateStatus(`Image generation in progress: ${data.status}`, 'loading');
    },
    
    startJobPolling() {
      // Clear any existing interval
      this.clearJobPolling();
      
      // Poll every 3 seconds
      this.pollInterval = setInterval(() => {
        if (this.activeJobId && window.socket) {
          socket.emit('check-image-job', { jobId: this.activeJobId });
        }
      }, 3000);
    },
    
    clearJobPolling() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    },
    
    // Heartbeat functions to keep the worker alive
    startHeartbeat() {
      // Clear any existing heartbeat
      this.stopHeartbeat();
      
      // Send a heartbeat every 30 seconds
      this.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat();
      }, 30000);
      
      // Send an initial heartbeat
      this.sendHeartbeat();
    },
    
    stopHeartbeat() {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
    },
    
    sendHeartbeat() {
      if (!window.socket) return;
      
      this.lastHeartbeatTime = Date.now();
      socket.emit('image-heartbeat', { timestamp: this.lastHeartbeatTime });
      console.log('Image generator heartbeat sent');
    },
    
    handleHeartbeatResponse(data) {
      const roundtripTime = Date.now() - this.lastHeartbeatTime;
      console.log(`Image generator heartbeat response received (${roundtripTime}ms)`);
      
      // If worker was unhealthy, check status indicator
      if (data && data.workerStatus === 'unhealthy') {
        console.warn('Image generator worker reported as unhealthy');
        // Show a subtle warning in the UI
        const statusIndicator = document.getElementById('worker-status-indicator');
        if (statusIndicator) {
          statusIndicator.className = 'status-indicator unhealthy';
          statusIndicator.title = 'Image generator worker is unhealthy';
        }
      } else {
        // Worker is healthy
        const statusIndicator = document.getElementById('worker-status-indicator');
        if (statusIndicator) {
          statusIndicator.className = 'status-indicator healthy';
          statusIndicator.title = 'Image generator worker is healthy';
        }
      }
    },
    
    displayImage(data) {
      if (!this.resultContainer) return;
      
      // Clear previous results
      this.resultContainer.innerHTML = '';
      
      // Create and append image element
      const img = document.createElement('img');
      img.src = data.output ? data.output[0] : data.image;
      img.alt = 'Generated image';
      img.className = 'generated-image';
      this.resultContainer.appendChild(img);
      
      // Add download button
      const downloadBtn = document.createElement('a');
      downloadBtn.innerHTML = 'Download Image';
      downloadBtn.className = 'download-btn btn btn-primary mt-2';
      downloadBtn.href = img.src;
      downloadBtn.download = `generated-image-${Date.now()}.png`;
      downloadBtn.target = '_blank';
      this.resultContainer.appendChild(downloadBtn);
    },
    
    updateStatus(message, type) {
      if (!this.statusElement) return;
      
      this.statusElement.textContent = message;
      this.statusElement.className = `status ${type || ''}`;
    },
    
    disableForm(disabled) {
      if (this.generateButton) {
        this.generateButton.disabled = disabled;
      }
      
      const inputs = [this.promptInput, this.negativePromptInput, this.widthInput, this.heightInput];
      inputs.forEach(input => {
        if (input) input.disabled = disabled;
      });
      
      if (this.generateButton) {
        this.generateButton.textContent = disabled ? 'Generating...' : 'Generate Image';
      }
    }
  };
  
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    imageGeneratorUI.init();
  });
  
  // Make accessible globally
  window.imageGeneratorUI = imageGeneratorUI;
})();