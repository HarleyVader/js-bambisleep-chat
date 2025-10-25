/**
 * Universal Dropdown Manager for BambiSleep Chat
 * Handles universal dropdown menu interactions and coordinates with component dropdowns
 * Includes enhanced interaction features and animations
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
import AnimationController from './animation-controller.js';

/**
 * DropdownUtils - Enhanced interaction features
 * Provides advanced animations, keyboard navigation, and positioning
 */
class DropdownUtils {
    static enhanceDropdowns() {
        const dropdowns = document.querySelectorAll('.dropdown');

        dropdowns.forEach(dropdown => {
            const button = dropdown.querySelector('.dropdown-btn, .dropdown-button');
            const content = dropdown.querySelector('.dropdown-content');

            if (button && content) {
                // Add utility classes
                button.classList.add('smooth-transition', 'enhanced-focus', 'click-feedback');
                content.classList.add('smooth-transition');

                // Add hover effects
                button.addEventListener('mouseenter', () => {
                    if (!button.classList.contains('glow-effect')) {
                        button.classList.add('glow-effect');
                    }
                });

                // Add items interaction
                const items = content.querySelectorAll('.dropdown-item, [class*="item"], button, select, input');
                items.forEach(item => {
                    item.classList.add('smooth-transition');

                    item.addEventListener('mouseenter', () => {
                        items.forEach(sibling => sibling.classList.remove('highlighted'));
                        item.classList.add('highlighted');
                    });

                    item.addEventListener('mouseleave', () => {
                        item.classList.remove('highlighted');
                    });
                });
            }
        });
    }

    static navigateItems(items, currentItem, direction) {
        if (items.length === 0) return;

        let currentIndex = currentItem ? Array.from(items).indexOf(currentItem) : -1;
        let nextIndex = currentIndex + direction;

        // Wrap around
        if (nextIndex >= items.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = items.length - 1;

        if (currentItem) currentItem.classList.remove('highlighted');

        const nextItem = items[nextIndex];
        if (nextItem) {
            nextItem.classList.add('highlighted');
            nextItem.focus();
        }
    }

    static repositionActiveDropdowns() {
        const activeDropdowns = document.querySelectorAll('.dropdown.active');
        activeDropdowns.forEach(dropdown => {
            const content = dropdown.querySelector('.dropdown-content');
            const button = dropdown.querySelector('.dropdown-btn, .dropdown-button');

            if (content && button) {
                const buttonRect = button.getBoundingClientRect();
                content.style.top = `${buttonRect.bottom + 4}px`;
                content.style.left = `${buttonRect.left}px`;

                const contentRect = content.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                if (contentRect.right > viewportWidth) {
                    content.style.left = `${viewportWidth - contentRect.width - 10}px`;
                }

                if (contentRect.bottom > viewportHeight) {
                    content.style.top = `${buttonRect.top - contentRect.height - 4}px`;
                }
            }
        });
    }

    static addVisualFeedback(element, type = 'success') {
        const feedback = document.createElement('div');
        feedback.className = `visual-feedback visual-feedback-${type} z-tooltip`;

        element.classList.add('feedback-container');
        element.appendChild(feedback);

        setTimeout(() => feedback.remove(), 600);
    }
}

class DropdownManager {
    constructor() {
        this.activeDropdown ??= null;
        this.buttonStates ??= {
            'toggle-spiral': 'off',
            'toggle-tts': 'off',
            'toggle-triggers': 'off',
            'toggle-ai': 'chat',
            'toggle-collar': 'off'
        };

        // ENHANCED: Centralized component state management
        this.componentStates ??= {
            tts: {
                currentVoice: 'af_bella',
                currentSpeed: 1.0,
                selectedVoices: [],
                isEnabled: false
            },
            ai: {
                isEnabled: false,
                currentModel: 'balanced' // 'creative', 'balanced', 'precise'
            },
            spiral: {
                isEnabled: false,
                currentPreset: null,
                settings: {}
            },
            collar: {
                collarSettings: '',
                isActive: false
            },
            triggers: {
                isEnabled: false,
                selectedCategories: []
            }
        };

        // Initialize component dropdowns
        this.components ??= {};
        this.init();
    }

