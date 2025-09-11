/**
 * Dropdown Menu Handler for BambiSleep Chat
 * Handles dropdown menu interactions for control buttons
 */

class DropdownManager {
    constructor() {
        this.activeDropdown = null;
        this.buttonStates = {
            'toggle-spiral': 'off',
            'toggle-tts': 'off',
            'toggle-triggers': 'off',
            'toggle-ai': 'ai',
            'toggle-collar': 'off'
        };
        this.init();
    }

    init() {
        // Add event listeners
        document.addEventListener('click', this.handleClick.bind(this));
        document.addEventListener('keydown', this.handleKeydown.bind(this));

        // Initialize dropdowns and toggle buttons
        this.initializeDropdowns();
        this.initializeToggleButtons();
        this.initializeCollarFunctionality();
    }

    initializeDropdowns() {
        const dropdowns = document.querySelectorAll('.dropdown');
        dropdowns.forEach(dropdown => {
            const btn = dropdown.querySelector('.dropdown-btn');
            const content = dropdown.querySelector('.dropdown-content');

            // Hover functionality
            dropdown.addEventListener('mouseenter', () => {
                if (!content.classList.contains('dropdown-hidden')) {
                    this.openDropdown(dropdown);
                }
            });

            dropdown.addEventListener('mouseleave', () => {
                if (!content.classList.contains('dropdown-hidden')) {
                    this.closeDropdown(dropdown);
                }
            });
        });

        // Add event listeners for dropdown menu items
        const dropdownLinks = document.querySelectorAll('.dropdown-content a');
        dropdownLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleDropdownAction(link);
            });
        });

        // Load trigger categories directly
        this.loadTriggerCategories();
    }

    async loadTriggerCategories() {
        try {
            const response = await fetch('/api/triggers/json');
            const data = await response.json();

            const dropdownTriggers = document.getElementById('trigger-categories-dropdown');
            if (dropdownTriggers && data.triggers && Array.isArray(data.triggers)) {
                this.populateTriggerUI(dropdownTriggers, data);
            }
        } catch (error) {
            console.error('Failed to load trigger categories:', error);
        }
    }

    populateTriggerUI(container, data) {
        container.innerHTML = '';

        // Group triggers by category
        const categories = {};
        data.triggers.forEach(trigger => {
            const category = trigger.category || 'default';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(trigger);
        });

        // Create category sections
        Object.keys(categories).forEach(categoryName => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'trigger-category';

            const header = document.createElement('div');
            header.className = 'category-header';
            header.textContent = categoryName.toUpperCase();
            categoryDiv.appendChild(header);

            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'trigger-buttons';

            categories[categoryName].forEach(trigger => {
                const button = document.createElement('button');
                button.className = 'trigger-button';
                button.textContent = trigger.name;
                button.setAttribute('data-category', trigger.category || 'default');
                button.setAttribute('data-safety', trigger.safetyLevel || 'safe');

                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    button.classList.toggle('active');

                    // Dispatch trigger selection event
                    const event = new CustomEvent('triggerSelection', {
                        detail: {
                            trigger: button.textContent,
                            active: button.classList.contains('active'),
                            category: button.getAttribute('data-category'),
                            safety: button.getAttribute('data-safety')
                        }
                    });
                    document.dispatchEvent(event);
                });

                buttonsDiv.appendChild(button);
            });

            categoryDiv.appendChild(buttonsDiv);
            container.appendChild(categoryDiv);
        });
    }

    initializeToggleButtons() {
        const toggleButtons = document.querySelectorAll('.toggle-button');
        toggleButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleToggleClick(btn);
            });
        });
    }

    initializeCollarFunctionality() {
        const collarBtns = document.querySelectorAll('.collar-btn');
        collarBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleCollarAction(btn);
            });
        });
    }

    handleToggleClick(btn) {
        const buttonId = btn.id;

        if (buttonId === 'toggle-ai') {
            this.toggleAIMode(btn);
        } else {
            this.toggleButtonState(btn);
        }
    }

    toggleButtonState(btn) {
        const buttonId = btn.id;
        const currentState = this.buttonStates[buttonId];
        const newState = currentState === 'off' ? 'on' : 'off';

        this.buttonStates[buttonId] = newState;
        btn.setAttribute('data-state', newState);

        // Update button text
        const baseName = buttonId.replace('toggle-', '').toUpperCase();
        btn.textContent = `${baseName}: ${newState.toUpperCase()}`;

        // Special handling for collar emoji
        if (buttonId === 'toggle-collar') {
            btn.textContent = `🔗 Collar: ${newState.toUpperCase()}`;
        }

        // Dispatch custom event
        const event = new CustomEvent('toggleStateChange', {
            detail: {
                buttonId: buttonId,
                state: newState,
                buttonName: baseName
            }
        });
        document.dispatchEvent(event);

        this.showToggleFeedback(baseName, newState);
    }

    toggleAIMode(btn) {
        const currentMode = btn.getAttribute('data-mode');
        const newMode = currentMode === 'ai' ? 'chat' : 'ai';

        btn.setAttribute('data-mode', newMode);
        btn.setAttribute('data-state', newMode === 'ai' ? 'AIGF' : 'CHAT');

        // Update button text
        if (newMode === 'ai') {
            btn.textContent = 'AIGF';
        } else {
            btn.textContent = 'CHAT';
        }

        // Add system message to chat
        this.addSystemMessage(newMode === 'ai' ? '🌀 AIGF BRAINWASH MODE 🌀' : '🗫 GLOBAL CHAT MODE 🗫');

        // Dispatch custom event
        const event = new CustomEvent('aiModeChange', {
            detail: {
                mode: newMode,
                fullMode: newMode === 'ai' ? 'AI BRAINWASH' : 'CHAT GLOBALLY'
            }
        });
        document.dispatchEvent(event);

        this.showToggleFeedback('AI MODE', newMode === 'ai' ? 'AI BRAINWASH' : 'GLOBAL CHAT');
    }

    addSystemMessage(message) {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message system';

            const timeSpan = document.createElement('span');
            timeSpan.className = 'message-time';
            timeSpan.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const emojiSpan = document.createElement('span');
            emojiSpan.className = 'message-emoji';
            emojiSpan.textContent = '⚡';

            const textSpan = document.createElement('span');
            textSpan.className = 'message-text';
            textSpan.textContent = message;

            messageDiv.appendChild(timeSpan);
            messageDiv.appendChild(emojiSpan);
            messageDiv.appendChild(textSpan);

            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    handleCollarAction(btn) {
        const action = btn.getAttribute('data-action');
        const textarea = document.getElementById('collar-text');

        switch (action) {
            case 'collar-copy':
                if (textarea.value) {
                    navigator.clipboard.writeText(textarea.value).then(() => {
                        this.showActionFeedback('COLLAR', 'Settings copied to clipboard');
                    }).catch(() => {
                        this.showActionFeedback('COLLAR', 'Copy failed');
                    });
                } else {
                    this.showActionFeedback('COLLAR', 'No settings to copy');
                }
                break;

            case 'collar-paste':
                navigator.clipboard.readText().then(text => {
                    textarea.value = text;
                    this.showActionFeedback('COLLAR', 'Settings pasted from clipboard');
                }).catch(() => {
                    this.showActionFeedback('COLLAR', 'Paste failed');
                });
                break;

            case 'collar-save':
                if (textarea.value) {
                    // Save to localStorage
                    localStorage.setItem('bambi-collar-settings', textarea.value);
                    this.showActionFeedback('COLLAR', 'Settings saved');
                } else {
                    this.showActionFeedback('COLLAR', 'No settings to save');
                }
                break;
        }
    }

    openDropdown(dropdown) {
        // Close any other open dropdown
        if (this.activeDropdown && this.activeDropdown !== dropdown) {
            this.closeDropdown(this.activeDropdown);
        }

        dropdown.classList.add('active');
        this.activeDropdown = dropdown;
    }

    closeDropdown(dropdown) {
        dropdown.classList.remove('active');
        if (this.activeDropdown === dropdown) {
            this.activeDropdown = null;
        }
    }

    closeAllDropdowns() {
        const activeDropdowns = document.querySelectorAll('.dropdown.active');
        activeDropdowns.forEach(dropdown => {
            this.closeDropdown(dropdown);
        });
    }

    handleClick(e) {
        // Close dropdowns when clicking outside
        if (!e.target.closest('.dropdown')) {
            this.closeAllDropdowns();
        }
    }

    handleKeydown(e) {
        // Close dropdowns on escape key
        if (e.key === 'Escape') {
            this.closeAllDropdowns();
        }
    }

    handleDropdownAction(link) {
        const action = link.getAttribute('data-action');
        const dropdown = link.closest('.dropdown');
        const buttonId = dropdown.querySelector('.dropdown-btn').id;

        console.log(`Dropdown action: ${action} for button: ${buttonId}`);

        // Close the dropdown
        this.closeDropdown(dropdown);

        // Handle specific actions
        this.executeAction(action, buttonId, link.textContent);
    }

    executeAction(action, buttonId, selectedText) {
        // Create a custom event for the action
        const event = new CustomEvent('dropdownAction', {
            detail: {
                action: action,
                buttonId: buttonId,
                selectedText: selectedText
            }
        });

        document.dispatchEvent(event);

        // Handle AI mode switching
        if (action === 'ai-mode-brainwash' || action === 'ai-mode-chat') {
            const btn = document.getElementById('toggle-ai');
            const newMode = action === 'ai-mode-brainwash' ? 'ai' : 'chat';
            btn.setAttribute('data-mode', newMode);
            btn.textContent = newMode === 'ai' ? 'AI' : 'CHAT';

            const modeChangeEvent = new CustomEvent('aiModeChange', {
                detail: {
                    mode: newMode,
                    fullMode: selectedText
                }
            });
            document.dispatchEvent(modeChangeEvent);
        }

        // Add visual feedback
        this.showActionFeedback(buttonId.replace('toggle-', '').toUpperCase(), selectedText);
    }

    showToggleFeedback(buttonName, state) {
        this.showActionFeedback(buttonName, `${state.toUpperCase()}`);
    }

    showActionFeedback(buttonName, message) {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.className = 'dropdown-notification';
        notification.textContent = `${buttonName}: ${message}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--button-color);
            color: white;
            padding: 10px 15px;
            border-radius: var(--border-radius);
            font-family: "Audiowide", sans-serif;
            font-size: 0.7rem;
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;

        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Add notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize dropdown manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dropdownManager = new DropdownManager();

    // Load saved collar settings
    const savedCollarSettings = localStorage.getItem('bambi-collar-settings');
    if (savedCollarSettings) {
        const collarTextarea = document.getElementById('collar-text');
        if (collarTextarea) {
            collarTextarea.value = savedCollarSettings;
        }
    }
});

// Listen for dropdown actions to integrate with existing functionality
document.addEventListener('dropdownAction', (e) => {
    const { action, buttonId, selectedText } = e.detail;

    // Integration examples - you can extend these based on your existing code
    switch (action) {
        case 'spiral-speed-slow':
        case 'spiral-speed-normal':
        case 'spiral-speed-fast':
            console.log(`Setting spiral speed to: ${selectedText}`);
            break;

        case 'spiral-color-cycle':
            console.log('Enabling spiral color cycle');
            break;

        case 'spiral-reverse':
            console.log('Reversing spiral direction');
            break;

        case 'tts-voice-1':
        case 'tts-voice-2':
        case 'tts-voice-3':
            console.log(`Setting TTS voice to: ${selectedText}`);
            break;

        case 'tts-speed-slow':
        case 'tts-speed-normal':
        case 'tts-speed-fast':
            console.log(`Setting TTS speed to: ${selectedText}`);
            break;

        case 'triggers-safe-only':
        case 'triggers-moderate':
        case 'triggers-all':
        case 'triggers-custom':
            console.log(`Setting trigger mode to: ${selectedText}`);
            break;

        case 'ai-model-creative':
        case 'ai-model-balanced':
        case 'ai-model-precise':
            console.log(`Setting AI model to: ${selectedText}`);
            break;

        case 'collar-tight':
        case 'collar-loose':
        case 'collar-vibrate':
        case 'collar-shock':
        case 'collar-release':
            console.log(`Setting collar mode to: ${selectedText}`);
            break;

        default:
            console.log(`Unknown action: ${action}`);
    }
});
