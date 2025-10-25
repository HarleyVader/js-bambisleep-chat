/**
 * Universal Dropdown Manager for BambiSleep Chat
 * Handles universal dropdown menu interactions and coordinates with component dropdowns
 */

import {
    SpiralDropdown,
    TTSDropdown,
    TriggersDropdown,
    AIDropdown,
    CollarDropdown,
    createBrainwaveDropdown
} from './dropdowns/index.js';

import { StorageUtils } from './storage-utils.js';

class DropdownManager {
    constructor() {
        console.log('🔧 DropdownManager constructor called');
        this.activeDropdown ??= null;
        this.buttonStates ??= {
            'toggle-spiral': 'off',
            'toggle-tts': 'off',
            'toggle-triggers': 'off',
            'toggle-ai': 'chat',
            'toggle-collar': 'off'
        };

        // Initialize component dropdowns
        this.components ??= {};
        this.init();
    }

    init() {
        console.log('⚙️ DropdownManager init started');

        // Initialize StorageUtils protection
        try {
            StorageUtils.init();
            console.log('🛡️ StorageUtils protection initialized');
        } catch (error) {
            console.error('❌ Error initializing StorageUtils protection:', error);
        }

        // Clean up any invalid localStorage entries on startup
        try {
            StorageUtils.cleanupInvalidEntries();
            console.log('🧹 localStorage cleanup completed');
        } catch (error) {
            console.error('❌ Error during localStorage cleanup:', error);
        }

        // Add universal event listeners
        document.addEventListener('click', this.handleClick.bind(this));
        document.addEventListener('keydown', this.handleKeydown.bind(this));

        // Initialize dropdowns and components
        this.initializeDropdowns();
        this.initializeComponents();

        console.log('✅ DropdownManager init completed');
    }

    initializeComponents() {
        console.log('🔧 Initializing dropdown components...');

        try {
            // Initialize each dropdown component
            this.components.spiral = new SpiralDropdown(this);
            this.components.tts = new TTSDropdown(this);
            this.components.triggers = new TriggersDropdown(this);
            this.components.ai = new AIDropdown(this);
            this.components.collar = new CollarDropdown(this);

            // Initialize brainwave dropdown (functional component)
            this.initializeBrainwaveDropdown();

            console.log('✅ All dropdown components initialized');
        } catch (error) {
            console.error('❌ Error initializing dropdown components:', error);
        }
    }

    initializeBrainwaveDropdown() {
        try {
            const container = document.getElementById('brainwave-dropdown-container');
            if (container) {
                const brainwaveDropdown = createBrainwaveDropdown();
                container.appendChild(brainwaveDropdown);
                console.log('🧠 Brainwave dropdown initialized');
            }
        } catch (error) {
            console.error('❌ Error initializing brainwave dropdown:', error);
        }
    }