    init() {
        // Initialize StorageUtils protection
        try {
            StorageUtils.init();
        } catch (error) {
            console.error('❌ Error initializing StorageUtils protection:', error);
        }

        // Clean up any invalid localStorage entries on startup
        try {
            StorageUtils.cleanupInvalidEntries();
        } catch (error) {
            console.error('❌ Error during localStorage cleanup:', error);
        }

        // Enhance dropdowns with utility features
        DropdownUtils.enhanceDropdowns();

        // Add universal event listeners
        document.addEventListener('click', this.handleClick.bind(this));
        document.addEventListener('keydown', this.handleKeydown.bind(this));

        // Reposition dropdowns on scroll and resize
        window.addEventListener('scroll', () => DropdownUtils.repositionActiveDropdowns(), { passive: true });
        window.addEventListener('resize', () => DropdownUtils.repositionActiveDropdowns());

        // Initialize dropdowns and components
        this.initializeDropdowns();
        this.initializeComponents();

        // Initialize centralized event delegation
        this.initializeEventDelegation();
    }

    // ENHANCED: Centralized Event Delegation System
    initializeEventDelegation() {
        // Prevent duplicate event handlers by using a single delegated handler
        this.eventRegistry = new Map(); // Track registered event handlers

        // Central event delegation for dropdown actions
        document.addEventListener('dropdownAction', (e) => {
            this.handleCentralizedDropdownAction(e);
        }, { once: false });

        // Central event delegation for component state changes
        document.addEventListener('componentStateChange', (e) => {
            this.handleComponentStateChange(e);
        }, { once: false });

        // Central event delegation for trigger selections
        document.addEventListener('triggerSelection', (e) => {
            this.handleTriggerSelection(e);
        }, { once: false });

        // Prevent event conflicts by centralizing input handlers
        document.addEventListener('input', (e) => {
            this.handleCentralizedInput(e);
        }, { once: false });

        console.log('✅ Centralized event delegation initialized');
    }

    handleCentralizedDropdownAction(event) {
        const { action, buttonId, selectedText, element, value } = event.detail;

        // Route to appropriate component based on buttonId
        const component = this.getComponentForButton(buttonId);
        if (component && component.handleAction) {
            try {
                component.handleAction(action, event.detail);
            } catch (error) {
                console.error(`❌ Error handling dropdown action in ${buttonId}:`, error);
            }
        } else {
            console.warn(`⚠️ No component found for button ${buttonId} or handleAction not implemented`);
        }
    }

    handleComponentStateChange(event) {
        const { component, key, value, fullState } = event.detail;
        console.log(`🔄 Component state changed: ${component}.${key} = ${value}`);

        // Trigger any necessary UI updates
        this.updateComponentUI(component, key, value);
    }

    handleTriggerSelection(event) {
        const { trigger, category, isSelected } = event.detail;
        console.log(`🎯 Trigger selection: ${trigger} (${category}) - ${isSelected ? 'selected' : 'deselected'}`);

        // Update trigger system state
        const triggersComponent = this.components.triggers;
        if (triggersComponent && triggersComponent.handleTriggerSelection) {
            triggersComponent.handleTriggerSelection(event.detail);
        }
    }

    handleCentralizedInput(event) {
        const element = event.target;
        const dropdown = element.closest('.dropdown');

        if (!dropdown) return; // Only handle inputs within dropdowns

        const buttonId = dropdown.querySelector('.dropdown-btn')?.id;
        if (!buttonId) return;

        // Route input events to appropriate component
        const component = this.getComponentForButton(buttonId);
        if (component && component.handleInput) {
            component.handleInput(event);
        }
    }

    updateComponentUI(componentName, key, value) {
        // Update UI elements based on component state changes
        switch (componentName) {
            case 'tts':
                this.updateTTSUI(key, value);
                break;
            case 'ai':
                this.updateAIUI(key, value);
                break;
            case 'spiral':
                this.updateSpiralUI(key, value);
                break;
            case 'collar':
                this.updateCollarUI(key, value);
                break;
            case 'triggers':
                this.updateTriggersUI(key, value);
                break;
        }
    }

    updateTTSUI(key, value) {
        if (key === 'isEnabled') {
            const btn = document.getElementById('toggle-tts');
            const status = document.getElementById('tts-status');
            if (btn) btn.setAttribute('data-state', value ? 'on' : 'off');
            if (status) status.className = value ? 'status-active' : 'status-inactive';
        }
    }

    updateAIUI(key, value) {
        if (key === 'isEnabled') {
            const btn = document.getElementById('toggle-ai');
            const status = document.getElementById('ai-status');
            if (btn) btn.setAttribute('data-state', value ? 'on' : 'off');
            if (status) status.className = value ? 'status-active' : 'status-inactive';
        }
    }

    updateSpiralUI(key, value) {
        if (key === 'isEnabled') {
            const btn = document.getElementById('toggle-spiral');
            const status = document.getElementById('spiral-status');
            if (btn) btn.setAttribute('data-state', value ? 'on' : 'off');
            if (status) status.className = value ? 'status-active' : 'status-inactive';
        }
    }

