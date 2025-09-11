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

    // Helper function to safely access spiral controls
    getSpiralControls() {
        if (window.spiralControls && window.spiralAnimation) {
            return window.spiralControls;
        }
        console.warn('⚠️ Spiral controls not available yet');
        return null;
    }

    // Helper function to safely access trigger system
    getTriggerSystem() {
        if (window.triggerSystem) {
            return window.triggerSystem;
        }
        console.warn('⚠️ Trigger system not available yet');
        return null;
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
        const triggerSystem = this.getTriggerSystem();
        if (triggerSystem) {
            triggerSystem.isEnabled = (newState === 'on');
            this.addSystemMessage(`🎯 Trigger system ${newState === 'on' ? 'ENABLED' : 'DISABLED'}`);
        } else {
            console.warn('⚠️ Trigger system not available');
            this.addSystemMessage(`⚠️ Trigger system not available - please refresh page`);
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
                console.log(`🌀 Spiral animation ${isEnabled ? 'ENABLED' : 'DISABLED'}`);
            } else {
                console.warn('⚠️ Spiral animation not available');
                this.addSystemMessage(`⚠️ Spiral animation not available - please refresh page`);
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

    // Add a short delay to allow all scripts to fully initialize
    setTimeout(() => {
        console.log('🔍 Checking spiral controls availability...');
        const spiralControls = window.dropdownManager.getSpiralControls();
        const triggerSystem = window.dropdownManager.getTriggerSystem();
        
        if (spiralControls) {
            console.log('✅ Spiral controls are available and ready!');
            console.log('🌀 Spiral animation object:', window.spiralAnimation);
            console.log('🎛️ Spiral controls object:', spiralControls);
            
            // Create a success indicator on the page
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                position: fixed; top: 10px; left: 10px; z-index: 10000;
                background: green; color: white; padding: 5px 10px;
                border-radius: 5px; font-family: monospace; font-size: 12px;
            `;
            indicator.textContent = '✅ Spiral Controls Ready';
            document.body.appendChild(indicator);
            
            // Test a spiral control function
            try {
                spiralControls.setSpiralAColor(255, 100, 255, 0.8);
                console.log('🧪 Quick spiral color test successful');
            } catch (e) {
                console.error('❌ Quick spiral test failed:', e);
            }
        } else {
            console.warn('❌ Spiral controls not available!');
            console.log('🔧 window.spiralAnimation:', window.spiralAnimation);
            console.log('🔧 window.spiralControls:', window.spiralControls);
            
            // Create an error indicator on the page
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                position: fixed; top: 10px; left: 10px; z-index: 10000;
                background: red; color: white; padding: 5px 10px;
                border-radius: 5px; font-family: monospace; font-size: 12px;
            `;
            indicator.textContent = '❌ Spiral Controls NOT Ready';
            document.body.appendChild(indicator);
        }
        
        if (triggerSystem) {
            console.log('✅ Trigger system is available and ready!');
        } else {
            console.warn('❌ Trigger system not available!');
        }
    }, 1000);

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

// Debug function for testing spiral controls
window.testSpiralControls = function() {
    console.log('🧪 Testing spiral controls...');
    
    if (!window.dropdownManager) {
        console.error('❌ DropdownManager not initialized');
        return false;
    }
    
    const spiralControls = window.dropdownManager.getSpiralControls();
    if (!spiralControls) {
        console.error('❌ Spiral controls not available');
        return false;
    }
    
    console.log('✅ Spiral controls available! Testing functions...');
    
    // Test color change
    try {
        spiralControls.setSpiralAColor(255, 0, 0, 1.0); // Red
        console.log('✅ setSpiralAColor test passed');
    } catch (e) {
        console.error('❌ setSpiralAColor test failed:', e);
    }
    
    // Test speed change
    try {
        spiralControls.setFrameSpeed('A', 15);
        console.log('✅ setFrameSpeed test passed');
    } catch (e) {
        console.error('❌ setFrameSpeed test failed:', e);
    }
    
    // Test preset loading
    try {
        spiralControls.loadPreset('hypnotic');
        console.log('✅ loadPreset test passed');
    } catch (e) {
        console.error('❌ loadPreset test failed:', e);
    }
    
    console.log('🧪 Spiral controls test complete');
    return true;
};

// Listen for dropdown actions to integrate with existing functionality
document.addEventListener('dropdownAction', (e) => {
    const { action, buttonId, selectedText } = e.detail;

    // Integration examples - you can extend these based on your existing code
    switch (action) {
        case 'spiral-speed-slow':
        case 'spiral-speed-normal':
        case 'spiral-speed-fast':
            const spiralControls = window.dropdownManager?.getSpiralControls();
            if (spiralControls) {
                const speeds = {
                    'spiral-speed-slow': { frame1: 40, frame2: 35, rotation: 15 },
                    'spiral-speed-normal': { frame1: 20, frame2: 20, rotation: 10 },
                    'spiral-speed-fast': { frame1: 8, frame2: 12, rotation: 4 }
                };
                const speed = speeds[action];
                spiralControls.setFrameSpeed('A', speed.frame1);
                spiralControls.setFrameSpeed('B', speed.frame2);
                spiralControls.setRotationSpeed(speed.rotation);
                console.log(`✅ Setting spiral speed to: ${selectedText}`);
            } else {
                console.warn(`⚠️ Failed to set spiral speed to: ${selectedText} - controls not available`);
            }
            break;

        case 'spiral-color-cycle':
            const spiralControls2 = window.dropdownManager?.getSpiralControls();
            if (spiralControls2) {
                spiralControls2.randomizeParameters();
                console.log('✅ Enabling spiral color cycle');
            } else {
                console.warn('⚠️ Failed to enable spiral color cycle - controls not available');
            }
            break;

        case 'spiral-color-pink':
            const spiralControls3 = window.dropdownManager?.getSpiralControls();
            if (spiralControls3) {
                spiralControls3.setSpiralAColor(255, 20, 147, 1.0);
                spiralControls3.setSpiralBColor(255, 105, 180, 0.8);
                console.log('✅ Setting spiral to pink colors');
            } else {
                console.warn('⚠️ Failed to set pink colors - controls not available');
            }
            break;

        case 'spiral-color-purple':
            const spiralControls4 = window.dropdownManager?.getSpiralControls();
            if (spiralControls4) {
                spiralControls4.setSpiralAColor(138, 43, 226, 1.0);
                spiralControls4.setSpiralBColor(186, 85, 211, 0.8);
                console.log('✅ Setting spiral to purple colors');
            } else {
                console.warn('⚠️ Failed to set purple colors - controls not available');
            }
            break;

        case 'spiral-color-blue':
            const spiralControls5 = window.dropdownManager?.getSpiralControls();
            if (spiralControls5) {
                spiralControls5.setSpiralAColor(0, 191, 255, 1.0);
                spiralControls5.setSpiralBColor(30, 144, 255, 0.8);
                console.log('✅ Setting spiral to blue colors');
            } else {
                console.warn('⚠️ Failed to set blue colors - controls not available');
            }
            break;

        case 'spiral-color-rainbow':
            const spiralControls6 = window.dropdownManager?.getSpiralControls();
            if (spiralControls6) {
                spiralControls6.enableRandomizer(2000); // Change every 2 seconds
                console.log('✅ Enabling rainbow color randomizer');
            } else {
                console.warn('⚠️ Failed to enable rainbow randomizer - controls not available');
            }
            break;

        case 'spiral-preset-hypnotic':
        case 'spiral-preset-intense':
        case 'spiral-preset-peaceful':
        case 'spiral-preset-chaos':
            const spiralControls7 = window.dropdownManager?.getSpiralControls();
            if (spiralControls7) {
                const preset = action.replace('spiral-preset-', '');
                spiralControls7.loadPreset(preset);
                console.log(`✅ Loading spiral preset: ${selectedText}`);
            } else {
                console.warn(`⚠️ Failed to load preset: ${selectedText} - controls not available`);
            }
            break;

        case 'spiral-geometry-tight':
            const spiralControls8 = window.dropdownManager?.getSpiralControls();
            if (spiralControls8) {
                spiralControls8.setSpiralGeometry('A', 1.2);
                spiralControls8.setSpiralGeometry('B', 0.4);
                console.log('✅ Setting spiral geometry to tight');
            } else {
                console.warn('⚠️ Failed to set tight geometry - controls not available');
            }
            break;

        case 'spiral-geometry-normal':
            const spiralControls9 = window.dropdownManager?.getSpiralControls();
            if (spiralControls9) {
                spiralControls9.setSpiralGeometry('A', 4.7);
                spiralControls9.setSpiralGeometry('B', 0.9);
                console.log('✅ Setting spiral geometry to normal');
            } else {
                console.warn('⚠️ Failed to set normal geometry - controls not available');
            }
            break;

        case 'spiral-geometry-wide':
            const spiralControls10 = window.dropdownManager?.getSpiralControls();
            if (spiralControls10) {
                spiralControls10.setSpiralGeometry('A', 8.5);
                spiralControls10.setSpiralGeometry('B', 3.2);
                console.log('✅ Setting spiral geometry to wide');
            } else {
                console.warn('⚠️ Failed to set wide geometry - controls not available');
            }
            break;

        case 'spiral-randomizer-on':
            const spiralControls11 = window.dropdownManager?.getSpiralControls();
            if (spiralControls11) {
                spiralControls11.enableRandomizer(5000);
                console.log('✅ Enabling spiral randomizer');
            } else {
                console.warn('⚠️ Failed to enable randomizer - controls not available');
            }
            break;

        case 'spiral-randomizer-off':
            const spiralControls12 = window.dropdownManager?.getSpiralControls();
            if (spiralControls12) {
                spiralControls12.disableRandomizer();
                console.log('✅ Disabling spiral randomizer');
            } else {
                console.warn('⚠️ Failed to disable randomizer - controls not available');
            }
            break;

        case 'spiral-alpha-low':
            const spiralControls13 = window.dropdownManager?.getSpiralControls();
            if (spiralControls13) {
                const controls = spiralControls13.getControls();
                spiralControls13.setSpiralAColor(
                    controls.spiralA_color[0], controls.spiralA_color[1],
                    controls.spiralA_color[2], 0.3
                );
                spiralControls13.setSpiralBColor(
                    controls.spiralB_color[0], controls.spiralB_color[1],
                    controls.spiralB_color[2], 0.3
                );
                console.log('✅ Setting spiral alpha to low');
            } else {
                console.warn('⚠️ Failed to set low alpha - controls not available');
            }
            break;

        case 'spiral-alpha-medium':
            const spiralControls14 = window.dropdownManager?.getSpiralControls();
            if (spiralControls14) {
                const controls = spiralControls14.getControls();
                spiralControls14.setSpiralAColor(
                    controls.spiralA_color[0], controls.spiralA_color[1],
                    controls.spiralA_color[2], 0.7
                );
                spiralControls14.setSpiralBColor(
                    controls.spiralB_color[0], controls.spiralB_color[1],
                    controls.spiralB_color[2], 0.7
                );
                console.log('✅ Setting spiral alpha to medium');
            } else {
                console.warn('⚠️ Failed to set medium alpha - controls not available');
            }
            break;

        case 'spiral-alpha-high':
            const spiralControls15 = window.dropdownManager?.getSpiralControls();
            if (spiralControls15) {
                const controls = spiralControls15.getControls();
                spiralControls15.setSpiralAColor(
                    controls.spiralA_color[0], controls.spiralA_color[1],
                    controls.spiralA_color[2], 1.0
                );
                spiralControls15.setSpiralBColor(
                    controls.spiralB_color[0], controls.spiralB_color[1],
                    controls.spiralB_color[2], 1.0
                );
                console.log('✅ Setting spiral alpha to high');
            } else {
                console.warn('⚠️ Failed to set high alpha - controls not available');
            }
            break;

        case 'spiral-brainwash-mode':
            const spiralControls16 = window.dropdownManager?.getSpiralControls();
            if (spiralControls16) {
                // Ultra intense brainwash settings
                spiralControls16.setFrameSpeed('A', 3);
                spiralControls16.setFrameSpeed('B', 5);
                spiralControls16.setRotationSpeed(2);
                spiralControls16.setSpiralGeometry('A', 9.5);
                spiralControls16.setSpiralGeometry('B', 6.2);
                spiralControls16.setSpiralAColor(255, 0, 255, 1.0);
                spiralControls16.setSpiralBColor(255, 20, 147, 0.9);
                spiralControls16.enableRandomizer(1500);
                console.log('🌀 ✅ BRAINWASH MODE ACTIVATED 🌀');
            } else {
                console.warn('⚠️ Failed to activate brainwash mode - controls not available');
            }
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

// Listen for spiral control changes to update UI feedback
document.addEventListener('spiralControlChange', (e) => {
    const { category, property, value } = e.detail;
    console.log(`🌀 Spiral control updated: ${property} = ${value}`);
});

document.addEventListener('spiralRandomized', (e) => {
    console.log('🎲 Spiral parameters randomized!');
    if (window.dropdownManager) {
        window.dropdownManager.showActionFeedback('SPIRAL', 'RANDOMIZED');
    }
});

document.addEventListener('spiralPresetLoaded', (e) => {
    const { preset } = e.detail;
    console.log(`🎭 Spiral preset loaded: ${preset}`);
    if (window.dropdownManager) {
        window.dropdownManager.showActionFeedback('SPIRAL', `PRESET: ${preset.toUpperCase()}`);
    }
});
