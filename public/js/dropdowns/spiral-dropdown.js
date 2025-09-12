/**
 * Spiral Dropdown Component for BambiSleep Chat
 * Handles spiral control dropdown functionality
 */

export class SpiralDropdown {
    constructor(dropdownManager) {
        this.dropdownManager = dropdownManager;
        this.buttonId = 'toggle-spiral';
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

    init() {
        console.log('🌀 Initializing Spiral Dropdown...');
        this.setupEventListeners();
        this.setupToggleHandling();
    }

    setupEventListeners() {
        // Listen for dropdown actions specific to spiral
        document.addEventListener('dropdownAction', (e) => {
            const { action, buttonId } = e.detail;
            if (buttonId === this.buttonId) {
                this.handleAction(action, e.detail);
            }
        });
    }

    setupToggleHandling() {
        // Handle spiral button click to toggle dropdown
        const spiralButton = document.getElementById(this.buttonId);
        if (spiralButton) {
            spiralButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = spiralButton.closest('.dropdown');

                if (dropdown.classList.contains('active')) {
                    this.dropdownManager.closeDropdown(dropdown);
                } else {
                    this.dropdownManager.openDropdown(dropdown);
                }
            });
        }
    }

    handleAction(action, detail) {
        const spiralControls = this.getSpiralControls();
        if (!spiralControls) {
            console.warn('⚠️ Spiral controls not available');
            this.dropdownManager.showActionFeedback('SPIRAL', 'SYSTEM NOT AVAILABLE');
            return;
        }

        console.log(`🌀 Spiral action: ${action}`);

        switch (action) {
            // Speed Controls
            case 'spiral-speed-slow':
                spiralControls.setSpeed(0.3);
                this.dropdownManager.showActionFeedback('SPIRAL', 'SLOW & HYPNOTIC');
                break;
            case 'spiral-speed-normal':
                spiralControls.setSpeed(1.0);
                this.dropdownManager.showActionFeedback('SPIRAL', 'NORMAL SPEED');
                break;
            case 'spiral-speed-fast':
                spiralControls.setSpeed(2.0);
                this.dropdownManager.showActionFeedback('SPIRAL', 'FAST & INTENSE');
                break;

            // Color Controls
            case 'spiral-color-pink':
                spiralControls.setColorScheme('pink');
                this.dropdownManager.showActionFeedback('SPIRAL', 'PINK DREAMS');
                break;
            case 'spiral-color-purple':
                spiralControls.setColorScheme('purple');
                this.dropdownManager.showActionFeedback('SPIRAL', 'PURPLE HAZE');
                break;
            case 'spiral-color-blue':
                spiralControls.setColorScheme('blue');
                this.dropdownManager.showActionFeedback('SPIRAL', 'BLUE DEPTH');
                break;
            case 'spiral-color-rainbow':
                spiralControls.setColorScheme('rainbow');
                this.dropdownManager.showActionFeedback('SPIRAL', 'RAINBOW CYCLE');
                break;
            case 'spiral-color-cycle':
                spiralControls.randomizeColors();
                this.dropdownManager.showActionFeedback('SPIRAL', 'COLORS RANDOMIZED');
                break;

            // Geometry Controls
            case 'spiral-geometry-tight':
                spiralControls.setGeometry('tight');
                this.dropdownManager.showActionFeedback('SPIRAL', 'TIGHT SPIRALS');
                break;
            case 'spiral-geometry-normal':
                spiralControls.setGeometry('normal');
                this.dropdownManager.showActionFeedback('SPIRAL', 'NORMAL SPIRALS');
                break;
            case 'spiral-geometry-wide':
                spiralControls.setGeometry('wide');
                this.dropdownManager.showActionFeedback('SPIRAL', 'WIDE SPIRALS');
                break;

            // Preset Controls
            case 'spiral-preset-hypnotic':
                spiralControls.loadPreset('hypnotic');
                this.dropdownManager.showActionFeedback('SPIRAL', 'HYPNOTIC TRANCE');
                break;
            case 'spiral-preset-intense':
                spiralControls.loadPreset('intense');
                this.dropdownManager.showActionFeedback('SPIRAL', 'INTENSE FOCUS');
                break;
            case 'spiral-preset-peaceful':
                spiralControls.loadPreset('peaceful');
                this.dropdownManager.showActionFeedback('SPIRAL', 'PEACEFUL FLOW');
                break;
            case 'spiral-preset-chaos':
                spiralControls.loadPreset('chaos');
                this.dropdownManager.showActionFeedback('SPIRAL', 'CHAOS MODE');
                break;

            // Alpha/Transparency Controls
            case 'spiral-alpha-low':
                spiralControls.setAlpha(0.3);
                this.dropdownManager.showActionFeedback('SPIRAL', 'SUBTLE (30%)');
                break;
            case 'spiral-alpha-medium':
                spiralControls.setAlpha(0.7);
                this.dropdownManager.showActionFeedback('SPIRAL', 'MEDIUM (70%)');
                break;
            case 'spiral-alpha-high':
                spiralControls.setAlpha(1.0);
                this.dropdownManager.showActionFeedback('SPIRAL', 'SOLID (100%)');
                break;

            // Randomizer Controls
            case 'spiral-randomizer-on':
                spiralControls.enableRandomizer(true);
                this.dropdownManager.showActionFeedback('SPIRAL', 'AUTO-CHANGE ON');
                break;
            case 'spiral-randomizer-off':
                spiralControls.enableRandomizer(false);
                this.dropdownManager.showActionFeedback('SPIRAL', 'AUTO-CHANGE OFF');
                break;

            // Special Brainwash Mode
            case 'spiral-brainwash-mode':
                spiralControls.activateBrainwashMode();
                this.dropdownManager.showActionFeedback('SPIRAL', '🧠 BRAINWASH ACTIVATED 🧠');
                break;

            default:
                console.warn(`Unknown spiral action: ${action}`);
        }

        // Dispatch spiral control change event
        const event = new CustomEvent('spiralControlChange', {
            detail: {
                category: 'spiral',
                property: action,
                value: detail.selectedText
            }
        });
        document.dispatchEvent(event);
    }

    toggleState(btn) {
        const currentState = btn.getAttribute('data-state');
        const newState = currentState === 'off' ? 'on' : 'off';

        btn.setAttribute('data-state', newState);
        btn.textContent = `Spiral: ${newState.toUpperCase()}`;

        // Enable/disable spiral animation
        if (window.spiralAnimation) {
            const isEnabled = window.spiralAnimation.toggle();
            // Update button state to match actual spiral state
            const actualState = isEnabled ? 'on' : 'off';
            btn.setAttribute('data-state', actualState);
            btn.textContent = `Spiral: ${actualState.toUpperCase()}`;
        } else {
            console.warn('⚠️ Spiral animation not available');
        }

        // Dispatch toggle event
        const event = new CustomEvent('toggleStateChange', {
            detail: {
                buttonId: this.buttonId,
                state: newState,
                buttonName: 'SPIRAL'
            }
        });
        document.dispatchEvent(event);

        this.dropdownManager.showToggleFeedback('SPIRAL', newState);
    }

    handleSpiralClick(button, action) {
        // Toggle active state for visual feedback (like other dropdowns)
        button.classList.toggle('active');

        // Execute the spiral action
        this.handleAction(action, { 
            selectedText: button.textContent,
            element: button 
        });

        // For single-selection categories, remove active from siblings
        const category = this.getSpiralCategory(action);
        if (this.isSingleSelectionCategory(category)) {
            const siblings = button.parentElement.querySelectorAll('.spiral-button');
            siblings.forEach(sibling => {
                if (sibling !== button) {
                    sibling.classList.remove('active');
                }
            });
        }
    }

    getSpiralCategory(action) {
        if (action.includes('speed')) return 'speed';
        if (action.includes('geometry')) return 'geometry';
        if (action.includes('alpha')) return 'alpha';
        if (action.includes('preset')) return 'preset';
        if (action.includes('randomizer')) return 'randomizer';
        return 'other';
    }

    isSingleSelectionCategory(category) {
        // These categories should only have one active selection at a time
        return ['speed', 'geometry', 'alpha', 'preset'].includes(category);
    }

    // Get HTML content for the dropdown
    getDropdownContent() {
        return `
            <div class="spiral-controls">
                <!-- Speed Controls -->
                <div class="control-section">
                    <p class="config-label">🚀 Speed Control</p>
                    <div class="spiral-buttons">
                        <button class="spiral-button" data-action="spiral-speed-slow" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-speed-slow')">🐌 Slow & Hypnotic</button>
                        <button class="spiral-button" data-action="spiral-speed-normal" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-speed-normal')">⚡ Normal Speed</button>
                        <button class="spiral-button" data-action="spiral-speed-fast" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-speed-fast')">🌪️ Fast & Intense</button>
                    </div>
                </div>

                <!-- Color Controls -->
                <div class="control-section">
                    <p class="config-label">🎨 Color Schemes</p>
                    <div class="spiral-buttons">
                        <button class="spiral-button" data-action="spiral-color-pink" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-color-pink')">💗 Pink Dreams</button>
                        <button class="spiral-button" data-action="spiral-color-purple" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-color-purple')">💜 Purple Haze</button>
                        <button class="spiral-button" data-action="spiral-color-blue" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-color-blue')">💙 Blue Depth</button>
                        <button class="spiral-button" data-action="spiral-color-rainbow" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-color-rainbow')">🌈 Rainbow Cycle</button>
                        <button class="spiral-button" data-action="spiral-color-cycle" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-color-cycle')">🔄 Randomize Colors</button>
                    </div>
                </div>

                <!-- Geometry Controls -->
                <div class="control-section">
                    <p class="config-label">⚙️ Spiral Geometry</p>
                    <div class="spiral-buttons">
                        <button class="spiral-button" data-action="spiral-geometry-tight" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-geometry-tight')">🎯 Tight Spirals</button>
                        <button class="spiral-button" data-action="spiral-geometry-normal" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-geometry-normal')">🌀 Normal Spirals</button>
                        <button class="spiral-button" data-action="spiral-geometry-wide" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-geometry-wide')">🌊 Wide Spirals</button>
                    </div>
                </div>

                <!-- Preset Controls -->
                <div class="control-section">
                    <p class="config-label">🎭 Effect Presets</p>
                    <div class="spiral-buttons">
                        <button class="spiral-button" data-action="spiral-preset-hypnotic" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-preset-hypnotic')">😴 Hypnotic Trance</button>
                        <button class="spiral-button" data-action="spiral-preset-intense" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-preset-intense')">🔥 Intense Focus</button>
                        <button class="spiral-button" data-action="spiral-preset-peaceful" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-preset-peaceful')">☮️ Peaceful Flow</button>
                        <button class="spiral-button" data-action="spiral-preset-chaos" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-preset-chaos')">💫 Chaos Mode</button>
                    </div>
                </div>

                <!-- Alpha/Transparency Controls -->
                <div class="control-section">
                    <p class="config-label">✨ Transparency</p>
                    <div class="spiral-buttons">
                        <button class="spiral-button" data-action="spiral-alpha-low" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-alpha-low')">👻 Subtle (30%)</button>
                        <button class="spiral-button" data-action="spiral-alpha-medium" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-alpha-medium')">🌙 Medium (70%)</button>
                        <button class="spiral-button" data-action="spiral-alpha-high" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-alpha-high')">☀️ Solid (100%)</button>
                    </div>
                </div>

                <!-- Randomizer Controls -->
                <div class="control-section">
                    <p class="config-label">🎲 Auto Randomizer</p>
                    <div class="spiral-buttons">
                        <button class="spiral-button" data-action="spiral-randomizer-on" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-randomizer-on')">🔄 Enable Auto-Change</button>
                        <button class="spiral-button" data-action="spiral-randomizer-off" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-randomizer-off')">⏸️ Disable Auto-Change</button>
                    </div>
                </div>

                <!-- Special Brainwash Mode -->
                <div class="control-section">
                    <p class="config-label" style="color: var(--button-color); text-shadow: 0 0 10px var(--button-color);">🌀 ULTIMATE CONTROL 🌀</p>
                    <div class="spiral-buttons">
                        <button class="spiral-button brainwash-button" data-action="spiral-brainwash-mode" onclick="window.dropdownManager.getComponent('spiral').handleSpiralClick(this, 'spiral-brainwash-mode')" style="color: var(--button-color); text-shadow: 0 0 5px var(--button-color); font-weight: bold; animation: pulse 2s infinite;">🧠 BRAINWASH MODE 🧠</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Debug function for testing spiral controls
    test() {
        console.log('🧪 Testing spiral controls...');

        const spiralControls = this.getSpiralControls();
        if (!spiralControls) {
            console.error('❌ Spiral controls not available');
            return false;
        }

        console.log('✅ Spiral controls available! Testing functions...');

        // Test color change
        try {
            spiralControls.setColorScheme('pink');
            console.log('✓ Color change test passed');
        } catch (e) {
            console.error('✗ Color change test failed:', e);
        }

        // Test speed change
        try {
            spiralControls.setSpeed(1.5);
            console.log('✓ Speed change test passed');
        } catch (e) {
            console.error('✗ Speed change test failed:', e);
        }

        // Test preset loading
        try {
            spiralControls.loadPreset('hypnotic');
            console.log('✓ Preset loading test passed');
        } catch (e) {
            console.error('✗ Preset loading test failed:', e);
        }

        console.log('🧪 Spiral controls test complete');
        return true;
    }
}
