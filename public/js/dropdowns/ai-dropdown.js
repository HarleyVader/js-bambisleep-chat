
/**
 * AI Dropdown Component for BambiSleep Chat
 * Handles AI mode and model selection dropdown functionality
 *
 * Integration with buttons.css red/green on/off system:
 * - Uses .dropdown-btn class for main toggle button cyber-electric styling
 * - Uses .ai-button class for dropdown content buttons with proper styl                <!-- Model Selection -->CHAT mode: data-mode="chat", data-state="off" -> Red pulse (inactive/default state)
 * - AIGF mode: data-mode="ai", data-state="on" -> Special pink AIGF styling overrides green
 * - Dropdown buttons use standard button system with active states and hover effects
 * - Consistent with TTS and Spiral dropdown button patterns
 * - Removes all inline styles to let buttons.css handle button appearance
 *
 * Button States:
 * - Main Toggle: #toggle-ai[data-mode="chat"][data-state="off"] -> Red pulse, standard off styling
 * - Main Toggle: #toggle-ai[data-mode="ai"] -> Pink gradient, aigfPulse animation (overrides on state)
 * - Dropdown Buttons: .ai-button with .active class for selected options
 *
 * CSS Integration:
 * - Main button: Uses red/green on/off styling for CHAT mode, special AIGF pink styling for AI mode
 * - Dropdown buttons: Use .ai-button styling with active/hover states
 * - Consistent with other dropdown components' button behavior
 */

import { StorageUtils } from '../storage-utils.js';

export class AIDropdown {
    constructor(dropdownManager) {
        this.dropdownManager = dropdownManager;
        this.buttonId = 'toggle-ai';
        this.componentName = 'ai'; // For centralized state access
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupToggleHandling();
        this.ensureButtonStyling();
        this.loadSavedState();
    }

    // ENHANCED: Centralized State Access Helper Methods
    get isEnabled() {
        return this.dropdownManager.getComponentState(this.componentName, 'isEnabled') || false;
    }

    set isEnabled(value) {
        this.dropdownManager.setComponentState(this.componentName, 'isEnabled', value);
    }

    get currentModel() {
        return this.dropdownManager.getComponentState(this.componentName, 'currentModel') || 'balanced';
    }

    set currentModel(value) {
        this.dropdownManager.setComponentState(this.componentName, 'currentModel', value);
    }

    ensureButtonStyling() {
        // Ensure the AI button has proper CSS classes from buttons.css
        const btn = document.getElementById(this.buttonId);
        const statusIndicator = document.getElementById('ai-status');

        if (btn) {
            btn.classList.add('dropdown-btn', 'toggle-button');
            // Remove any conflicting classes
            btn.classList.remove('active');

            // Set AIGF state
            btn.setAttribute('data-state', this.isEnabled ? 'on' : 'off');
        }

        // Update status indicator like brainwave
        if (statusIndicator) {
            if (this.isEnabled) {
                statusIndicator.className = 'status-active';
                statusIndicator.textContent = '●';
            } else {
                statusIndicator.className = 'status-inactive';
                statusIndicator.textContent = '●';
            }
        }
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
        // AI button has special dual behavior:
        // 1. Toggle AIGF on/off state
        // 2. Open/close dropdown
        // DropdownManager handles dropdown, this handles AIGF toggle
        const aiButton = document.getElementById(this.buttonId);
        if (aiButton) {
            aiButton.addEventListener('click', (e) => {
                // Don't stop propagation - let DropdownManager handle dropdown
                // Just toggle AIGF state
                this.toggleAIGF();
            });
        }
    }

    loadSavedState() {
        // Load saved AI state from localStorage
        const savedState = StorageUtils.getItem('bambi-ai-state');
        if (savedState) {
            try {
                // savedState is already parsed by StorageUtils
                this.setState(savedState);
            } catch (e) {
                console.warn('⚠️ Failed to load AI state:', e);
            }
        }
        this.updateButtonState();
    }

