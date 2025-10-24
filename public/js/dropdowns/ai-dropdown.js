
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
        this.isEnabled = false; // AIGF on/off state
        this.currentModel = 'balanced'; // 'creative', 'balanced', 'precise'
        this.init();
    }

    init() {
        console.log('🤖 Initializing AI Dropdown...');
        this.setupEventListeners();
        this.setupToggleHandling();
        this.ensureButtonStyling();
        this.loadSavedState();
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
                statusIndicator.style.color = '#00ff00';
                statusIndicator.textContent = '●';
            } else {
                statusIndicator.style.color = '#666';
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
        // Handle AI button click to toggle AIGF state and dropdown
        const aiButton = document.getElementById(this.buttonId);
        if (aiButton) {
            aiButton.addEventListener('click', (e) => {
                e.stopPropagation();

                // Toggle AIGF on/off
                this.toggleAIGF();

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
        const savedState = StorageUtils.getItem('bambi-ai-state');
        if (savedState) {
            try {
                // savedState is already parsed by StorageUtils
                this.setState(savedState);
                console.log('📋 Loading saved AI state:', savedState);
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
                statusIndicator.style.color = '#00ff00';
                statusIndicator.textContent = '●';
            } else {
                statusIndicator.style.color = '#666';
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
        StorageUtils.setItem('bambi-ai-state', state);
        console.log('💾 AI state saved to localStorage');
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
