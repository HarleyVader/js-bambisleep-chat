/**
 * AI Dropdown Component for BambiSleep Chat
 * Handles AI mode and model selection dropdown         // Update button text following standard format: "AI: STATE"
        if (mode === 'ai') {
            btn.textContent = 'AI: AIGF';
            // Remove inline styles to let CSS handle the cyber electric styling
            btn.style.removeProperty('background');
            btn.style.removeProperty('animation');
            btn.style.minWidth = '80px'; // Fixed width to prevent button movement
        } else {
            btn.textContent = 'AI: OFF';
            // Remove inline styles to let CSS handle the cyber electric styling
            btn.style.removeProperty('background');
            btn.style.removeProperty('animation');
            btn.style.minWidth = '80px'; // Fixed width to prevent button movement
        }y
 */

export class AIDropdown {
    constructor(dropdownManager) {
        this.dropdownManager = dropdownManager;
        this.buttonId = 'toggle-ai';
        this.currentMode = 'chat'; // 'chat' or 'ai'
        this.currentModel = 'balanced'; // 'creative', 'balanced', 'precise'
        this.init();
    }

    init() {
        console.log('🤖 Initializing AI Dropdown...');
        this.setupEventListeners();
        this.setupToggleHandling();
        this.loadSavedState();
    }

    setupEventListeners() {
        // Listen for dropdown actions specific to AI
        document.addEventListener('dropdownAction', (e) => {
            const { action, buttonId } = e.detail;
            if (buttonId === this.buttonId) {
                this.handleAction(action, e.detail);
            }
        });
    }

