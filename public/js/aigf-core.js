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
        this.activeTriggers = []; // Will be loaded from official triggers.json

        this.loadOfficialTriggers(); // Load official triggers
        this.init();
    }

    // Load OFFICIAL BambiSleep triggers with enhanced data
    async loadOfficialTriggers() {
        try {
            const response = await fetch('/api/triggers/json');
            const data = await response.json();

            // Extract triggers with category prioritization
            this.activeTriggers = [];
            this.triggerCategories = data.categories || {};
            this.allTriggers = []; // Store all available triggers

            if (data.triggers && Array.isArray(data.triggers)) {
                // Store all triggers for selector
                this.allTriggers = data.triggers.map(trigger => ({
                    name: trigger.name.toUpperCase(),
                    category: trigger.category,
                    safetyLevel: trigger.safetyLevel,
                    description: trigger.description
                }));

                // Select default active triggers - prioritize primary category
                const primaryTriggers = data.triggers.filter(t => t.category === 'primary').slice(0, 2);
                const mentalTriggers = data.triggers.filter(t => t.category === 'mental').slice(0, 1);

                [...primaryTriggers, ...mentalTriggers].forEach(trigger => {
                    this.activeTriggers.push(trigger.name.toUpperCase());
                });

                // Fallback if no categorized triggers
                if (this.activeTriggers.length === 0) {
                    const firstThree = data.triggers.slice(0, 3);
                    firstThree.forEach(trigger => {
                        this.activeTriggers.push(trigger.name.toUpperCase());
                    });
                }
            }

            console.log('🎯 Loaded OFFICIAL active triggers:', this.activeTriggers);
            console.log('📋 Source:', data.source, '| Version:', data.version);
            console.log('🏷️ Available categories:', Object.keys(this.triggerCategories));
            console.log('⚡ Total triggers available:', this.allTriggers.length);

        } catch (error) {
            console.error('CRITICAL: Failed to load official triggers for active list:', error);
            // NO FALLBACK - Only use official triggers
            this.activeTriggers = [];
            this.allTriggers = [];
            this.triggerCategories = {};
        }
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
        this.triggerContainer = document.getElementById('trigger-categories');

        // Initialize trigger buttons after loading triggers
        if (this.triggerContainer) {
            this.populateTriggerButtons();
        }
    }

    createAIButton() {
        const button = document.createElement('button');
        button.id = 'toggle-ai';
        button.className = 'control-button';
        button.textContent = 'CHAT';
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

        // Load official triggers dynamically
        this.populateOfficialTriggers(select);

        container.appendChild(label);
        container.appendChild(select);

        // Add to controls container
        const controls = document.querySelector('.controls') || document.body;
        controls.appendChild(container);

        return container;
    }

    // Populate trigger container with selectable buttons organized by category
    async populateTriggerButtons() {
        try {
            if (!this.allTriggers || this.allTriggers.length === 0) {
                // Data not loaded yet, try to load it
                await this.loadOfficialTriggers();
            }

            if (!this.triggerContainer) {
                console.warn('Trigger container not found');
                return;
            }

            // Clear loading message
            this.triggerContainer.innerHTML = '';

            if (this.allTriggers && this.allTriggers.length > 0) {
                // Group triggers by category
                const triggersByCategory = {};
                this.allTriggers.forEach(trigger => {
                    const category = trigger.category || 'other';
                    if (!triggersByCategory[category]) {
                        triggersByCategory[category] = [];
                    }
                    triggersByCategory[category].push(trigger);
                });

                // Create sections for each category
                Object.keys(triggersByCategory).forEach(category => {
                    const categorySection = document.createElement('div');
                    categorySection.className = 'trigger-category';

                    const categoryHeader = document.createElement('h4');
                    categoryHeader.className = 'category-header';
                    categoryHeader.textContent = `${category.toUpperCase()} - ${this.triggerCategories[category] || 'Triggers'}`;
                    categorySection.appendChild(categoryHeader);

                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'trigger-buttons';

                    triggersByCategory[category].forEach(trigger => {
                        const button = document.createElement('button');
                        button.className = 'trigger-button';
                        button.dataset.triggerName = trigger.name;
                        button.dataset.category = trigger.category;
                        button.dataset.safety = trigger.safetyLevel;
                        button.textContent = trigger.name;
                        button.title = `${trigger.description} (${trigger.safetyLevel})`;

                        // Set initial active state
                        if (this.activeTriggers.includes(trigger.name)) {
                            button.classList.add('active');
                        }

                        // Add click handler
                        button.addEventListener('click', () => {
                            this.toggleTrigger(trigger.name, button);
                        });

                        buttonContainer.appendChild(button);
                    });

                    categorySection.appendChild(buttonContainer);
                    this.triggerContainer.appendChild(categorySection);
                });

                console.log('🎯 Populated trigger buttons with categorized official triggers');
            } else {
                // Show error message
                const errorMsg = document.createElement('div');
                errorMsg.className = 'category-error';
                errorMsg.textContent = 'Failed to load official triggers';
                this.triggerContainer.appendChild(errorMsg);
            }

        } catch (error) {
            console.error('Failed to load official triggers for buttons:', error);
            if (this.triggerContainer) {
                this.triggerContainer.innerHTML = '<div class="category-error">Error loading triggers</div>';
            }
        }
    }

    // Toggle trigger selection
    toggleTrigger(triggerName, buttonElement) {
        const index = this.activeTriggers.indexOf(triggerName);

        if (index > -1) {
            // Remove trigger
            this.activeTriggers.splice(index, 1);
            buttonElement.classList.remove('active');
        } else {
            // Add trigger
            this.activeTriggers.push(triggerName);
            buttonElement.classList.add('active');
        }

        console.log('🎯 Updated active triggers:', this.activeTriggers);
        this.updateTriggers();
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

        // Toggle controls - now handled by dropdown.js
        // this.toggleSpiral.addEventListener('click', () => this.toggleSpiralAnimation());
        // this.toggleTTS.addEventListener('click', () => this.toggleTextToSpeech());
        // this.toggleTriggers.addEventListener('click', () => this.toggleTriggerSystem());

        // Listen for AI mode changes from dropdown
        document.addEventListener('aiModeChange', (event) => {
            this.aiMode = event.detail.mode === 'ai';
            this.aiModeButton.classList.toggle('active', this.aiMode);
            if (this.aiMode) {
                this.updateTriggers();
            }
        });

        // Listen for collar events from dropdown.js
        document.addEventListener('collarActivated', (event) => {
            this.collarActive = event.detail.active;
            this.updateCollarUI();
        });

        // Listen for trigger selection events from dropdown.js
        document.addEventListener('triggerSelection', (event) => {
            const { trigger, active } = event.detail;
            console.log(`Trigger ${trigger} ${active ? 'activated' : 'deactivated'}`);
        });

        // Listen for trigger system toggle events
        document.addEventListener('triggerSystemToggle', (event) => {
            console.log(`Trigger system ${event.detail.enabled ? 'enabled' : 'disabled'}`);
        });

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

        // COLLAR FUNCTIONALITY MOVED TO dropdown.js
        // Click outside handler for dropdowns
        this.setupClickOutsideHandling();

        // Focus on input when page loads
        window.addEventListener('load', () => {
            this.chatInput.focus();
        });
    }

    setupClickOutsideHandling() {
        // SIMPLIFIED - Only handle basic click-outside for all dropdowns
        document.addEventListener('click', (e) => {
            document.querySelectorAll('.dropdown').forEach(dropdown => {
                const isInsideDropdown = dropdown.contains(e.target);
                if (!isInsideDropdown) {
                    dropdown.classList.remove('active');
                }
            });
        });

        // Set up normal dropdown behavior for non-collar dropdowns
        document.querySelectorAll('.dropdown').forEach(dropdown => {
            const button = dropdown.querySelector('.dropdown-btn');
            const isCollarDropdown = button && button.id === 'toggle-collar';

            if (!isCollarDropdown) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    dropdown.classList.toggle('active');
                });
            }
        });
    } sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || !this.isConnected) return;

        // Add message to UI immediately
        this.addMessage(message, new Date(), true, this.username);

        // Send to appropriate handler based on AI mode
        if (this.aiMode) {
            // Send to AI with selected triggers
            this.socket.emit('ai-chat', {
                message: message,
                username: this.username,
                triggers: this.activeTriggers, // Include user-selected triggers
                timestamp: new Date().toISOString()
            });

            this.addSystemMessage(`🤖 Sending to BambiSleep AI with triggers: ${this.activeTriggers.join(', ')}`);
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

        if (isAI) {
            // Create special layout for AI messages
            const headerDiv = document.createElement('div');
            headerDiv.className = 'message-header';

            const userDiv = document.createElement('div');
            userDiv.className = 'message-user';
            userDiv.textContent = username;

            const timeDiv = document.createElement('div');
            timeDiv.className = 'message-time';
            timeDiv.textContent = this.formatTime(timestamp);

            headerDiv.appendChild(userDiv);
            headerDiv.appendChild(timeDiv);

            const textDiv = document.createElement('div');
            textDiv.className = 'message-text';

            // Process AI response with simple CAPS detection only
            const processedAIResponse = this.processAIResponse(text);
            textDiv.innerHTML = processedAIResponse;

            messageDiv.appendChild(headerDiv);
            messageDiv.appendChild(textDiv);
        } else {
            // Regular layout for user messages
            const timeDiv = document.createElement('div');
            timeDiv.className = 'message-time';
            timeDiv.textContent = this.formatTime(timestamp);

            const userDiv = document.createElement('div');
            userDiv.className = 'message-user';
            userDiv.textContent = username;

            const textDiv = document.createElement('div');
            textDiv.className = 'message-text';

            // Regular user messages - process triggers if enabled
            if (window.triggerSystem && window.triggerSystem.isEnabled) {
                textDiv.innerHTML = window.triggerSystem.processMessage(text);
            } else {
                textDiv.textContent = text;
            }

            messageDiv.appendChild(timeDiv);
            messageDiv.appendChild(userDiv);
            messageDiv.appendChild(textDiv);
        }

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
        this.aiModeButton.textContent = this.aiMode ? 'AIGF' : 'CHAT';
        this.aiModeButton.classList.toggle('active', this.aiMode);

        if (this.aiMode) {
            this.addSystemMessage('🌀 AIGF BRAINWASH MODE 🌀');
            this.updateTriggers();
        } else {
            this.addSystemMessage('� GLOBAL CHAT MODE 🗫');
        }
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

    // COLLAR FUNCTIONALITY MOVED TO dropdown.js
    // Only keep UI update method for external communication
    updateCollarUI() {
        if (this.collarActive) {
            this.collarButton.textContent = `🔗 Collar: ON`;
            this.collarButton.classList.add('active');
            this.collarButton.setAttribute('data-state', 'on');
        } else {
            this.collarButton.textContent = `🔗 Collar: OFF`;
            this.collarButton.classList.remove('active');
            this.collarButton.setAttribute('data-state', 'off');
        }
    }

    // Expose socket for dropdown.js to use
    getSocket() {
        return this.socket;
    }

    // Expose addSystemMessage for dropdown.js to use
    addSystemMessagePublic(message) {
        this.addSystemMessage(message);
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