    updateCollarUI(key, value) {
        if (key === 'isActive') {
            const btn = document.getElementById('toggle-collar');
            const status = document.getElementById('collar-status');
            if (btn) btn.setAttribute('data-state', value ? 'on' : 'off');
            if (status) status.className = value ? 'status-active' : 'status-inactive';
        }
    }

    updateTriggersUI(key, value) {
        if (key === 'isEnabled') {
            const btn = document.getElementById('toggle-triggers');
            const status = document.getElementById('triggers-status');
            if (btn) btn.setAttribute('data-state', value ? 'on' : 'off');
            if (status) status.className = value ? 'status-active' : 'status-inactive';
        }
    }

    getComponentForButton(buttonId) {
        // Map button IDs to their corresponding components
        const buttonComponentMap = {
            'toggle-tts': 'tts',
            'toggle-ai': 'ai',
            'toggle-spiral': 'spiral',
            'toggle-collar': 'collar',
            'toggle-triggers': 'triggers',
            'toggle-brainwave': 'brainwave'
        };

        const componentName = buttonComponentMap[buttonId];
        return componentName ? this.components[componentName] : null;
    }

    // Method to safely remove duplicate event listeners
    removeDuplicateEventListeners() {
        // This method can be called to clean up any duplicate listeners
        // Components should use this when they detect multiple handlers
        console.log('🧹 Cleaning up duplicate event listeners');

        // Each component can register their cleanup function
        Object.values(this.components).forEach(component => {
            if (component.cleanup) {
                component.cleanup();
            }
        });
    }

    // ENHANCED: Centralized State Management Methods
    getComponentState(componentName, key = null) {
        if (!this.componentStates[componentName]) {
            console.warn(`⚠️ Component '${componentName}' not found in state`);
            return null;
        }

        if (key) {
            return this.componentStates[componentName][key];
        }

        return this.componentStates[componentName];
    }

    setComponentState(componentName, key, value) {
        if (!this.componentStates[componentName]) {
            console.warn(`⚠️ Component '${componentName}' not found in state`);
            return false;
        }

        this.componentStates[componentName][key] = value;

        // Trigger state change event for components to react
        const event = new CustomEvent('componentStateChange', {
            detail: {
                component: componentName,
                key: key,
                value: value,
                fullState: this.componentStates[componentName]
            }
        });
        document.dispatchEvent(event);

        return true;
    }

    updateComponentState(componentName, stateObject) {
        if (!this.componentStates[componentName]) {
            console.warn(`⚠️ Component '${componentName}' not found in state`);
            return false;
        }

        Object.assign(this.componentStates[componentName], stateObject);

        // Trigger state change event
        const event = new CustomEvent('componentStateChange', {
            detail: {
                component: componentName,
                fullUpdate: true,
                fullState: this.componentStates[componentName]
            }
        });
        document.dispatchEvent(event);

        return true;
    }

    // Reset component state to defaults
    resetComponentState(componentName) {
        const defaults = {
            tts: {
                currentVoice: 'af_bella',
                currentSpeed: 1.0,
                selectedVoices: [],
                isEnabled: false
            },
            ai: {
                isEnabled: false,
                currentModel: 'balanced'
            },
            spiral: {
                isEnabled: false,
                currentPreset: null,
                settings: {}
            },
            collar: {
                collarSettings: '',
                isActive: false
            },
            triggers: {
                isEnabled: false,
                selectedCategories: []
            }
        };

        if (defaults[componentName]) {
            this.componentStates[componentName] = { ...defaults[componentName] };

            const event = new CustomEvent('componentStateChange', {
                detail: {
                    component: componentName,
                    reset: true,
                    fullState: this.componentStates[componentName]
                }
            });
            document.dispatchEvent(event);

            return true;
        }

        return false;
    }