    setupToggleHandling() {
        // Handle AI button click to toggle dropdown
        const aiButton = document.getElementById(this.buttonId);
        if (aiButton) {
            aiButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = aiButton.closest('.dropdown');

                // Handle dropdown open/close
                if (dropdown.classList.contains('active')) {
                    this.dropdownManager.closeDropdown(dropdown);
                } else {
                    this.dropdownManager.openDropdown(dropdown);
                }
            });
        }
    }

    loadSavedState() {
        // Load saved AI state from localStorage
        const savedState = localStorage.getItem('bambi-ai-state');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                this.setState(state);
                console.log('📋 Loading saved AI state:', state);
            } catch (e) {
                console.warn('⚠️ Failed to load AI state:', e);
            }
        }
    }

    handleAction(action, detail) {
        console.log(`🤖 AI action: ${action}`);

        switch (action) {
            case 'ai-mode-chat':
                this.setMode('chat');
                break;
            case 'ai-mode-brainwash':
                this.setMode('ai');
                break;
            case 'ai-model-creative':
                this.setModel('creative');
                break;
            case 'ai-model-balanced':
                this.setModel('balanced');
                break;
            case 'ai-model-precise':
                this.setModel('precise');
                break;
            default:
                console.warn(`Unknown AI action: ${action}`);
        }
    }

    setMode(mode) {
        const btn = document.getElementById(this.buttonId);
        if (!btn) return;

        this.currentMode = mode;

        btn.setAttribute('data-mode', mode);
        btn.setAttribute('data-state', mode === 'ai' ? 'on' : 'off');

        // Ensure button doesn't have unwanted classes
        btn.classList.remove('active');

        // Update button text following standard format: "AI: STATE"
        if (mode === 'ai') {
            btn.textContent = 'AIGF';
            btn.style.background = '';
            btn.style.animation = '';
            btn.style.minWidth = '80px'; // Fixed width to prevent button movement
        } else {
            btn.textContent = 'CHAT';
            btn.style.background = '';
            btn.style.animation = '';
            btn.style.minWidth = '80px'; // Fixed width to prevent button movement
        }

        // Save state to localStorage
        this.saveState();

        // Add system message to chat
        this.addSystemMessage(mode === 'ai' ? '🌀 AIGF BRAINWASH MODE 🌀' : '🗫 GLOBAL CHAT MODE 🗫');

        // Dispatch custom event
        const event = new CustomEvent('aiModeChange', {
            detail: {
                mode: mode,
                fullMode: mode === 'ai' ? 'AI BRAINWASH' : 'CHAT GLOBALLY'
            }
        });
        document.dispatchEvent(event);

        this.showFeedback('AI MODE: ' + (mode === 'ai' ? 'AI BRAINWASH' : 'GLOBAL CHAT'));
    }

    setModel(model) {
        this.currentModel = model;

        // Save state to localStorage
        this.saveState();

        // Update chatCore model if available
        if (window.chatCore && window.chatCore.setModel) {
            window.chatCore.setModel(model);
        }

        // Dispatch model change event
        const event = new CustomEvent('aiModelChange', {
            detail: {
                model: model,
                description: this.getModelDescription(model)
            }
        });
        document.dispatchEvent(event);

        this.showFeedback('AI MODEL: ' + model.toUpperCase());
    }

    getModelDescription(model) {
        const descriptions = {
            creative: 'High creativity, more experimental responses',
            balanced: 'Balanced creativity and accuracy',
            precise: 'High accuracy, more factual responses'
        };
        return descriptions[model] || 'Unknown model';
    }

    showFeedback(message) {
        // Create floating feedback notification (like collar dropdown)
        const feedback = document.createElement('div');
        feedback.className = 'ai-feedback';
        feedback.textContent = message;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--button-color);
            color: var(--primary-color);
            padding: 8px 16px;
            border-radius: 20px;
            font-family: "Audiowide", sans-serif;
            font-size: 0.7rem;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 0 20px var(--button-color);
            animation: slideInRight 0.3s ease-out, slideOutRight 0.3s ease-in 2.7s;
            pointer-events: none;
        `;

        document.body.appendChild(feedback);

        setTimeout(() => {
            if (feedback && feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 3000);
    }

    saveState() {
        // Save current state to localStorage
        const state = this.getState();
        localStorage.setItem('bambi-ai-state', JSON.stringify(state));
        console.log('💾 AI state saved to localStorage');
    }

    toggleState(btn) {
        // Toggle between chat and AI mode when button is clicked
        const currentMode = btn.getAttribute('data-mode') || 'chat';
        const newMode = currentMode === 'ai' ? 'chat' : 'ai';
        this.setMode(newMode);
    }

    addSystemMessage(message) {
        // Use chatCore's system message if available, otherwise create own
        if (window.chatCore && window.chatCore.addSystemMessagePublic) {
            window.chatCore.addSystemMessagePublic(message);
        } else {
            // Fallback: add message to chat directly
            const chatMessages = document.getElementById('chat-messages');
            if (chatMessages) {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'system-message';
                messageDiv.style.cssText = `
                    text-align: center;
                    color: var(--button-color);
                    font-weight: bold;
                    margin: 10px 0;
                    padding: 10px;
                    background: rgba(255, 20, 147, 0.1);
                    border-radius: var(--border-radius);
                    font-family: "Audiowide", sans-serif;
                `;
                messageDiv.textContent = message;
                chatMessages.appendChild(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
    }

    // Get current state for persistence
    getState() {
        return {
            mode: this.currentMode,
            model: this.currentModel
        };
    }

    // Restore state from persistence
    setState(state) {
        if (state.mode) {
            this.setMode(state.mode);
        }
        if (state.model) {
            this.setModel(state.model);
        }
    }

    // Get HTML content for the dropdown
    getDropdownContent() {
        return `
            <div class="ai-config">
                <p class="config-label">🤖 AI Mode Selection:</p>
                <a href="#" data-action="ai-mode-chat" class="${this.currentMode === 'chat' ? 'active' : ''}">💬 Chat Mode</a>
                <a href="#" data-action="ai-mode-brainwash" class="${this.currentMode === 'ai' ? 'active' : ''}">🧠 Brainwash Mode</a>

                <div class="control-section">
                    <p class="config-label">🎭 Model Selection:</p>
                    <a href="#" data-action="ai-model-creative" class="${this.currentModel === 'creative' ? 'active' : ''}">🎨 Creative Model</a>
                    <a href="#" data-action="ai-model-balanced" class="${this.currentModel === 'balanced' ? 'active' : ''}">⚖️ Balanced Model</a>
                    <a href="#" data-action="ai-model-precise" class="${this.currentModel === 'precise' ? 'active' : ''}">🎯 Precise Model</a>
                </div>

                <div class="control-section">
                    <p class="config-label">ℹ️ Model Info:</p>
                    <div class="model-description">
                        ${this.getModelDescription(this.currentModel)}
                    </div>
                </div>
            </div>
        `;
    }
}
