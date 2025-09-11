// aigf-core.js - Main chat logic, socket, and UI management
class ChatCore {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.messageHistory = [];
        this.maxMessages = 100;
        this.username = this.generateUsername();
        this.aiMode = false;
        this.collarActive = false;
        this.activeTriggers = ['BAMBI SLEEP', 'GOOD GIRL', 'BLANK'];

        this.init();
    }

    // Initialize text effects system
    initTextEffects() {
        // Ensure textEffects is available
        if (typeof window.textEffects === 'undefined') {
            console.warn('TextEffects not loaded yet, retrying...');
            setTimeout(() => this.initTextEffects(), 100);
            return;
        }
        console.log('TextEffects system initialized');
    }

    // Process AI response with custom effects system
    processAIResponse(aiResponse) {
        try {
            if (typeof window.textEffects !== 'undefined') {
                // Use custom effects system for enhanced CAPS processing
                return window.textEffects.processMessage(aiResponse, true);
            } else {
                // Fallback: manual processing if effects system is not available
                return this.manualProcessHighlights(aiResponse);
            }
        } catch (error) {
            console.error('Error processing AI response with effects system:', error);
            // Fallback: manual processing if effects system fails
            return this.manualProcessHighlights(aiResponse);
        }
    }

    // Manual processing for **text** highlighting with CAPS detection
    manualProcessHighlights(text) {
        return text.replace(/\*\*([^*]+)\*\*/g, (match, content) => {
            // Check if the content is in ALL CAPS
            const isAllCaps = /^[A-Z\s\-!'.,;:?]*$/.test(content) && /[A-Z]/.test(content);

            if (isAllCaps) {
                return `<span class="ai-generated-highlight caps-trigger">${content}</span>`;
            } else {
                return `<span class="ai-generated-highlight">${content}</span>`;
            }
        });
    }

    init() {
        this.initSocket();
        this.initUI();
        this.initTextEffects();
        this.bindEvents();
        this.addSystemMessage('Welcome to BambiSleep Chat');
        this.addSystemMessage(`Your username: ${this.username}`);
    }

    generateUsername() {
        const adjectives = ['Sweet', 'Pretty', 'Cute', 'Good', 'Pink', 'Dreamy', 'Sleepy'];
        const nouns = ['Bambi', 'Doll', 'Girl', 'Bimbo', 'Angel', 'Princess'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        return `${adj}${noun}${Math.floor(Math.random() * 100)}`;
    }

    initSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            this.isConnected = true;
            this.addSystemMessage('Connected to server');

            // Send initial triggers to worker
            this.updateTriggers();

            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.addSystemMessage('Disconnected from server');
            console.log('Disconnected from server');
        });

        this.socket.on('message', (data) => {
            this.addMessage(data.message, data.timestamp, false, data.user);
        });

        this.socket.on('chat-history', (messages) => {
            messages.forEach(msg => {
                this.addMessage(msg.message, msg.timestamp, msg.user === this.socket.id, msg.user);
            });
        });

        this.socket.on('user-count', (count) => {
            this.addSystemMessage(`Users online: ${count}`);
        });

        // AI-specific events
        this.socket.on('ai-response', (data) => {
            this.addMessage(data.message, data.timestamp, false, 'BambiSleep', true);
            this.addSystemMessage(`AI generated ${data.wordCount} words`);
        });

        this.socket.on('ai-error', (data) => {
            this.addSystemMessage(`AI Error: ${data.error}`);
        });

        this.socket.on('collar-activated', (data) => {
            this.collarActive = data.active;
            if (data.active) {
                this.addSystemMessage('🔗 Collar activated - deeper submission engaged');
            } else {
                this.addSystemMessage('🔗 Collar deactivated');
            }
            this.updateCollarUI();
        });

        this.socket.on('detected-triggers', (data) => {
            if (data.triggers && data.triggers.length > 0) {
                this.addSystemMessage(`⚡ Triggers detected: ${data.triggers.map(t => t.name).join(', ')}`);
            }
        });

        // Model loading events
        this.socket.on('model-status', (data) => {
            if (data.loading) {
                this.addSystemMessage(`🔄 ${data.message}`);
            } else if (data.loaded) {
                this.addSystemMessage(`✅ Model loaded: ${data.modelId} (${data.modelSize})`);
            } else if (data.error) {
                this.addSystemMessage(`❌ Model error: ${data.message}`);
            }
        });

        this.socket.on('error', (error) => {
            this.addSystemMessage(`Error: ${error}`);
            console.error('Socket error:', error);
        });
    }

    initUI() {
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-button');
        this.toggleSpiral = document.getElementById('toggle-spiral');
        this.toggleTTS = document.getElementById('toggle-tts');
        this.toggleTriggers = document.getElementById('toggle-triggers');

        // AI-specific controls
        this.aiModeButton = document.getElementById('toggle-ai') || this.createAIButton();
        this.collarButton = document.getElementById('toggle-collar') || this.createCollarButton();
        this.triggerSelector = document.getElementById('trigger-selector') || this.createTriggerSelector();
    }

    createAIButton() {
        const button = document.createElement('button');
        button.id = 'toggle-ai';
        button.className = 'control-button';
        button.textContent = 'AI: OFF';
        button.title = 'Toggle AI chat mode';

        // Add to controls container
        const controls = document.querySelector('.controls') || document.body;
        controls.appendChild(button);

        return button;
    }

    createCollarButton() {
        const button = document.createElement('button');
        button.id = 'toggle-collar';
        button.className = 'control-button';
        button.textContent = '🔗 Collar: OFF';
        button.title = 'Toggle collar mode for deeper submission';

        // Add to controls container
        const controls = document.querySelector('.controls') || document.body;
        controls.appendChild(button);

        return button;
    }

    createTriggerSelector() {
        const container = document.createElement('div');
        container.id = 'trigger-selector';
        container.className = 'trigger-controls';

        const label = document.createElement('label');
        label.textContent = 'Active Triggers: ';

        const select = document.createElement('select');
        select.multiple = true;
        select.size = 3;

        const triggers = ['BAMBI SLEEP', 'GOOD GIRL', 'BLANK', 'MINDLESS', 'OBEY', 'SUBMIT', 'BIMBO', 'DOLL', 'PINK', 'SPIRAL'];
        triggers.forEach(trigger => {
            const option = document.createElement('option');
            option.value = trigger;
            option.textContent = trigger;
            option.selected = this.activeTriggers.includes(trigger);
            select.appendChild(option);
        });

        container.appendChild(label);
        container.appendChild(select);

        // Add to controls container
        const controls = document.querySelector('.controls') || document.body;
        controls.appendChild(container);

        return container;
    }

    bindEvents() {
        // Send message on button click
        this.sendButton.addEventListener('click', () => this.sendMessage());

        // Send message on Enter key
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Toggle controls
        this.toggleSpiral.addEventListener('click', () => this.toggleSpiralAnimation());
        this.toggleTTS.addEventListener('click', () => this.toggleTextToSpeech());
        this.toggleTriggers.addEventListener('click', () => this.toggleTriggerSystem());

        // AI controls
        this.aiModeButton.addEventListener('click', () => this.toggleAIMode());
        this.collarButton.addEventListener('click', () => this.toggleCollar());

        // Model loading control
        const loadModelButton = document.getElementById('load-model');
        if (loadModelButton) {
            loadModelButton.addEventListener('click', () => this.loadModel());
        }

        // Trigger selector
        const select = this.triggerSelector.querySelector('select');
        if (select) {
            select.addEventListener('change', () => this.updateSelectedTriggers());
        }

        // Focus on input when page loads
        window.addEventListener('load', () => {
            this.chatInput.focus();
        });
    }

    sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || !this.isConnected) return;

        // Add message to UI immediately
        this.addMessage(message, new Date(), true, this.username);

        // Send to appropriate handler based on AI mode
        if (this.aiMode) {
            // Send to AI
            this.socket.emit('ai-chat', {
                message: message,
                username: this.username,
                timestamp: new Date().toISOString()
            });

            this.addSystemMessage('🤖 Sending to BambiSleep AI...');
        } else {
            // Send to regular chat
            this.socket.emit('message', {
                message: message,
                username: this.username,
                timestamp: new Date().toISOString()
            });
        }

        // Clear input
        this.chatInput.value = '';
        this.chatInput.focus();
    }

    addMessage(text, timestamp, isOwn = false, username = 'Unknown', isAI = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own' : ''} ${isAI ? 'ai' : ''}`;

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.formatTime(timestamp);

        const userDiv = document.createElement('div');
        userDiv.className = 'message-user';
        userDiv.textContent = username;

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';

        // Handle AI messages with structured output differently
        if (isAI) {
            // Process AI response with simple CAPS detection only
            const processedAIResponse = this.processAIResponse(text);
            textDiv.innerHTML = processedAIResponse;
        } else {
            // Regular user messages - process triggers if enabled
            if (window.triggerSystem && window.triggerSystem.isEnabled) {
                textDiv.innerHTML = window.triggerSystem.processMessage(text);
            } else {
                textDiv.textContent = text;
            }
        }

        messageDiv.appendChild(timeDiv);
        messageDiv.appendChild(userDiv);
        messageDiv.appendChild(textDiv);

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        // Store in history
        this.messageHistory.push({ text, timestamp, isOwn, username, isAI });
        if (this.messageHistory.length > this.maxMessages) {
            this.messageHistory.shift();
        }

        // Process TTS if enabled and not own message
        if (!isOwn && window.ttsSystem && window.ttsSystem.isEnabled) {
            window.ttsSystem.speak(text);
        }
    }

    addSystemMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.formatTime(new Date());

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = text;

        messageDiv.appendChild(timeDiv);
        messageDiv.appendChild(textDiv);

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    // AI-specific methods
    toggleAIMode() {
        this.aiMode = !this.aiMode;
        this.aiModeButton.textContent = `AI: ${this.aiMode ? 'ON' : 'OFF'}`;
        this.aiModeButton.classList.toggle('active', this.aiMode);

        if (this.aiMode) {
            this.addSystemMessage('🤖 AI mode activated - messages will be sent to BambiSleep');
            this.updateTriggers();
        } else {
            this.addSystemMessage('💬 Regular chat mode activated');
        }
    }

    toggleCollar() {
        this.collarActive = !this.collarActive;

        if (this.collarActive) {
            this.socket.emit('activate-collar', {
                text: 'You feel the collar tighten around your neck, a constant reminder of your submission and desire to obey. Every trigger becomes more powerful, every word more commanding.'
            });
        } else {
            this.socket.emit('deactivate-collar');
        }
    }

    updateCollarUI() {
        this.collarButton.textContent = `🔗 Collar: ${this.collarActive ? 'ON' : 'OFF'}`;
        this.collarButton.classList.toggle('active', this.collarActive);
    }

    updateSelectedTriggers() {
        const select = this.triggerSelector.querySelector('select');
        if (select) {
            this.activeTriggers = Array.from(select.selectedOptions).map(option => option.value);
            this.updateTriggers();
            this.addSystemMessage(`Active triggers updated: ${this.activeTriggers.join(', ')}`);
        }
    }

    updateTriggers() {
        if (this.socket && this.isConnected) {
            this.socket.emit('update-triggers', {
                triggers: this.activeTriggers
            });
        }
    }

    loadModel() {
        if (this.socket && this.isConnected) {
            this.socket.emit('load-model');
            this.addSystemMessage('🔍 Requesting auto-load of best l3-sthenomaidblackroot-8b-v1 model...');
        } else {
            this.addSystemMessage('❌ Not connected to server');
        }
    }

    toggleSpiralAnimation() {
        if (window.spiralAnimation) {
            const isEnabled = window.spiralAnimation.toggle();
            this.toggleSpiral.textContent = `Spiral: ${isEnabled ? 'ON' : 'OFF'}`;
            this.toggleSpiral.classList.toggle('active', isEnabled);
        }
    }

    toggleTextToSpeech() {
        if (window.ttsSystem) {
            const isEnabled = window.ttsSystem.toggle();
            this.toggleTTS.textContent = `TTS: ${isEnabled ? 'ON' : 'OFF'}`;
            this.toggleTTS.classList.toggle('active', isEnabled);
        }
    }

    toggleTriggerSystem() {
        if (window.triggerSystem) {
            const isEnabled = window.triggerSystem.toggle();
            this.toggleTriggers.textContent = `Triggers: ${isEnabled ? 'ON' : 'OFF'}`;
            this.toggleTriggers.classList.toggle('active', isEnabled);
        }
    }

    // Public API
    getHistory() {
        return this.messageHistory;
    }

    clearHistory() {
        this.messageHistory = [];
        this.chatMessages.innerHTML = '';
    }

    setConnectionStatus(status) {
        this.isConnected = status;
    }
}

// Initialize chat core when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatCore = new ChatCore();
});
