/**
 * Brainwave Dropdown Component for BambiSleep Chat
 * Handles brainwave generator dropdown functionality using universal layers architecture
 */

export class BrainwaveDropdown {
    constructor(dropdownManager) {
        this.dropdownManager = dropdownManager;
        this.buttonId = 'toggle-brainwave';
        this.componentName = 'brainwave'; // For centralized state access
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupToggleHandling();
        this.loadSavedState();
        this.initializePresets();
    }

    // ENHANCED: Centralized State Helper Methods
    get isEnabled() {
        return this.dropdownManager.getComponentState(this.componentName, 'isEnabled') || false;
    }

    set isEnabled(value) {
        this.dropdownManager.setComponentState(this.componentName, 'isEnabled', value);
    }

    get currentPreset() {
        return this.dropdownManager.getComponentState(this.componentName, 'currentPreset') || '';
    }

    set currentPreset(value) {
        this.dropdownManager.setComponentState(this.componentName, 'currentPreset', value);
    }

    get volume() {
        return this.dropdownManager.getComponentState(this.componentName, 'volume') || 10;
    }

    set volume(value) {
        this.dropdownManager.setComponentState(this.componentName, 'volume', value);
    }

    get isPlaying() {
        return this.dropdownManager.getComponentState(this.componentName, 'isPlaying') || false;
    }

    set isPlaying(value) {
        this.dropdownManager.setComponentState(this.componentName, 'isPlaying', value);
    }

    setupEventListeners() {
        // Listen for centralized dropdown actions
        document.addEventListener('dropdownAction', (e) => {
            if (e.detail.buttonId === this.buttonId) {
                this.handleAction(e.detail.action, e.detail);
            }
        });

        // Listen for component state changes
        document.addEventListener('componentStateChange', (e) => {
            if (e.detail.component === this.componentName) {
                this.handleStateChange(e.detail.key, e.detail.value);
            }
        });
    }

    setupToggleHandling() {
        const btn = document.getElementById(this.buttonId);
        const status = document.getElementById('brainwave-status');

        if (btn && status) {
            // Update button state using CSS classes (no inline styles)
            btn.setAttribute('data-state', this.isEnabled ? 'on' : 'off');
            status.className = this.isEnabled ? 'status-active' : 'status-inactive';
        }
    }

    handleAction(action, detail) {
        const { selectedText, element, value } = detail;

        switch (action) {
            case 'selectPreset':
                this.handlePresetSelection(selectedText, value);
                break;
            case 'volumeChange':
                this.handleVolumeChange(value);
                break;
            case 'playBrainwave':
                this.handlePlayBrainwave();
                break;
            case 'stopBrainwave':
                this.handleStopBrainwave();
                break;
            default:
                console.log(`🧠 Brainwave action: ${action}`, detail);
        }
    }

    handleStateChange(key, value) {
        console.log(`🧠 Brainwave state changed: ${key} = ${value}`);

        switch (key) {
            case 'isEnabled':
                this.updateToggleButton();
                break;
            case 'isPlaying':
                this.updatePlaybackControls();
                break;
            case 'volume':
                this.updateVolumeDisplay();
                break;
            case 'currentPreset':
                this.updatePresetDisplay();
                break;
        }
    }

    updateToggleButton() {
        const btn = document.getElementById(this.buttonId);
        const status = document.getElementById('brainwave-status');

        if (btn && status) {
            // Use standard button states from buttons.css (no inline styles)
            btn.setAttribute('data-state', this.isEnabled ? 'on' : 'off');
            status.className = this.isEnabled ? 'status-active' : 'status-inactive';
        }
    }

