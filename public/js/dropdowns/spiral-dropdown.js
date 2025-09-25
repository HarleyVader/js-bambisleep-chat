/**
 * Spiral Dropdown Component for BambiSleep Chat
 * Handles spiral control dropdown with sliders and local storage
 */

export class SpiralDropdown {
    constructor(dropdownManager) {
        this.dropdownManager = dropdownManager;
        this.buttonId = 'toggle-spiral';

        // FINE-GRAIN Slider settings with ultra-responsive ranges and micro-steps
        this.sliderSettings = {
            speed: { min: 0.01, max: 5.0, default: 1.0, step: 0.01 },
            spiralA_color: { type: 'color', default: '#df0471' },  // Hot pink default
            spiralB_color: { type: 'color', default: '#00ffff' },  // Cyan default
            geometryA: { min: 0.01, max: 10.0, default: 1.0, step: 0.01 },
            geometryB: { min: 0.01, max: 5.0, default: 0.3, step: 0.01 },
            subtleVariation: { min: 0.0, max: 1.0, default: 0.0, step: 0.001 },
            alpha: { min: 0.01, max: 1.0, default: 1.0, step: 0.001 },
            pulseIntensity: { min: 1, max: 200, default: 30, step: 1 },
            rotationSpeed: { min: 0.1, max: 50.0, default: 10.0, step: 0.1 },
            iterations: { min: 50, max: 1000, default: 250, step: 1 },
            rangeA_min: { min: 0.01, max: 2.0, default: 0.5, step: 0.01 },
            rangeA_max: { min: 0.5, max: 5.0, default: 1.5, step: 0.01 },
            rangeB_min: { min: 0.01, max: 2.0, default: 1.0, step: 0.01 },
            rangeB_max: { min: 0.5, max: 5.0, default: 1.5, step: 0.01 }
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

    init() {
        console.log('🌀 Initializing Spiral Dropdown with Sliders...');
        const savedSettings = this.loadSettings();

        // If no saved settings or settings are incomplete, initialize with defaults
        if (Object.keys(savedSettings).length === 0) {
            console.log('🔧 No saved settings found, initializing with defaults');
            this.initializeDefaults();
        }

        this.setupEventListeners();
        this.setupToggleHandling();
    }

    initializeDefaults() {
        // Initialize all sliders with default values
        setTimeout(() => {
            Object.keys(this.sliderSettings).forEach(key => {
                const slider = document.getElementById(`spiral-${key}-slider`);
                const config = this.sliderSettings[key];

                if (slider && config && config.default !== undefined) {
                    slider.value = config.default;
                    this.updateSliderValue(key, config.default);
                }
            });
        }, 100);
    }

    // Local Storage Functions
    saveSettings() {
        const settings = {};
        Object.keys(this.sliderSettings).forEach(key => {
            const slider = document.getElementById(`spiral-${key}-slider`);
            if (slider) {
                const config = this.sliderSettings[key];
                if (config && config.type === 'color') {
                    // Validate and store color as hex string
                    const colorValue = slider.value;
                    if (colorValue && colorValue.match(/^#[0-9A-F]{6}$/i)) {
                        settings[key] = colorValue; // Valid hex color
                    } else {
                        settings[key] = config.default; // Fallback to default if invalid
                    }
                } else {
                    // Validate and store numeric values
                    const numericValue = parseFloat(slider.value);
                    if (!isNaN(numericValue)) {
                        settings[key] = numericValue; // Valid number
                    } else {
                        settings[key] = config.default; // Fallback to default if invalid
                    }
                }
            }
        });

        localStorage.setItem('spiralSettings', JSON.stringify(settings));
        console.log('💾 Spiral settings saved:', settings);
    }

    loadSettings() {
        const saved = localStorage.getItem('spiralSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                console.log('📥 Loading spiral settings:', settings);

                // Apply settings after DOM is ready
                setTimeout(() => {
                    this.applyLoadedSettings(settings);
                }, 100);

                return settings;
            } catch (e) {
                console.warn('⚠️ Failed to load spiral settings:', e);
            }
        }
        return {};
    }

    applyLoadedSettings(settings) {
        // Process all expected slider settings, applying saved values or defaults
        Object.keys(this.sliderSettings).forEach(key => {
            const slider = document.getElementById(`spiral-${key}-slider`);
            const sliderConfig = this.sliderSettings[key];

            if (slider && sliderConfig) {
                let value = settings[key];

                // Use saved value if it exists and is valid, otherwise use default
                if (value === null || value === undefined ||
                    (sliderConfig.type === 'color' && (!value || value === '' || !value.match(/^#[0-9A-F]{6}$/i)))) {
                    value = sliderConfig.default;
                }

                slider.value = value;
                this.updateSliderValue(key, value);
            }
        });
    }

    setupEventListeners() {
        // Listen for dropdown actions specific to spiral
        document.addEventListener('dropdownAction', (e) => {
            const { action, buttonId } = e.detail;
            if (buttonId === this.buttonId) {
                this.handleAction(action, e.detail);
            }
        });

        // Auto-save on slider changes with debouncing for ultra-responsive feedback
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('spiral-slider') || e.target.classList.contains('spiral-color-picker')) {
                this.handleSliderChange(e.target);
                // Debounced saving - immediate visual update, delayed storage save
                clearTimeout(this.saveTimeout);
                this.saveTimeout = setTimeout(() => {
                    this.saveSettings();
                }, 100); // Save 100ms after last change
            }
        });

        // Real-time feedback on slider movement (before releasing)
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('spiral-slider') || e.target.classList.contains('spiral-color-picker')) {
                // Immediate visual feedback
                const key = e.target.id.replace('spiral-', '').replace('-slider', '');
                const settings = this.sliderSettings[key];

                let value;
                if (settings && settings.type === 'color') {
                    value = e.target.value;
                } else {
                    value = parseFloat(e.target.value);
                }

                this.updateSliderValue(key, value);
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

    handleSliderChange(slider) {
        const key = slider.id.replace('spiral-', '').replace('-slider', '');
        const settings = this.sliderSettings[key];

        let value;
        if (settings && settings.type === 'color') {
            value = slider.value;
        } else {
            value = parseFloat(slider.value);
        }

        this.updateSliderValue(key, value);
        this.applySliderChange(key, value);
    }

    updateSliderValue(key, value) {
        const valueDisplay = document.getElementById(`spiral-${key}-value`);
        if (valueDisplay) {
            const settings = this.sliderSettings[key];
            if (settings && settings.type === 'color') {
                // Handle null/undefined color values by using default
                const colorValue = value && typeof value === 'string' && value.length > 0
                    ? value
                    : settings.default;
                valueDisplay.textContent = colorValue.toUpperCase();
                valueDisplay.style.color = colorValue;
            } else if (key === 'subtleVariation') {
                valueDisplay.textContent = value === 0 ? 'OFF' : `${(value * 100).toFixed(0)}%`;
            } else if (key === 'alpha') {
                valueDisplay.textContent = `${(value * 100).toFixed(0)}%`;
            } else {
                valueDisplay.textContent = value.toFixed(1);
            }
        }
    }

    adjustSlider(key, direction) {
        const slider = document.getElementById(`spiral-${key}-slider`);
        const settings = this.sliderSettings[key];

        if (!slider || !settings) return;

        const currentValue = parseFloat(slider.value);
        const step = settings.step || 0.01;
        const adjustment = step * direction;
        let newValue = currentValue + adjustment;

        // Clamp to min/max bounds
        if (settings.min !== undefined) {
            newValue = Math.max(settings.min, newValue);
        }
        if (settings.max !== undefined) {
            newValue = Math.min(settings.max, newValue);
        }

        // Round to avoid floating point precision issues
        newValue = Math.round(newValue / step) * step;

        slider.value = newValue;
        this.updateSliderValue(key, newValue);
        this.applySliderChange(key, newValue);
    }

    applySliderChange(key, value) {
        const spiralControls = this.getSpiralControls();
        if (!spiralControls) return;

        const animation = window.spiralAnimation;
        if (!animation) return;

        // ULTRA-RESPONSIVE direct control updates
        switch (key) {
            case 'speed':
                spiralControls.setSpeed(value);
                break;

            case 'spiralA_color':
                const rgbA = this.hexToRgb(value);
                animation.controls.spiralA_color[0] = rgbA.r;
                animation.controls.spiralA_color[1] = rgbA.g;
                animation.controls.spiralA_color[2] = rgbA.b;
                break;

            case 'spiralB_color':
                const rgbB = this.hexToRgb(value);
                animation.controls.spiralB_color[0] = rgbB.r;
                animation.controls.spiralB_color[1] = rgbB.g;
                animation.controls.spiralB_color[2] = rgbB.b;
                break;

            case 'geometryA':
                animation.controls.spiralA_geometry = value;
                break;

            case 'geometryB':
                animation.controls.spiralB_geometry = value;
                break;

            case 'subtleVariation':
                if (value === 0) {
                    spiralControls.disableSubtleVariation();
                } else {
                    spiralControls.enableSubtleVariation(value);
                }
                break;

            case 'alpha':
                animation.controls.spiralA_color[3] = value;
                animation.controls.spiralB_color[3] = value;
                break;

            case 'pulseIntensity':
                animation.controls.pulseIntensity = value;
                break;

            // NEW fine-grain controls
            case 'rotationSpeed':
                animation.controls.rotationSpeed = value;
                break;

            case 'iterations':
                animation.controls.iterations = Math.floor(value);
                break;

            case 'rangeA_min':
                animation.controls.spiralA_range_min = value;
                break;

            case 'rangeA_max':
                animation.controls.spiralA_range_max = value;
                break;

            case 'rangeB_min':
                animation.controls.spiralB_range_min = value;
                break;

            case 'rangeB_max':
                animation.controls.spiralB_range_max = value;
                break;
        }

        // Dispatch real-time change event for other components
        const event = new CustomEvent('spiralRealtimeChange', {
            detail: { key, value, timestamp: Date.now() }
        });
        document.dispatchEvent(event);
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
            // Preset Controls (still using buttons)
            case 'spiral-preset-original':
                this.resetToOriginal();
                this.dropdownManager.showActionFeedback('SPIRAL', 'ORIGINAL RESTORED');
                break;
            case 'spiral-preset-hypnotic':
                this.applyPreset('hypnotic');
                this.dropdownManager.showActionFeedback('SPIRAL', 'HYPNOTIC PRESET');
                break;
            case 'spiral-preset-intense':
                this.applyPreset('intense');
                this.dropdownManager.showActionFeedback('SPIRAL', 'INTENSE PRESET');
                break;
            case 'spiral-preset-peaceful':
                this.applyPreset('peaceful');
                this.dropdownManager.showActionFeedback('SPIRAL', 'PEACEFUL PRESET');
                break;

            default:
                console.warn(`Unknown spiral action: ${action}`);
        }

        // Save settings after any preset change
        this.saveSettings();
    }

    // Preset methods with FINE-GRAIN control values
    resetToOriginal() {
        const presets = {
            speed: 1.0,
            colorIntensity: 1.0,
            geometryA: 1.0,
            geometryB: 0.3,
            subtleVariation: 0.0,
            alpha: 1.0,
            pulseIntensity: 30,
            rotationSpeed: 10.0,
            iterations: 250,
            rangeA_min: 0.5,
            rangeA_max: 1.5,
            rangeB_min: 1.0,
            rangeB_max: 1.5
        };
        this.applyPresetValues(presets);
    }

    applyPreset(presetName) {
        const presets = {
            hypnotic: {
                speed: 0.35,
                colorIntensity: 0.85,
                geometryA: 3.25,
                geometryB: 1.85,
                subtleVariation: 0.12,
                alpha: 0.88,
                pulseIntensity: 42,
                rotationSpeed: 6.5,
                iterations: 350,
                rangeA_min: 0.25,
                rangeA_max: 2.15,
                rangeB_min: 0.75,
                rangeB_max: 2.25
            },
            intense: {
                speed: 2.25,
                colorIntensity: 1.65,
                geometryA: 4.85,
                geometryB: 2.35,
                subtleVariation: 0.28,
                alpha: 1.0,
                pulseIntensity: 75,
                rotationSpeed: 3.2,
                iterations: 600,
                rangeA_min: 1.25,
                rangeA_max: 3.85,
                rangeB_min: 1.85,
                rangeB_max: 4.25
            },
            peaceful: {
                speed: 0.55,
                colorIntensity: 0.65,
                geometryA: 2.15,
                geometryB: 0.85,
                subtleVariation: 0.06,
                alpha: 0.72,
                pulseIntensity: 18,
                rotationSpeed: 18.5,
                iterations: 180,
                rangeA_min: 0.15,
                rangeA_max: 0.95,
                rangeB_min: 0.35,
                rangeB_max: 1.45
            }
        };

        if (presets[presetName]) {
            this.applyPresetValues(presets[presetName]);
        }
    }

    applyPresetValues(values) {
        Object.keys(values).forEach(key => {
            const slider = document.getElementById(`spiral-${key}-slider`);
            if (slider) {
                slider.value = values[key];
                this.updateSliderValue(key, values[key]);
                this.applySliderChange(key, values[key]);
            }
        });
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

            // Load settings if turning on
            if (isEnabled) {
                setTimeout(() => {
                    const savedSettings = this.loadSettings();
                    if (Object.keys(savedSettings).length > 0) {
                        this.applyLoadedSettings(savedSettings);
                    }
                }, 100);
            }
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

    createSlider(key, label, emoji) {
        const settings = this.sliderSettings[key];

        // Handle color inputs differently
        if (settings && settings.type === 'color') {
            return this.createColorPicker(key, label, emoji, settings);
        }

        // Regular slider code
        const currentValue = settings.default;

        return `
            <div class="slider-control">
                <label class="slider-label">
                    ${emoji} ${label}
                    <span class="slider-value" id="spiral-${key}-value">${this.formatSliderValue(key, currentValue)}</span>
                </label>
                <div class="slider-with-buttons">
                    <button class="slider-adjust-btn" onclick="window.dropdownManager.getComponent('spiral').adjustSlider('${key}', -1)">−</button>
                    <input
                        type="range"
                        id="spiral-${key}-slider"
                        class="spiral-slider"
                        min="${settings.min}"
                        max="${settings.max}"
                        step="${settings.step}"
                        value="${currentValue}"
                    />
                    <button class="slider-adjust-btn" onclick="window.dropdownManager.getComponent('spiral').adjustSlider('${key}', 1)">+</button>
                </div>
            </div>
        `;
    }

    createColorPicker(key, label, emoji, settings) {
        const currentValue = settings.default;

        return `
            <div class="slider-control color-control">
                <label class="slider-label">
                    ${emoji} ${label}
                    <span class="slider-value color-value" id="spiral-${key}-value" style="color: ${currentValue}">${currentValue.toUpperCase()}</span>
                </label>
                <div class="color-picker-container">
                    <input
                        type="color"
                        id="spiral-${key}-slider"
                        class="spiral-color-picker"
                        value="${currentValue}"
                        onchange="window.dropdownManager.getComponent('spiral').handleSliderChange(this)"
                    />
                </div>
            </div>
        `;
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 223, g: 4, b: 113 }; // Default hot pink
    }

    formatSliderValue(key, value) {
        const settings = this.sliderSettings[key];
        if (settings && settings.type === 'color') {
            return value.toUpperCase();
        }

        // HIGH-PRECISION value formatting for fine-grain feedback
        switch (key) {
            case 'subtleVariation':
                return value === 0 ? 'OFF' : `${(value * 100).toFixed(1)}%`;
            case 'alpha':
                return `${(value * 100).toFixed(1)}%`;
            case 'speed':
                if (value < 0.1) return `${(value * 1000).toFixed(0)}ms`;
                return `${value.toFixed(2)}x`;
            case 'geometryA':
            case 'geometryB':
            case 'rangeA_min':
            case 'rangeA_max':
            case 'rangeB_min':
            case 'rangeB_max':
                return value.toFixed(2);
            case 'rotationSpeed':
                return `${value.toFixed(1)}°/s`;
            case 'iterations':
                return `${Math.floor(value)} pts`;
            case 'pulseIntensity':
                return `${Math.floor(value)}`;
            default:
                return value.toFixed(2);
        }
    }

    // Get HTML content for the dropdown
    getDropdownContent() {
        return `
            <div class="spiral-controls">
                <!-- Sliders Section -->
                <div class="control-section">
                    <p class="config-label">🎛️ Spiral Controls</p>
                    <div class="sliders-container">
                        ${this.createSlider('speed', 'Animation Speed', '⚡')}
                        ${this.createSlider('spiralA_color', 'Main Spiral Color', '🎨')}
                        ${this.createSlider('spiralB_color', 'Inner Spiral Color', '🌈')}
                        ${this.createSlider('geometryA', 'Main Spiral Size', '🌀')}
                        ${this.createSlider('geometryB', 'Inner Spiral Size', '🌊')}
                        ${this.createSlider('subtleVariation', 'Variation', '✨')}
                        ${this.createSlider('alpha', 'Transparency', '👻')}
                        ${this.createSlider('pulseIntensity', 'Trigger Pulse', '💥')}
                    </div>
                </div>

                <!-- Quick Presets -->
                <div class="control-section">
                    <p class="config-label">🎯 Quick Presets</p>
                    <div class="preset-buttons">
                        <button class="preset-button" data-action="spiral-preset-original" onclick="window.dropdownManager.getComponent('spiral').handleAction('spiral-preset-original', {})">
                            🔄 Original
                        </button>
                        <button class="preset-button" data-action="spiral-preset-hypnotic" onclick="window.dropdownManager.getComponent('spiral').handleAction('spiral-preset-hypnotic', {})">
                            😴 Hypnotic
                        </button>
                        <button class="preset-button" data-action="spiral-preset-intense" onclick="window.dropdownManager.getComponent('spiral').handleAction('spiral-preset-intense', {})">
                            🔥 Intense
                        </button>
                        <button class="preset-button" data-action="spiral-preset-peaceful" onclick="window.dropdownManager.getComponent('spiral').handleAction('spiral-preset-peaceful', {})">
                            ☮️ Peaceful
                        </button>
                    </div>
                </div>

                <!-- Settings Info -->
                <div class="control-section">
                    <p class="config-label" style="font-size: 0.8em; opacity: 0.7;">💾 Settings auto-save to device storage</p>
                </div>
            </div>
        `;
    }
}
