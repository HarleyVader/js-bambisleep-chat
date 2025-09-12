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

    // Get HTML content for the dropdown
    getDropdownContent() {
        return `
            <div class="spiral-controls">
                <!-- Speed Controls -->
                <div class="control-section">
                    <p class="config-label">🚀 Speed Control</p>
                    <a href="#" data-action="spiral-speed-slow">🐌 Slow & Hypnotic</a>
                    <a href="#" data-action="spiral-speed-normal">⚡ Normal Speed</a>
                    <a href="#" data-action="spiral-speed-fast">🌪️ Fast & Intense</a>
                </div>

                <!-- Color Controls -->
                <div class="control-section">
                    <p class="config-label">🎨 Color Schemes</p>
                    <a href="#" data-action="spiral-color-pink">💗 Pink Dreams</a>
                    <a href="#" data-action="spiral-color-purple">💜 Purple Haze</a>
                    <a href="#" data-action="spiral-color-blue">💙 Blue Depth</a>
                    <a href="#" data-action="spiral-color-rainbow">🌈 Rainbow Cycle</a>
                    <a href="#" data-action="spiral-color-cycle">🔄 Randomize Colors</a>
                </div>

                <!-- Geometry Controls -->
                <div class="control-section">
                    <p class="config-label">⚙️ Spiral Geometry</p>
                    <a href="#" data-action="spiral-geometry-tight">🎯 Tight Spirals</a>
                    <a href="#" data-action="spiral-geometry-normal">🌀 Normal Spirals</a>
                    <a href="#" data-action="spiral-geometry-wide">🌊 Wide Spirals</a>
                </div>

                <!-- Preset Controls -->
                <div class="control-section">
                    <p class="config-label">🎭 Effect Presets</p>
                    <a href="#" data-action="spiral-preset-hypnotic">😴 Hypnotic Trance</a>
                    <a href="#" data-action="spiral-preset-intense">🔥 Intense Focus</a>
                    <a href="#" data-action="spiral-preset-peaceful">☮️ Peaceful Flow</a>
                    <a href="#" data-action="spiral-preset-chaos">💫 Chaos Mode</a>
                </div>

                <!-- Alpha/Transparency Controls -->
                <div class="control-section">
                    <p class="config-label">✨ Transparency</p>
                    <a href="#" data-action="spiral-alpha-low">👻 Subtle (30%)</a>
                    <a href="#" data-action="spiral-alpha-medium">🌙 Medium (70%)</a>
                    <a href="#" data-action="spiral-alpha-high">☀️ Solid (100%)</a>
                </div>

                <!-- Randomizer Controls -->
                <div class="control-section">
                    <p class="config-label">🎲 Auto Randomizer</p>
                    <a href="#" data-action="spiral-randomizer-on">🔄 Enable Auto-Change</a>
                    <a href="#" data-action="spiral-randomizer-off">⏸️ Disable Auto-Change</a>
                </div>

                <!-- Special Brainwash Mode -->
                <div class="control-section">
                    <p class="config-label" style="color: var(--button-color); text-shadow: 0 0 10px var(--button-color);">🌀 ULTIMATE CONTROL 🌀</p>
                    <a href="#" data-action="spiral-brainwash-mode" style="color: var(--button-color); text-shadow: 0 0 5px var(--button-color); font-weight: bold; animation: pulse 2s infinite;">🧠 BRAINWASH MODE 🧠</a>
                </div>
            </div>
            
            <style>
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                
                .spiral-controls .control-section:last-child {
                    border-top: 1px solid var(--button-color);
                    margin-top: 10px;
                    padding-top: 10px;
                    background: rgba(255, 20, 147, 0.05);
                    border-radius: var(--border-radius);
                }
            </style>
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