    initializePresets() {
        if (!window.brainwaveGenerator) {
            setTimeout(() => this.initializePresets(), 100);
            return;
        }

        const presetSelect = document.getElementById('brainwave-preset');
        if (!presetSelect) return;

        const presets = window.brainwaveGenerator.getPresets();
        presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.name;
            option.textContent = `${preset.name} (${preset.beat}Hz)`;
            option.title = preset.description;
            presetSelect.appendChild(option);
        });

        this.updatePlaybackControls();
    }

    updatePlaybackControls() {
        const playBtn = document.getElementById('brainwave-play');
        const stopBtn = document.getElementById('brainwave-stop');
        const infoDisplay = document.getElementById('brainwave-info');

        if (!playBtn || !stopBtn || !infoDisplay) return;

        if (this.isPlaying) {
            playBtn.disabled = true;
            stopBtn.disabled = false;
            infoDisplay.textContent = `Playing: ${this.currentPreset || 'Custom'}`;
        } else {
            playBtn.disabled = false;
            stopBtn.disabled = true;
            infoDisplay.textContent = 'Ready to start...';
        }
    }

    updateVolumeDisplay() {
        const volumeDisplay = document.getElementById('volume-display');
        const volumeSlider = document.getElementById('brainwave-volume');

        if (volumeDisplay && volumeSlider) {
            volumeDisplay.textContent = `${this.volume}%`;
            volumeSlider.value = this.volume;
        }
    }

    updatePresetDisplay() {
        const presetSelect = document.getElementById('brainwave-preset');
        if (presetSelect) {
            presetSelect.value = this.currentPreset;
        }
    }

    handlePresetSelection(selectedText, value) {
        this.currentPreset = value;
        console.log(`🧠 Preset selected: ${selectedText}`);
    }

    handleVolumeChange(value) {
        this.volume = parseInt(value);

        if (window.brainwaveGenerator) {
            window.brainwaveGenerator.setVolume(this.volume / 100);
        }

        // Dispatch event for centralized handling
        document.dispatchEvent(new CustomEvent('componentStateChange', {
            detail: {
                component: this.componentName,
                key: 'volume',
                value: this.volume
            }
        }));
    }

    async handlePlayBrainwave() {
        try {
            if (!window.brainwaveGenerator) {
                this.showError('Generator not available');
                return;
            }

            if (!this.currentPreset) {
                this.showError('Please select a preset first');
                return;
            }

            this.showInfo('Starting...');

            const success = await window.brainwaveGenerator.startPreset(this.currentPreset);

            if (success) {
                this.isPlaying = true;

                // Send chat notification
                if (window.chatCore) {
                    window.chatCore.addMessage('system', `🧠 Brainwave session started: ${this.currentPreset}`);
                }
            } else {
                this.showError('Failed to start. Check console for details.');
            }
        } catch (error) {
            this.showError(`Playback error: ${error.message}`);
            console.error('❌ Brainwave playback error:', error);
        }
    }

    handleStopBrainwave() {
        try {
            if (window.brainwaveGenerator) {
                window.brainwaveGenerator.stop();
                this.isPlaying = false;

                // Send chat notification
                if (window.chatCore) {
                    window.chatCore.addMessage('system', '🧠 Brainwave session stopped');
                }
            }
        } catch (error) {
            console.error('❌ Brainwave stop error:', error);
            this.showError(`Stop error: ${error.message}`);
        }
    }

    showInfo(message) {
        const infoDisplay = document.getElementById('brainwave-info');
        if (infoDisplay) {
            infoDisplay.textContent = message;
        }
    }

    showError(message) {
        const infoDisplay = document.getElementById('brainwave-info');
        if (infoDisplay) {
            infoDisplay.textContent = `Error: ${message}`;
        }
        console.error(`❌ Brainwave Error: ${message}`);
    }

    loadSavedState() {
        // Load saved state from localStorage or use defaults
        const savedVolume = localStorage.getItem('brainwave-volume');
        if (savedVolume) {
            this.volume = parseInt(savedVolume);
        }

        const savedPreset = localStorage.getItem('brainwave-preset');
        if (savedPreset) {
            this.currentPreset = savedPreset;
        }

        // Apply loaded state to UI
        this.updateVolumeDisplay();
        this.updatePresetDisplay();
    }

    saveState() {
        // Save current state to localStorage
        localStorage.setItem('brainwave-volume', this.volume.toString());
        localStorage.setItem('brainwave-preset', this.currentPreset);
    }

    // Cleanup method for memory management
    cleanup() {
        console.log('🧹 Cleaning up brainwave dropdown');
        this.saveState();

        if (window.brainwaveGenerator && this.isPlaying) {
            window.brainwaveGenerator.stop();
        }
    }
}

// Legacy function for backward compatibility
export function createBrainwaveDropdown() {
    console.warn('⚠️ createBrainwaveDropdown() is deprecated. Use BrainwaveDropdown class instead.');

    // Return basic HTML structure for compatibility
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown brainwave-dropdown';
    dropdown.innerHTML = `
        <button class="dropdown-btn toggle-button" id="toggle-brainwave" data-state="off">
            🧠 Brainwaves
            <span class="status-indicator" id="brainwave-status">●</span>
        </button>
        <div class="dropdown-content">
            <div class="dropdown-header">
                <h3>🧠 Brainwave Generator</h3>
                <p>Binaural beats for meditation, focus, and relaxation</p>
            </div>
            <div class="brainwave-controls">
                <div class="preset-section">
                    <label>Preset:</label>
                    <select id="brainwave-preset">
                        <option value="">Select a preset...</option>
                    </select>
                </div>
                <div class="volume-section">
                    <label>Volume:</label>
                    <input type="range" id="brainwave-volume" min="0" max="100" value="10">
                    <span id="volume-display">10%</span>
                </div>
                <div class="control-buttons">
                    <button id="brainwave-play" class="control-button play-btn">▶ Start</button>
                    <button id="brainwave-stop" class="control-button stop-btn">⏹ Stop</button>
                </div>
                <div class="status-section">
                    <div id="brainwave-info" class="info-display">Ready to start...</div>
                </div>
                <div class="warning-section">
                    <small>⚠️ Use headphones for binaural effect. Start with low volume.</small>
                </div>
            </div>
        </div>
    `;

    return dropdown;
}
