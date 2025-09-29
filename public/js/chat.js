/**
 * BambiSleep Chat - Global Chat Interface Module
 * Handles global community chat functionality independent from AIGF
 */

class GlobalChatManager {
    constructor(socket, chatCore) {
        this.socket = socket;
        this.chatCore = chatCore;
        this.globalChatContainer = document.getElementById('global-chat-messages');
        this.isConnected = false;
        this.messageHistory = [];
        this.maxMessages = 100;

        this.init();
    }

    init() {
        console.log('💬 Initializing Global Chat Manager...');
        this.setupEventListeners();
        this.setupSocketHandlers();
    }

    setupEventListeners() {
        // Listen for global chat events from main chat core
        document.addEventListener('globalChatMessage', (event) => {
            this.handleGlobalMessage(event.detail);
        });

        // Listen for connection status changes
        document.addEventListener('socketConnected', () => {
            this.isConnected = true;
            console.log('💬 Global chat connected to server');
        });

        document.addEventListener('socketDisconnected', () => {
            this.isConnected = false;
            console.log('💬 Global chat disconnected from server');
        });
    }

    setupSocketHandlers() {
        if (!this.socket) {
            console.warn('💬 No socket provided to Global Chat Manager');
            return;
        }

        // Handle global chat history
        this.socket.on('global-chat-history', (messages) => {
            console.log('💬 Received global chat history:', messages.length, 'messages');
            this.clearGlobalChatHistory();

            messages.forEach(msg => {
                this.addGlobalMessage(msg.message, msg.timestamp, false, msg.username || msg.user);
            });
        });

        // Handle incoming global messages
        this.socket.on('global-message', (data) => {
            console.log('💬 New global message:', data);
            this.addGlobalMessage(data.message, data.timestamp, false, data.username || data.user);
        });

        // Handle global user count
        this.socket.on('global-user-count', (count) => {
            this.updateGlobalUserCount(count);
        });
    }

    // Send a global chat message
    sendGlobalMessage(message, username) {
        if (!this.isConnected || !this.socket) {
            console.warn('💬 Cannot send global message - not connected');
            return false;
        }

        if (!message || typeof message !== 'string' || message.trim() === '') {
            console.warn('💬 Cannot send empty global message');
            return false;
        }

        const messageData = {
            message: message.trim(),
            username: username,
            timestamp: new Date().toISOString(),
            type: 'global'
        };

        console.log('💬 Sending global message:', messageData);

        // Emit to server with global-message event
        this.socket.emit('global-message', messageData);

        // Add to local UI immediately (optimistic update)
        this.addGlobalMessage(message, messageData.timestamp, true, username);

        return true;
    }

    // Add a message to the global chat container
    addGlobalMessage(text, timestamp, isOwn = false, username = 'Unknown') {
        if (!this.globalChatContainer) {
            console.warn('💬 Global chat container not found');
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own' : ''} global-chat`;

        // Create message structure
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.formatTime(timestamp);

        const userDiv = document.createElement('div');
        userDiv.className = 'message-user';
        userDiv.textContent = username;

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = text;

        // Append elements
        messageDiv.appendChild(timeDiv);
        messageDiv.appendChild(userDiv);
        messageDiv.appendChild(textDiv);

        // Add to container
        this.globalChatContainer.appendChild(messageDiv);
        this.scrollToBottom();

        // Store in local history
        this.messageHistory.push({
            text,
            timestamp,
            isOwn,
            username,
            type: 'global'
        });

        // Limit history size
        if (this.messageHistory.length > this.maxMessages) {
            this.messageHistory.shift();

            // Remove oldest message from DOM
            const firstMessage = this.globalChatContainer.querySelector('.message');
            if (firstMessage) {
                firstMessage.remove();
            }
        }
    }

    // Add a system message to global chat
    addGlobalSystemMessage(text) {
        if (!this.globalChatContainer) {
            console.warn('💬 Global chat container not found');
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system global-system';

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.formatTime(new Date());

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = text;

        messageDiv.appendChild(timeDiv);
        messageDiv.appendChild(textDiv);

        this.globalChatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    // Clear global chat history
    clearGlobalChatHistory() {
        if (this.globalChatContainer) {
            this.globalChatContainer.innerHTML = '';
        }
        this.messageHistory = [];
    }

    // Update global user count display
    updateGlobalUserCount(count) {
        // Update any global user count displays
        const userCountElements = document.querySelectorAll('.global-user-count');
        userCountElements.forEach(element => {
            element.textContent = count;
        });

        this.addGlobalSystemMessage(`Global users online: ${count}`);
    }

    // Format timestamp for display
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    // Scroll to bottom of global chat
    scrollToBottom() {
        if (this.globalChatContainer) {
            this.globalChatContainer.scrollTop = this.globalChatContainer.scrollHeight;
        }
    }

    // Handle global message from event
    handleGlobalMessage(messageData) {
        this.addGlobalMessage(
            messageData.message,
            messageData.timestamp,
            messageData.isOwn,
            messageData.username
        );
    }

    // Get global chat history
    getGlobalHistory() {
        return this.messageHistory.filter(msg => msg.type === 'global');
    }

    // Check if global chat is active
    isGlobalChatActive() {
        return this.globalChatContainer &&
            !this.globalChatContainer.classList.contains('hidden');
    }

    // Public API methods
    getMessageCount() {
        return this.messageHistory.length;
    }

    exportGlobalHistory() {
        return {
            messages: this.getGlobalHistory(),
            count: this.getMessageCount(),
            timestamp: new Date().toISOString()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GlobalChatManager;
} else {
    window.GlobalChatManager = GlobalChatManager;
}
