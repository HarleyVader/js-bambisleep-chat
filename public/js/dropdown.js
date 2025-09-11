/**
 * Dropdown Menu Handler for BambiSleep Chat
 * Handles dropdown menu interactions for control buttons
 */

class DropdownManager {
    constructor() {
        console.log('🔧 DropdownManager constructor called');
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
        console.log('⚙️ DropdownManager init started');
        // Add event listeners
        document.addEventListener('click', this.handleClick.bind(this));
        document.addEventListener('keydown', this.handleKeydown.bind(this));

        // Initialize dropdowns and toggle buttons
        this.initializeDropdowns();
        this.initializeToggleButtons();
        this.initializeCollarFunctionality();
        console.log('✅ DropdownManager init completed');
    }

    initializeDropdowns() {
        const dropdowns = document.querySelectorAll('.dropdown');
        dropdowns.forEach(dropdown => {
            const btn = dropdown.querySelector('.dropdown-btn');
            const content = dropdown.querySelector('.dropdown-content');

            // REMOVED AGGRESSIVE HOVER FUNCTIONALITY
            // Only click-based interaction now for user-friendly experience

            // Set up click handlers for non-collar dropdowns
            if (btn && btn.id !== 'toggle-collar') {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (dropdown.classList.contains('active')) {
                        this.closeDropdown(dropdown);
                    } else {
                        this.openDropdown(dropdown);
                    }
                });
            }
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
            console.log('🔄 Loading trigger categories...');
            const response = await fetch('/api/triggers/json');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📥 Received trigger data:', data);

            const dropdownTriggers = document.getElementById('trigger-categories-dropdown');
            if (dropdownTriggers && data.triggers && Array.isArray(data.triggers)) {
                console.log('🎯 Populating trigger UI with', data.triggers.length, 'triggers');
                this.populateTriggerUI(dropdownTriggers, data);
            } else {
                console.error('❌ Missing elements or data:', {
                    dropdownTriggers: !!dropdownTriggers,
                    hasTriggersData: !!(data.triggers && Array.isArray(data.triggers)),
                    triggersCount: data.triggers ? data.triggers.length : 0
                });

                if (dropdownTriggers) {
                    dropdownTriggers.innerHTML = '<div class="category-error">Failed to load triggers</div>';
                }
            }
        } catch (error) {
            console.error('💥 Failed to load trigger categories:', error);
            const dropdownTriggers = document.getElementById('trigger-categories-dropdown');
            if (dropdownTriggers) {
                dropdownTriggers.innerHTML = `<div class="category-error">Error: ${error.message}</div>`;
            }
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

                    // Update active triggers in chatCore if available
                    if (window.chatCore) {
                        const triggerName = button.textContent.toUpperCase();
                        if (button.classList.contains('active')) {
                            if (!window.chatCore.activeTriggers.includes(triggerName)) {
                                window.chatCore.activeTriggers.push(triggerName);
                            }
                        } else {
                            const index = window.chatCore.activeTriggers.indexOf(triggerName);
                            if (index > -1) {
                                window.chatCore.activeTriggers.splice(index, 1);
                            }
                        }
                        window.chatCore.updateTriggers();
                        console.log('🎯 Updated active triggers:', window.chatCore.activeTriggers);
                    }
                });

                buttonsDiv.appendChild(button);
            });

            categoryDiv.appendChild(buttonsDiv);
            container.appendChild(categoryDiv);
        });

        console.log('✅ Trigger UI populated successfully');
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
        // FULL COLLAR FUNCTIONALITY WITH SOCKET.IO CONNECTIVITY
        console.log('Initializing collar functionality in dropdown.js');

        // Set up collar button click to toggle dropdown
        const collarButton = document.getElementById('toggle-collar');
        if (collarButton) {
            collarButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = collarButton.closest('.dropdown');
                if (dropdown) {
                    if (dropdown.classList.contains('active')) {
                        this.closeDropdown(dropdown);
                    } else {
                        this.openDropdown(dropdown);
                    }
                }
            });
        }

        // Set up collar action buttons (Copy, Paste, Save)
        const collarBtns = document.querySelectorAll('.collar-btn');
        collarBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleCollarAction(btn);
            });
        });

        // Set up advanced resize detection for collar textarea
        this.setupCollarResizeHandling();

        // Load saved collar settings on initialization
        this.loadSavedCollarSettings();
    }

    handleToggleClick(btn) {
        const buttonId = btn.id;

        if (buttonId === 'toggle-ai') {
            this.toggleAIMode(btn);
        } else if (buttonId === 'toggle-triggers') {
            this.toggleTriggerSystem(btn);
        } else {
            this.toggleButtonState(btn);
        }
    }

    toggleTriggerSystem(btn) {
        // Toggle trigger system state
        const currentState = btn.getAttribute('data-state');
        const newState = currentState === 'off' ? 'on' : 'off';

        btn.setAttribute('data-state', newState);
        btn.textContent = `Triggers: ${newState.toUpperCase()}`;

        // Enable/disable trigger system
        if (window.triggerSystem) {
            window.triggerSystem.isEnabled = (newState === 'on');
            this.addSystemMessage(`🎯 Trigger system ${newState === 'on' ? 'ENABLED' : 'DISABLED'}`);
        }

        // Add visual feedback
        this.showToggleFeedback('TRIGGERS', newState);

        // Dispatch event
        const event = new CustomEvent('triggerSystemToggle', {
            detail: {
                enabled: newState === 'on'
            }
        });
        document.dispatchEvent(event);
    }

    toggleButtonState(btn) {
        const buttonId = btn.id;
        const currentState = this.buttonStates[buttonId];
        const newState = currentState === 'off' ? 'on' : 'off';

        this.buttonStates[buttonId] = newState;
        btn.setAttribute('data-state', newState);

        // Update button text
        const baseName = buttonId.replace('toggle-', '').toUpperCase();

        // Handle different button types
        if (buttonId === 'toggle-collar') {
            btn.textContent = `🔗 Collar: ${newState.toUpperCase()}`;
        } else if (buttonId === 'toggle-spiral') {
            btn.textContent = `Spiral: ${newState.toUpperCase()}`;
            // Toggle spiral animation if available
            if (window.spiralAnimation) {
                const isEnabled = window.spiralAnimation.toggle();
                btn.classList.toggle('active', isEnabled);
            }
        } else if (buttonId === 'toggle-tts') {
            btn.textContent = `TTS: ${newState.toUpperCase()}`;
            // Toggle TTS system if available
            if (window.ttsSystem) {
                const isEnabled = window.ttsSystem.toggle();
                btn.classList.toggle('active', isEnabled);
            }
        } else {
            btn.textContent = `${baseName}: ${newState.toUpperCase()}`;
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
        // Use chatCore's system message if available, otherwise create own
        if (window.chatCore && window.chatCore.addSystemMessagePublic) {
            window.chatCore.addSystemMessagePublic(message);
        } else {
            // Fallback: create system message directly
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
    }

    handleCollarAction(btn) {
        const action = btn.getAttribute('data-action');
        const textarea = document.getElementById('collar-text');

        switch (action) {
            case 'collar-copy':
                if (textarea.value.trim()) {
                    navigator.clipboard.writeText(textarea.value).then(() => {
                        this.addSystemMessage('🔗 ✅ Collar settings copied to clipboard');
                        this.showCollarFeedback('COPIED');
                    }).catch(() => {
                        this.addSystemMessage('❌ Failed to copy collar settings');
                        this.showCollarFeedback('COPY FAILED');
                    });
                } else {
                    this.addSystemMessage('🔗 ⚠️ No collar settings to copy');
                    this.showCollarFeedback('NOTHING TO COPY');
                }
                break;

            case 'collar-paste':
                navigator.clipboard.readText().then(text => {
                    textarea.value = text;
                    // Save to localStorage as well
                    localStorage.setItem('bambi-collar-settings', text);
                    this.addSystemMessage('🔗 ✅ Collar settings pasted from clipboard');
                    this.showCollarFeedback('PASTED');
                }).catch(() => {
                    this.addSystemMessage('❌ Failed to paste collar settings');
                    this.showCollarFeedback('PASTE FAILED');
                });
                break;

            case 'collar-save':
                this.saveCollarSettings();
                break;
        }
    }

    saveCollarSettings() {
        const textarea = document.getElementById('collar-text');
        const collarText = textarea ? textarea.value.trim() : '';

        if (collarText) {
            // Save to localStorage
            localStorage.setItem('bambi-collar-settings', collarText);

            // Get socket from chatCore and activate collar with custom text
            const socket = this.getSocket();
            if (socket) {
                socket.emit('activate-collar', {
                    text: collarText
                });
            }

            this.addSystemMessage(`🔗 ✨ COLLAR ACTIVATED ✨ - Custom submission protocol engaged`);
            this.showCollarFeedback('ACTIVATED & SAVED');

            // Update button state
            this.updateCollarButton(true);

            // Dispatch event to inform other components
            document.dispatchEvent(new CustomEvent('collarActivated', {
                detail: { active: true, text: collarText }
            }));
        } else {
            // Deactivate collar if no text
            const socket = this.getSocket();
            if (socket) {
                socket.emit('deactivate-collar');
            }

            localStorage.removeItem('bambi-collar-settings');
            this.addSystemMessage('🔗 💔 Collar deactivated - No submission text provided');
            this.showCollarFeedback('DEACTIVATED');

            // Update button state
            this.updateCollarButton(false);

            // Dispatch event to inform other components
            document.dispatchEvent(new CustomEvent('collarActivated', {
                detail: { active: false }
            }));
        }

        // Close dropdown after save
        const dropdown = document.querySelector('.collar-dropdown');
        if (dropdown) {
            this.closeDropdown(dropdown);
        }

        // Add visual feedback animation
        const collarButton = document.getElementById('toggle-collar');
        if (collarButton && collarText) {
            collarButton.style.animation = 'collarActivation 1s ease-in-out';
            setTimeout(() => {
                collarButton.style.animation = '';
            }, 1000);
        }
    }

    setupCollarResizeHandling() {
        let isResizing = false;

        const collarTextarea = document.getElementById('collar-text');
        if (collarTextarea) {
            let isMouseDownOnResize = false;

            collarTextarea.addEventListener('mousedown', (e) => {
                // Check if clicking on resize handle (bottom-right corner)
                const rect = collarTextarea.getBoundingClientRect();
                const isNearRightEdge = e.clientX > rect.right - 20;
                const isNearBottomEdge = e.clientY > rect.bottom - 20;

                if (isNearRightEdge && isNearBottomEdge) {
                    isResizing = true;
                    isMouseDownOnResize = true;
                }
            });

            // Track mouse movement during potential resize
            document.addEventListener('mousemove', (e) => {
                if (isMouseDownOnResize) {
                    isResizing = true;
                }
            });

            // Reset resize flag when mouse is released
            document.addEventListener('mouseup', () => {
                // Add small delay to ensure resize operation is complete
                setTimeout(() => {
                    isResizing = false;
                    isMouseDownOnResize = false;
                }, 100);
            });

            // Use ResizeObserver for more reliable resize detection
            if (window.ResizeObserver) {
                const resizeObserver = new ResizeObserver(() => {
                    isResizing = true;
                    // Reset flag after resize animation completes
                    setTimeout(() => {
                        if (!isMouseDownOnResize) {
                            isResizing = false;
                        }
                    }, 200);
                });
                resizeObserver.observe(collarTextarea);
            }

            // Store resize state for other methods to use
            this.isCollarResizing = () => isResizing;
        }
    }

    loadSavedCollarSettings() {
        const savedCollarSettings = localStorage.getItem('bambi-collar-settings');
        if (savedCollarSettings) {
            const collarTextarea = document.getElementById('collar-text');
            if (collarTextarea) {
                collarTextarea.value = savedCollarSettings;
                this.addSystemMessage('🔗 📋 Previous collar settings restored');
            }
        }
    }

    updateCollarButton(isActive) {
        const collarButton = document.getElementById('toggle-collar');
        if (collarButton) {
            if (isActive) {
                collarButton.textContent = `🔗 Collar: ON`;
                collarButton.classList.add('active');
                collarButton.setAttribute('data-state', 'on');
            } else {
                collarButton.textContent = `🔗 Collar: OFF`;
                collarButton.classList.remove('active');
                collarButton.setAttribute('data-state', 'off');
            }
        }
    }

    showCollarFeedback(message) {
        // Create floating feedback notification
        const feedback = document.createElement('div');
        feedback.className = 'collar-feedback';
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
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 3000);
    }

    getSocket() {
        // Get socket from chatCore for socket.io connectivity
        if (window.chatCore && window.chatCore.getSocket) {
            return window.chatCore.getSocket();
        }
        console.warn('chatCore socket not available');
        return null;
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
        // Enhanced click handling with collar resize protection
        if (!e.target.closest('.dropdown')) {
            // Check if collar is resizing before closing
            if (this.isCollarResizing && this.isCollarResizing()) {
                // Don't close collar dropdown if resizing
                document.querySelectorAll('.dropdown:not(.collar-dropdown)').forEach(dropdown => {
                    this.closeDropdown(dropdown);
                });
            } else {
                // Close all dropdowns normally
                this.closeAllDropdowns();
            }
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
    console.log('🚀 DOM loaded, initializing DropdownManager...');
    window.dropdownManager = new DropdownManager();

    // Load saved collar settings
    const savedCollarSettings = localStorage.getItem('bambi-collar-settings');
    if (savedCollarSettings) {
        console.log('📋 Loading saved collar settings');
        const collarTextarea = document.getElementById('collar-text');
        if (collarTextarea) {
            collarTextarea.value = savedCollarSettings;
        }
    }

    console.log('✅ DropdownManager initialization complete');
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