    initializeComponents() {
        try {
            // Initialize each dropdown component
            this.components.spiral = new SpiralDropdown(this);
            this.components.tts = new TTSDropdown(this);
            this.components.triggers = new TriggersDropdown(this);
            this.components.ai = new AIDropdown(this);
            this.components.collar = new CollarDropdown(this);

            // Initialize brainwave dropdown (functional component)
            this.initializeBrainwaveDropdown();
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
    async openDropdown(dropdown) {
        // Close any other open dropdown
        if (this.activeDropdown && this.activeDropdown !== dropdown) {
            this.closeDropdown(this.activeDropdown);
        }

        const content = dropdown.querySelector('.dropdown-content');
        const button = dropdown.querySelector('.dropdown-btn');

        console.log('🔽 Dropdown opening:', dropdown);

        // Use View Transitions API for smooth animations (progressive enhancement)
        const openAction = () => {
            dropdown.classList.add('active');
            this.activeDropdown = dropdown;

            // Make chat toggle button transparent and unclickable
            const chatToggleBtn = document.getElementById('chat-toggle-button');
            if (chatToggleBtn) {
                chatToggleBtn.classList.add('dropdown-active');
            }

            // Populate dropdown content if needed
            this.populateDropdownContent(dropdown);

            // Enhanced positioning with content measurement
            if (content && button) {
                content.style.viewTransitionName = `dropdown-${dropdown.id || 'content'}`;
                content.offsetHeight; // Force reflow

                const buttonRect = button.getBoundingClientRect();
                const contentRect = content.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                let top = buttonRect.bottom + 4;
                let left = buttonRect.left;

                // Adjust if off-screen
                if (left + contentRect.width > viewportWidth) {
                    left = Math.max(10, viewportWidth - contentRect.width - 10);
                }
                if (top + contentRect.height > viewportHeight) {
                    top = Math.max(10, buttonRect.top - contentRect.height - 4);
                }

                content.style.top = `${top}px`;
                content.style.left = `${left}px`;

                // Use animation controller for smooth dropdown opening
                if (window.animationController) {
                    window.animationController.openDropdown(content);
                } else {
                    // Fallback to direct CSS classes
                    content.classList.add('dropdown-entering');
                    content.classList.remove('dropdown-leaving');
                    setTimeout(() => content.classList.remove('dropdown-entering'), 200);
                }

                // Focus first focusable element
                const firstFocusable = content.querySelector('button, input, select, [tabindex]:not([tabindex="-1"])');
                if (firstFocusable) {
                    setTimeout(() => firstFocusable.focus(), 100);
                }
            }
        };

        // Check for View Transitions API support
        if ('startViewTransition' in document && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            try {
                await document.startViewTransition(openAction).finished;
            } catch (error) {
                openAction();
            }
        } else {
            openAction();
        }
    }

    closeDropdown(dropdown) {
        const content = dropdown.querySelector('.dropdown-content');

        if (content) {
            // Use animation controller for smooth dropdown closing
            if (window.animationController) {
                window.animationController.closeDropdown(content);
                setTimeout(() => {
                    dropdown.classList.remove('active');
                    content.style.viewTransitionName = '';
                }, 200);
            } else {
                // Fallback to direct CSS classes
                content.classList.add('dropdown-leaving');
                content.classList.remove('dropdown-entering');
                setTimeout(() => {
                    dropdown.classList.remove('active');
                    content.classList.remove('dropdown-leaving');
                    content.style.viewTransitionName = '';
                }, 200);
            }
        } else {
            dropdown.classList.remove('active');
        }

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
        const isDropdownButton = e.target.closest('.dropdown-btn');
        const isResizing = e.target.classList.contains('collar-textarea') ||
            (this.components.collar && this.components.collar.isResizing);

        // Don't close if clicking on dropdown button (button handler will manage open/close)
        // Don't close if clicking inside dropdown
        // Don't close if resizing collar textarea
        if (!isInsideDropdown && !isResizing) {
            this.closeAllDropdowns();
        } else if (isInsideDropdown && !isDropdownButton) {
            // Clicking inside dropdown but not on button - keep dropdown open
            // This prevents accidental closes when interacting with dropdown content
        }
    }

    handleKeydown(e) {
        // Enhanced keyboard navigation
        const activeDropdown = document.querySelector('.dropdown.active');

        if (e.key === 'Escape') {
            this.closeAllDropdowns();
            // Return focus to dropdown button
            if (activeDropdown) {
                const button = activeDropdown.querySelector('.dropdown-btn, .dropdown-button');
                if (button) button.focus();
            }
            return;
        }

        if (!activeDropdown) return;

        const items = activeDropdown.querySelectorAll('.dropdown-item, button, input, select');
        const highlightedItem = activeDropdown.querySelector('.highlighted');

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                DropdownUtils.navigateItems(items, highlightedItem, 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                DropdownUtils.navigateItems(items, highlightedItem, -1);
                break;
            case 'Enter':
            case ' ':
                if (highlightedItem && highlightedItem.classList.contains('dropdown-item')) {
                    e.preventDefault();
                    highlightedItem.click();
                }
                break;
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

    // Enhanced utility method exposed to external scripts
    addVisualFeedback(element, type = 'success') {
        DropdownUtils.addVisualFeedback(element, type);
    }
}

// Dropdown animation classes are now handled by CSS files (layers.css, buttons.css)
// This eliminates the need for inline style injection and reduces JavaScript complexity

// Initialize dropdown manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.dropdownManager = new DropdownManager();
        console.log('✅ DropdownManager initialized');
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
