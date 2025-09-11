// aigf-core.js - Main chat logic, socket, and UI management
class ChatCore {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.messageHistory = [];
        this.maxMessages = 100;

        this.init();
    }

    init() {
        this.initSocket();
        this.initUI();
        this.bindEvents();
        this.addSystemMessage('Welcome to BambiSleep Chat');
    }

    initSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            this.isConnected = true;
            this.addSystemMessage('Connected to server');
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.addSystemMessage('Disconnected from server');
            console.log('Disconnected from server');
        });

        this.socket.on('message', (data) => {
            this.addMessage(data.message, data.timestamp, false);
        });

        this.socket.on('chat-history', (messages) => {
            messages.forEach(msg => {
                this.addMessage(msg.message, msg.timestamp, msg.user === this.socket.id);
            });
        });

        this.socket.on('user-count', (count) => {
            this.addSystemMessage(`Users online: ${count}`);
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

        // Focus on input when page loads
        window.addEventListener('load', () => {
            this.chatInput.focus();
        });
    }

    sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || !this.isConnected) return;

        // Add message to UI immediately
        this.addMessage(message, new Date(), true);

        // Send to server
        this.socket.emit('message', {
            message: message,
            timestamp: new Date().toISOString()
        });

        // Clear input
        this.chatInput.value = '';
        this.chatInput.focus();
    }

    addMessage(text, timestamp, isOwn = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own' : ''}`;

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.formatTime(timestamp);

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';

        // Process triggers if enabled
        if (window.triggerSystem && window.triggerSystem.isEnabled) {
            textDiv.innerHTML = window.triggerSystem.processMessage(text);
        } else {
            textDiv.textContent = text;
        }

        messageDiv.appendChild(timeDiv);
        messageDiv.appendChild(textDiv);

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        // Store in history
        this.messageHistory.push({ text, timestamp, isOwn });
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