    initializeDropdowns() {
        const dropdowns = document.querySelectorAll('.dropdown');
        dropdowns.forEach(dropdown => {
            const btn = dropdown.querySelector('.dropdown-btn');

            // Set up click handlers for all standard dropdowns (AI and collar have custom handling but now follow same pattern)
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();

                    if (dropdown.classList.contains('active')) {
                        this.closeDropdown(dropdown);
                    } else {
                        this.openDropdown(dropdown);
                    }

                    // Handle toggle functionality for toggle buttons (except AI which has custom logic)
                    if (btn.classList.contains('toggle-button') && btn.id !== 'toggle-ai') {
                        this.handleToggleClick(btn);
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
    }

    handleToggleClick(btn) {
        const buttonId = btn.id;
        const component = this.getComponentForButton(buttonId);

        if (component && component.toggleState) {
            component.toggleState(btn);
        } else {
            // Fallback for buttons without specific components
            this.toggleButtonState(btn);
        }
    }

    getComponentForButton(buttonId) {
        switch (buttonId) {
            case 'toggle-spiral':
                return this.components.spiral;
            case 'toggle-tts':
                return this.components.tts;
            case 'toggle-triggers':
                return this.components.triggers;
            case 'toggle-ai':
                return this.components.ai;
            case 'toggle-collar':
                return this.components.collar;
            default:
                return null;
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

    // Universal dropdown management methods
    openDropdown(dropdown) {
        // Close any other open dropdown
        if (this.activeDropdown && this.activeDropdown !== dropdown) {
            this.closeDropdown(this.activeDropdown);
        }

        console.log('🔽 Dropdown opening:', dropdown);
        dropdown.classList.add('active');
        this.activeDropdown = dropdown;

        // Make chat toggle button transparent and unclickable
        const chatToggleBtn = document.getElementById('chat-toggle-button');
        if (chatToggleBtn) {
            chatToggleBtn.classList.add('dropdown-active');
        }

        // Populate dropdown content if needed
        this.populateDropdownContent(dropdown);
    }

    closeDropdown(dropdown) {
        dropdown.classList.remove('active');
        if (this.activeDropdown === dropdown) {
            this.activeDropdown = null;

            // Restore chat toggle button when no dropdowns are active
            const chatToggleBtn = document.getElementById('chat-toggle-button');
            if (chatToggleBtn) {
                chatToggleBtn.classList.remove('dropdown-active');
            }
        }
    }

    closeAllDropdowns() {
        const activeDropdowns = document.querySelectorAll('.dropdown.active');
        activeDropdowns.forEach(dropdown => {
            this.closeDropdown(dropdown);
        });

        // Ensure chat toggle button is restored when all dropdowns are closed
        const chatToggleBtn = document.getElementById('chat-toggle-button');
        if (chatToggleBtn) {
            chatToggleBtn.classList.remove('dropdown-active');
        }
    }

    populateDropdownContent(dropdown) {
        const btn = dropdown.querySelector('.dropdown-btn');
        if (!btn) {
            console.warn('No button found in dropdown');
            return;
        }

        const component = this.getComponentForButton(btn.id);
        const contentContainer = dropdown.querySelector('.dropdown-content');

        if (component && component.getDropdownContent && contentContainer) {
            // ALWAYS populate content - NO CONDITIONS
            try {
                const content = component.getDropdownContent();
                contentContainer.innerHTML = content;
                this.attachContentEventListeners(contentContainer);
            } catch (error) {
                console.error(`❌ Error generating content for ${btn.id}:`, error);
            }
        }
    }

    attachContentEventListeners(container) {
        // Re-attach event listeners for dynamically added content
        const links = container.querySelectorAll('a[data-action]');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleDropdownAction(link);
            });
        });

        const inputs = container.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent dropdown from closing
            });
        });

        // Handle SELECT elements
        const selects = container.querySelectorAll('select[data-action]');
        selects.forEach(select => {
            select.addEventListener('change', (e) => {
                e.stopPropagation();
                this.handleDropdownSelect(select);
            });

            select.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent dropdown from closing
            });
        });
    }

    handleClick(e) {
        // Enhanced click handling with resize protection and component considerations
        const isInsideDropdown = e.target.closest('.dropdown');
        const isResizing = e.target.classList.contains('collar-textarea') ||
            (this.components.collar && this.components.collar.isResizing);

        if (!isInsideDropdown && !isResizing) {
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

        // Execute the action
        this.executeAction(action, buttonId, link.textContent);
    }

    handleDropdownSelect(select) {
        const action = select.getAttribute('data-action');
        const dropdown = select.closest('.dropdown');
        const buttonId = dropdown.querySelector('.dropdown-btn').id;

        console.log(`Dropdown select: ${action} for button: ${buttonId}, value: ${select.value}`);

        // Don't close dropdown for select elements - let user make multiple selections

        // Execute the action
        this.executeSelectAction(action, buttonId, select);
    }

    executeSelectAction(action, buttonId, selectElement) {
        // Create a custom event for the select action
        const event = new CustomEvent('dropdownAction', {
            detail: {
                action: action,
                buttonId: buttonId,
                element: selectElement,
                value: selectElement.value,
                selectedText: selectElement.options[selectElement.selectedIndex].text
            }
        });
        document.dispatchEvent(event);
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

        // Add visual feedback
        this.showActionFeedback(buttonId.replace('toggle-', '').toUpperCase(), selectedText);
    }

    // Universal feedback methods
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
            if (notification && notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    // Public API methods for external scripts
    getComponent(componentName) {
        return this.components[componentName];
    }

    triggerAction(buttonId, action) {
        this.executeAction(action, buttonId, '');
    }
}

// Add notification animations if not already present
const existingStyle = document.querySelector('style[data-dropdown-animations]');
if (!existingStyle) {
    const style = document.createElement('style');
    style.setAttribute('data-dropdown-animations', 'true');
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

        .collar-feedback {
            animation: slideInRight 0.3s ease-out, slideOutRight 0.3s ease-in 2.7s !important;
        }
    `;
    document.head.appendChild(style);
}

// Initialize dropdown manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, initializing DropdownManager...');

    try {
        window.dropdownManager = new DropdownManager();

        // Add a short delay to allow all scripts to fully initialize
        setTimeout(() => {
            console.log('🔍 Checking component availability...');

            Object.keys(window.dropdownManager.components).forEach(componentName => {
                const component = window.dropdownManager.components[componentName];
                if (component) {
                    console.log(`✅ ${componentName} component available`);

                    // Test component method availability
                    if (component.getDropdownContent) {
                        console.log(`  ✓ ${componentName}.getDropdownContent() available`);
                    } else {
                        console.warn(`  ⚠️ ${componentName}.getDropdownContent() missing`);
                    }
                } else {
                    console.warn(`⚠️ ${componentName} component not available`);
                }
            });

            // Test dropdown content generation
            console.log('🧪 Testing dropdown content generation...');
            const testDropdown = document.querySelector('.dropdown');
            if (testDropdown) {
                window.dropdownManager.populateDropdownContent(testDropdown);
                console.log('✓ Test dropdown content generation completed');
            }
        }, 1000);

        console.log('✅ DropdownManager initialization complete');
    } catch (error) {
        console.error('❌ Failed to initialize DropdownManager:', error);
    }
});

// Debug function for testing dropdown functionality
window.testDropdowns = function () {
    console.log('🧪 Testing dropdown system...');

    if (!window.dropdownManager) {
        console.error('❌ DropdownManager not initialized');
        return false;
    }

    // Test each component
    const components = ['spiral', 'tts', 'triggers', 'ai', 'collar'];
    let allPassed = true;

    components.forEach(componentName => {
        const component = window.dropdownManager.getComponent(componentName);
        if (component) {
            console.log(`✓ ${componentName} component test passed`);

            // Test content generation
            try {
                const content = component.getDropdownContent();
                if (content && content.length > 0) {
                    console.log(`  ✓ ${componentName} content generation test passed`);
                } else {
                    console.warn(`  ⚠️ ${componentName} returned empty content`);
                }
            } catch (error) {
                console.error(`  ❌ ${componentName} content generation failed:`, error);
                allPassed = false;
            }
        } else {
            console.error(`❌ ${componentName} component test failed`);
            allPassed = false;
        }
    });

    console.log(allPassed ? '✅ All dropdown tests passed' : '❌ Some dropdown tests failed');
    return allPassed;
};

// Add global error handling for localStorage issues
window.addEventListener('error', (event) => {
    if (event.error && event.error.message && event.error.message.includes('JSON.parse')) {
        console.warn('🔍 JSON parsing error detected (possibly from external extension):', event.error);
        // Don't let external JSON errors break our app
        event.preventDefault();
    }
});

// Storage change event listener to catch potential issues from external sources
window.addEventListener('storage', (event) => {
    if (event.key && event.key.startsWith('bambi-')) {
        console.log('🔍 Storage change detected for bambi key:', event.key);

        // Validate that the new value is not "[object Object]"
        if (event.newValue === '[object Object]') {
            console.warn('⚠️ Detected "[object Object]" storage value, cleaning up:', event.key);
            try {
                localStorage.removeItem(event.key);
            } catch (error) {
                console.error('Failed to clean up invalid storage:', error);
            }
        }
    }
});

// Export for external use
export default DropdownManager;