    handleAction(action, detail) {
        console.log(`🤖 AI action: ${action}`);

        switch (action) {
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

    toggleAIGF() {
        this.isEnabled = !this.isEnabled;
        this.updateButtonState();
        this.saveState();

        // Dispatch custom event
        const event = new CustomEvent('aiModeChange', {
            detail: {
                enabled: this.isEnabled,
                mode: 'aigf'
            }
        });
        document.dispatchEvent(event);

        this.showFeedback('AIGF: ' + (this.isEnabled ? 'ENABLED' : 'DISABLED'));
    }

    updateButtonState() {
        const btn = document.getElementById(this.buttonId);
        const statusIndicator = document.getElementById('ai-status');

        if (!btn) return;

        // Set proper data attributes for buttons.css red/green on/off styling system
        btn.setAttribute('data-state', this.isEnabled ? 'on' : 'off');

        // Update status indicator like brainwave
        if (statusIndicator) {
            if (this.isEnabled) {
                statusIndicator.className = 'status-active';
                statusIndicator.textContent = '●';
            } else {
                statusIndicator.className = 'status-inactive';
                statusIndicator.textContent = '●';
            }
        }

        // Ensure button has proper CSS classes from buttons.css
        btn.classList.add('dropdown-btn', 'toggle-button');
        btn.classList.remove('active');

        // Clear any inline styles to let buttons.css handle all button styling
        btn.style.background = '';
        btn.style.animation = '';
        btn.style.minWidth = '';
        btn.style.boxShadow = '';
        btn.style.textShadow = '';
        btn.style.border = '';
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

    handleAIClick(button, action) {
        // For single-selection categories, remove active from siblings first
        const category = this.getAICategory(action);
        if (this.isSingleSelectionCategory(category)) {
            const siblings = button.parentElement.querySelectorAll('.ai-button');
            siblings.forEach(sibling => {
                sibling.classList.remove('active');
            });
        }

        // Add active state to clicked button
        button.classList.add('active');

        // Execute the AI action
        this.handleAction(action, {
            selectedText: button.textContent,
            element: button
        });
    }

    getAICategory(action) {
        if (action.includes('mode')) return 'mode';
        if (action.includes('model')) return 'model';
        return 'other';
    }

    isSingleSelectionCategory(category) {
        // These categories should only have one active selection at a time
        return ['mode', 'model'].includes(category);
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
        // Create floating feedback notification (unified with CSS classes)
        const feedback = document.createElement('div');
        feedback.className = 'dropdown-notification z-notification';
        feedback.textContent = message;

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
        StorageUtils.setItem('bambi-ai-state', state);
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
                messageDiv.className = 'system-message ai-system-message';
                messageDiv.textContent = message;
                chatMessages.appendChild(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
    }

    // Get current state for persistence
    getState() {
        return {
            enabled: this.isEnabled,
            model: this.currentModel
        };
    }

    // Restore state from persistence
    setState(state) {
        if (state.hasOwnProperty('enabled')) {
            this.isEnabled = state.enabled;
        }
        // Support legacy mode for backward compatibility
        if (state.mode === 'ai') {
            this.isEnabled = true;
        }
        if (state.model) {
            this.setModel(state.model);
        }
    }

    // Get HTML content for the dropdown
    getDropdownContent() {
        return `
            <div class="ai-config">
                <!-- AIGF Status -->
                <div class="control-section">
                    <p class="config-label">� AIGF Status:</p>
                    <div class="aigf-status">
                        ${this.isEnabled ? '✅ BRAINWASH MODE ACTIVE' : '❌ BRAINWASH MODE DISABLED'}
                    </div>
                </div>

                <!-- Model Selection -->
                <div class="control-section">
                    <p class="config-label">🎭 Model Selection:</p>
                    <div class="ai-buttons">
                        <button class="ai-button ${this.currentModel === 'creative' ? 'active' : ''}" data-action="ai-model-creative" onclick="window.dropdownManager.getComponent('ai').handleAIClick(this, 'ai-model-creative')">🎨 Creative Model</button>
                        <button class="ai-button ${this.currentModel === 'balanced' ? 'active' : ''}" data-action="ai-model-balanced" onclick="window.dropdownManager.getComponent('ai').handleAIClick(this, 'ai-model-balanced')">⚖️ Balanced Model</button>
                        <button class="ai-button ${this.currentModel === 'precise' ? 'active' : ''}" data-action="ai-model-precise" onclick="window.dropdownManager.getComponent('ai').handleAIClick(this, 'ai-model-precise')">🎯 Precise Model</button>
                    </div>
                </div>

                <!-- Model Information -->
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
