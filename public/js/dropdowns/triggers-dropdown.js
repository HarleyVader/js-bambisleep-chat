/**
 * Triggers Dropdown Component for BambiSleep Chat
 * Handles trigger system dropdown functionality
 */

export class TriggersDropdown {
    constructor(dropdownManager) {
        this.dropdownManager = dropdownManager;
        this.buttonId = 'toggle-triggers';
        this.triggersData = null;
        this.init();
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
        console.log('🎯 Initializing Triggers Dropdown...');
        this.setupEventListeners();
        this.setupToggleHandling();
        // Load trigger data immediately during init
        this.loadTriggerCategories();
    }

    setupEventListeners() {
        // Listen for dropdown actions specific to triggers
        document.addEventListener('dropdownAction', (e) => {
            const { action, buttonId } = e.detail;
            if (buttonId === this.buttonId) {
                this.handleAction(action, e.detail);
            }
        });

        // Listen for trigger selection events
        document.addEventListener('triggerSelection', (e) => {
            this.handleTriggerSelection(e.detail);
        });

        // Event delegation for trigger buttons to avoid inline onclick issues
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('trigger-button') && e.target.dataset.triggerName) {
                e.preventDefault();
                this.handleTriggerClick(e.target, e.target.dataset.triggerName);
            } else if (e.target.classList.contains('retry-button') && e.target.dataset.action === 'retry-triggers') {
                e.preventDefault();
                this.loadTriggerCategories();
            }
        });
    }

    setupToggleHandling() {
        // Handle triggers button click to toggle dropdown
        const triggersButton = document.getElementById(this.buttonId);
        if (triggersButton) {
            triggersButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = triggersButton.closest('.dropdown');

                if (dropdown.classList.contains('active')) {
                    this.dropdownManager.closeDropdown(dropdown);
                } else {
                    this.dropdownManager.openDropdown(dropdown);
                }
            });
        }
    }

    async loadTriggerCategories() {
        try {
            console.log('📥 Loading trigger categories...');
            const response = await fetch('/api/triggers/json');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.triggersData = await response.json();
            console.log('✅ Trigger categories loaded:', this.triggersData);

        } catch (error) {
            console.error('❌ Failed to load trigger categories:', error);
            this.loadError = error.message;
        }
    }

    handleAction(action, detail) {
        console.log(`🎯 Triggers action: ${action}`);

        switch (action) {
            case 'triggers-enable-all':
                this.enableAllTriggers();
                break;
            case 'triggers-disable-all':
                this.disableAllTriggers();
                break;
            case 'triggers-toggle-category':
                this.toggleCategory(detail.category);
                break;
            case 'triggers-reload':
                // Clear existing data and force reload
                this.triggersData = null;
                this.loadError = null;
                this.loadTriggerCategories().then(() => {
                    // Find the current dropdown and refresh its content
                    const currentDropdown = document.querySelector('#toggle-triggers').closest('.dropdown');
                    if (currentDropdown && currentDropdown.classList.contains('active')) {
                        const contentContainer = currentDropdown.querySelector('.dropdown-content');
                        if (contentContainer) {
                            contentContainer.innerHTML = this.getDropdownContent();
                            this.dropdownManager.attachContentEventListeners(contentContainer);
                        }
                    }
                });
                break;
            case 'retry-triggers':
                this.loadTriggerCategories();
                this.dropdownManager.showActionFeedback('TRIGGERS', 'RELOADING...');
                break;
            default:
                console.warn(`Unknown triggers action: ${action}`);
        }
    }

    handleTriggerSelection(detail) {
        const { trigger, active, category, safety } = detail;
        console.log(`🎯 Trigger ${active ? 'activated' : 'deactivated'}: ${trigger} (${category}, ${safety})`);

        // Show feedback
        this.dropdownManager.showActionFeedback('TRIGGER', `${trigger}: ${active ? 'ON' : 'OFF'}`);
    }

    toggleState(btn) {
        const currentState = btn.getAttribute('data-state');
        const newState = currentState === 'off' ? 'on' : 'off';

        btn.setAttribute('data-state', newState);
        btn.textContent = `Triggers: ${newState.toUpperCase()}`;

        // Enable/disable trigger system
        const triggerSystem = this.getTriggerSystem();
        if (triggerSystem) {
            // Check current state and toggle if needed
            const currentSystemState = triggerSystem.isEnabled;
            const targetState = newState === 'on';

            if (currentSystemState !== targetState) {
                triggerSystem.toggle();
            }
        } else {
            console.warn('⚠️ Trigger system not available, scheduling for later initialization');
            setTimeout(() => {
                const delayedTriggerSystem = this.getTriggerSystem();
                if (delayedTriggerSystem) {
                    const currentSystemState = delayedTriggerSystem.isEnabled;
                    const targetState = newState === 'on';

                    if (currentSystemState !== targetState) {
                        delayedTriggerSystem.toggle();
                    }
                }
            }, 1000);
        }

        // Dispatch toggle event
        const event = new CustomEvent('triggerSystemToggle', {
            detail: {
                enabled: newState === 'on'
            }
        });
        document.dispatchEvent(event);

        this.dropdownManager.showToggleFeedback('TRIGGERS', newState);
    }

    showFeedback(message) {
        // Create floating feedback notification (standardized like other dropdowns)
        const feedback = document.createElement('div');
        feedback.className = 'triggers-feedback';
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

    enableAllTriggers() {
        const buttons = document.querySelectorAll('.trigger-button');
        buttons.forEach(button => {
            if (!button.classList.contains('active')) {
                button.click();
            }
        });
        this.dropdownManager.showActionFeedback('TRIGGERS', 'ALL ENABLED');
    }

    disableAllTriggers() {
        const buttons = document.querySelectorAll('.trigger-button');
        buttons.forEach(button => {
            if (button.classList.contains('active')) {
                button.click();
            }
        });
        this.dropdownManager.showActionFeedback('TRIGGERS', 'ALL DISABLED');
    }

    toggleCategory(categoryName) {
        const categoryDiv = Array.from(document.querySelectorAll('.trigger-category'))
            .find(div => div.querySelector('.category-header').textContent === categoryName.toUpperCase());

        if (categoryDiv) {
            const buttons = categoryDiv.querySelectorAll('.trigger-button');
            const firstButton = buttons[0];
            const shouldActivate = !firstButton.classList.contains('active');

            buttons.forEach(button => {
                if (shouldActivate && !button.classList.contains('active')) {
                    button.click();
                } else if (!shouldActivate && button.classList.contains('active')) {
                    button.click();
                }
            });

            this.dropdownManager.showActionFeedback('TRIGGERS', `${categoryName.toUpperCase()}: ${shouldActivate ? 'ON' : 'OFF'}`);
        }
    }

    // Get HTML content for the dropdown
    getDropdownContent() {
        // If there was an error loading
        if (this.loadError) {
            return `
                <div id="trigger-categories-dropdown" class="trigger-categories">
                    <div class="category-error">
                        <p>❌ Failed to load triggers: ${this.loadError}</p>
                        <button class="retry-button" data-action="retry-triggers">🔄 Retry</button>
                    </div>
                </div>
                <div class="control-section">
                    <p class="config-label">🎯 Bulk Actions</p>
                    <a href="#" data-action="triggers-reload">🔄 Reload Triggers</a>
                </div>
            `;
        }

        // If no data yet, return basic controls only
        if (!this.triggersData) {
            return `
                <div id="trigger-categories-dropdown" class="trigger-categories">
                    <div class="category-placeholder">⚡ Ready for triggers...</div>
                </div>
                <div class="control-section">
                    <p class="config-label">🎯 Bulk Actions</p>
                    <a href="#" data-action="triggers-enable-all">✅ Enable All</a>
                    <a href="#" data-action="triggers-disable-all">❌ Disable All</a>
                    <a href="#" data-action="triggers-reload">🔄 Reload Triggers</a>
                </div>
            `;
        }

        // Generate content with loaded data
        return this.generateTriggersContent();
    }

    generateTriggersContent() {
        if (!this.triggersData) return '';

        let content = '<div id="trigger-categories-dropdown" class="trigger-categories">';

        // Group triggers by category
        const categories = {};
        this.triggersData.triggers.forEach(trigger => {
            const category = trigger.category || 'General';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(trigger);
        });

        // Create category sections
        Object.keys(categories).forEach(categoryName => {
            content += `
                <div class="trigger-category">
                    <div class="category-header">${categoryName.toUpperCase()}</div>
                    <div class="trigger-buttons">
            `;

            categories[categoryName].forEach(trigger => {
                content += `
                    <button class="trigger-button"
                            data-category="${trigger.category || 'default'}"
                            data-safety="${trigger.safetyLevel || 'safe'}"
                            data-trigger-name="${trigger.name}">
                        ${trigger.name}
                    </button>
                `;
            });

            content += `
                    </div>
                </div>
            `;
        });

        content += `
            </div>
            <div class="control-section">
                <p class="config-label">🎯 Bulk Actions</p>
                <a href="#" data-action="triggers-enable-all">✅ Enable All</a>
                <a href="#" data-action="triggers-disable-all">❌ Disable All</a>
                <a href="#" data-action="triggers-reload">🔄 Reload Triggers</a>
            </div>
        `;

        return content;
    }

    handleTriggerClick(button, triggerName) {
        button.classList.toggle('active');

        // Dispatch trigger selection event
        const event = new CustomEvent('triggerSelection', {
            detail: {
                trigger: triggerName,
                active: button.classList.contains('active'),
                category: button.getAttribute('data-category'),
                safety: button.getAttribute('data-safety')
            }
        });
        document.dispatchEvent(event);

        // Update active triggers in chatCore if available
        if (window.chatCore) {
            const triggerNameUpper = triggerName.toUpperCase();
            if (button.classList.contains('active')) {
                if (!window.chatCore.activeTriggers.includes(triggerNameUpper)) {
                    window.chatCore.activeTriggers.push(triggerNameUpper);
                }
            } else {
                const index = window.chatCore.activeTriggers.indexOf(triggerNameUpper);
                if (index > -1) {
                    window.chatCore.activeTriggers.splice(index, 1);
                }
            }
            window.chatCore.updateTriggers();
            console.log('🎯 Updated active triggers:', window.chatCore.activeTriggers);
        }
    }
}
