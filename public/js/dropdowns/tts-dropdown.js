/**
 * TTS Dropdown Component for BambiSleep Chat
 * Handles TTS system dropdown functionality
 */

import { StorageUtils } from '../storage-utils.js';

export class TTSDropdown {
    constructor(dropdownManager) {
        this.dropdownManager = dropdownManager;
        this.buttonId = 'toggle-tts';
        this.currentVoice = 'af_bella'; // Default voice
        this.currentSpeed = 1.0; // Default speed
        this.selectedVoices = []; // Track multiple selected voices
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupToggleHandling();
        this.loadSavedState();

        // Schedule sync after TTS system is ready
        setTimeout(() => {
            const ttsSystem = this.getTTSSystem();
            if (ttsSystem) {
                this.syncButtonStateWithTTSSystem(ttsSystem);
            }
        }, 1000);
    }

    loadSavedState() {
        // Load saved TTS state from localStorage
        const savedState = StorageUtils.getItem('bambi-tts-state');

        // Also sync with TTS system state if available
        const ttsSystem = this.getTTSSystem();

        if (savedState) {
            try {
                // savedState is already parsed by StorageUtils
                this.setState(savedState);
            } catch (e) {
                console.warn('⚠️ Failed to load TTS state:', e);
            }
        }

        // Sync with TTS system state (enhanced integration)
        if (ttsSystem) {
            // Sync voice selection
            if (ttsSystem.selectedVoices && Array.isArray(ttsSystem.selectedVoices)) {
                this.selectedVoices = [...ttsSystem.selectedVoices];
            }

            // Sync current voice
            if (ttsSystem.getCurrentVoice) {
                this.currentVoice = ttsSystem.getCurrentVoice();
            } else if (ttsSystem.currentVoice) {
                this.currentVoice = ttsSystem.currentVoice;
            }

            // Sync speed
            if (typeof ttsSystem.speed === 'number') {
                this.currentSpeed = ttsSystem.speed;
            }

            // CRITICAL: Sync button state with TTS system's actual enabled state
            this.syncButtonStateWithTTSSystem(ttsSystem);
        }
    }

    setupEventListeners() {
        // Listen for dropdown actions specific to TTS
        document.addEventListener('dropdownAction', (e) => {
            const { action, buttonId } = e.detail;
            if (buttonId === this.buttonId) {
                this.handleAction(action, e.detail);
            }
        });
    }

    setupToggleHandling() {
        // Dropdown open/close is handled by DropdownManager
        // This method kept for potential future toggle-specific logic
    }

    handleAction(action, detail) {
        console.log('TTS action: ' + action);

        switch (action) {
            case 'tts-test-voice':
                this.testVoice();
                break;
            case 'tts-clear-cache':
                this.clearCache();
                break;
            case 'tts-clear-selection':
                this.clearSelection();
                break;
            case 'tts-voice-select':
                this.handleVoiceSelect(detail.element);
                break;
            case 'tts-set-speed-slow':
                this.setSpeed(0.8);
                break;
            case 'tts-set-speed-normal':
                this.setSpeed(1.0);
                break;
            case 'tts-set-speed-fast':
                this.setSpeed(1.2);
                break;
            default:
                console.warn('Unknown TTS action: ' + action);
        }
    }

    handleVoiceSelect(element) {
        // This method is kept for compatibility but the new voice selection
        // is handled by the selectVoice method and click listeners
        console.log('Voice selection handled by new interface');
    }

    setVoice(voiceName) {
        const ttsSystem = this.getTTSSystem();
        if (ttsSystem) {
            // Use enhanced voice selection method
            ttsSystem.setVoice(voiceName);
            this.currentVoice = voiceName;

            // Update selectedVoices to match TTS system
            if (ttsSystem.selectedVoices) {
                this.selectedVoices = [...ttsSystem.selectedVoices];
            }

            this.dropdownManager.showActionFeedback('TTS', 'VOICE: ' + voiceName.toUpperCase());
            this.saveState();
        } else {
            console.warn('TTS system not available');
            this.showFeedback('TTS SYSTEM NOT AVAILABLE');
        }
    }

    setSpeed(speed) {
        const ttsSystem = this.getTTSSystem();
        if (ttsSystem) {
            ttsSystem.setSpeed(speed);
            this.currentSpeed = speed;
            this.dropdownManager.showActionFeedback('TTS', 'SPEED: ' + speed + 'x');
            this.saveState();
        } else {
            console.warn('TTS system not available');
            this.showFeedback('TTS SYSTEM NOT AVAILABLE');
        }
    }

    testVoice() {
        const ttsSystem = this.getTTSSystem();
        if (ttsSystem) {
            ttsSystem.speak('Good girl. BambiSleep voices are always feminine and beautiful.');
            this.dropdownManager.showActionFeedback('TTS', 'VOICE TEST STARTED');
        } else {
            console.warn('TTS system not available');
            this.showFeedback('TTS SYSTEM NOT AVAILABLE');
        }
    }

    clearCache() {
        const ttsSystem = this.getTTSSystem();
        if (ttsSystem) {
            ttsSystem.clearCache();
            this.dropdownManager.showActionFeedback('TTS', 'CACHE CLEARED');
        } else {
            console.warn('TTS system not available');
            this.showFeedback('TTS SYSTEM NOT AVAILABLE');
        }
    }

    clearSelection() {
        const ttsSystem = this.getTTSSystem();

        // Clear selection in TTS system first
        if (ttsSystem && ttsSystem.clearVoiceSelection) {
            ttsSystem.clearVoiceSelection();
        }

        // Clear local selection
        this.selectedVoices = [];
        this.currentVoice = 'af_bella'; // Reset to default

        // Remove active class from all voice buttons
        const voiceButtons = document.querySelectorAll('.voice-button');
        voiceButtons.forEach(button => {
            button.classList.remove('active');
        });

        // Update display
        this.updateVoiceDisplay();
        this.saveState();
        this.showFeedback('VOICE SELECTION CLEARED');
    }

    toggleState(btn) {
        const currentState = btn.getAttribute('data-state');
        const newState = currentState === 'off' ? 'on' : 'off';
        const statusIndicator = document.getElementById('tts-status');

        console.log(`🔄 TTS Toggle: ${currentState} → ${newState}`);

        btn.setAttribute('data-state', newState);

        // Update status indicator like brainwave
        if (statusIndicator) {
            if (newState === 'on') {
                statusIndicator.className = 'status-active';
                statusIndicator.textContent = '●';
            } else {
                statusIndicator.className = 'status-inactive';
                statusIndicator.textContent = '●';
            }
        }

        // Add visual feedback classes
        if (newState === 'on') {
            btn.classList.add('tts-enabled');
            btn.classList.remove('tts-disabled');
        } else {
            btn.classList.add('tts-disabled');
            btn.classList.remove('tts-enabled');
        }

        // Enable/disable TTS system using enhanced methods
        const ttsSystem = this.getTTSSystem();
        if (ttsSystem) {
            const beforeState = ttsSystem.isEnabled;

            if (newState === 'on') {
                if (ttsSystem.enable) {
                    ttsSystem.enable();
                } else {
                    ttsSystem.isEnabled = true;
                }
                console.log(`✅ TTS Enabled: ${beforeState} → ${ttsSystem.isEnabled}`);
            } else {
                if (ttsSystem.disable) {
                    ttsSystem.disable();
                } else {
                    ttsSystem.isEnabled = false;
                    if (ttsSystem.stop) {
                        ttsSystem.stop();
                    }
                }
                console.log(`❌ TTS Disabled: ${beforeState} → ${ttsSystem.isEnabled}`);
            }

            // Force save state after toggle
            if (ttsSystem.saveVoiceState) {
                ttsSystem.saveVoiceState();
                console.log('💾 TTS state saved after toggle');
            }
        } else {
            console.warn('⚠️ TTS system not available during toggle');
        }

        // Dispatch toggle event
        const event = new CustomEvent('toggleStateChange', {
            detail: {
                buttonId: this.buttonId,
                state: newState,
                buttonName: 'TTS'
            }
        });
        document.dispatchEvent(event);

        this.dropdownManager.showToggleFeedback('TTS', newState);
    }

    showFeedback(message) {
        // Create floating feedback notification (standardized like other dropdowns)
        const feedback = document.createElement('div');
        feedback.className = 'dropdown-notification z-notification';
        feedback.textContent = message;

        document.body.appendChild(feedback);

        setTimeout(() => {
            if (feedback && feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 3000);
    }

    saveState() {
        // Save current state to localStorage
        const state = this.getState();
        StorageUtils.setItem('bambi-tts-state', state);
        console.log('💾 TTS state saved to localStorage');
    }

    // Get current state for persistence
    getState() {
        return {
            voice: this.currentVoice,
            speed: this.currentSpeed,
            selectedVoices: this.selectedVoices
        };
    }

    // Restore state from persistence
    setState(state) {
        if (state.voice) {
            this.currentVoice = state.voice;
        }
        if (state.speed) {
            this.currentSpeed = state.speed;
        }
        if (state.selectedVoices) {
            this.selectedVoices = state.selectedVoices;
        }
    }

    // Helper function to safely access TTS system
    getTTSSystem() {
        if (window.ttsSystem) {
            return window.ttsSystem;
        }
        console.warn('⚠️ TTS system not available yet');
        return null;
    }

    // CRITICAL: Sync button visual state with TTS system's actual enabled state
    syncButtonStateWithTTSSystem(ttsSystem) {
        const ttsButton = document.getElementById(this.buttonId);
        if (!ttsButton) {
            console.warn('⚠️ TTS button not found during state sync');
            return;
        }

        // Get actual TTS system enabled state
        const actualTTSState = ttsSystem.isEnabled;
        const targetState = actualTTSState ? 'on' : 'off';
        const currentButtonState = ttsButton.getAttribute('data-state');

        // Update button state to match TTS system
        ttsButton.setAttribute('data-state', targetState);
        ttsButton.textContent = `TTS: ${targetState.toUpperCase()}`;

        // Add visual class for better user feedback
        if (actualTTSState) {
            ttsButton.classList.add('tts-enabled');
            ttsButton.classList.remove('tts-disabled');
        } else {
            ttsButton.classList.add('tts-disabled');
            ttsButton.classList.remove('tts-enabled');
        }
    } getDropdownContent() {
        return '<div class="tts-config">' +
            '<div class="control-section">' +
            '<p class="config-label">🎤 Voice Selection (Max 2)</p>' +
            '<div class="voice-categories">' +
            '<div class="voice-category">' +
            '<div class="category-header">FEMALE VOICES</div>' +
            '<div class="voice-buttons">' +
            this.generateVoiceButtons() +
            '</div>' +
            '</div>' +
            '</div>' +
            '<div class="selected-voices-display">' +
            '<p class="config-label">🔊 Selected: <span id="current-voice-display">' + this.getCurrentVoiceDisplay() + '</span></p>' +
            '</div>' +
            '</div>' +

            '<div class="control-section">' +
            '<p class="config-label">🚀 Speed Settings</p>' +
            '<a href="#" data-action="tts-set-speed-slow">🐌 Slow (0.8x)</a>' +
            '<a href="#" data-action="tts-set-speed-normal">⚡ Normal (1.0x)</a>' +
            '<a href="#" data-action="tts-set-speed-fast">🌪️ Fast (1.2x)</a>' +
            '</div>' +

            '<div class="control-section">' +
            '<p class="config-label">🔧 Tools</p>' +
            '<a href="#" data-action="tts-test-voice">🎵 Test Voice</a>' +
            '<a href="#" data-action="tts-clear-cache">Clear Cache</a>' +
            '<a href="#" data-action="tts-clear-selection">❌ Clear Selection</a>' +
            '</div>' +
            '</div>';
    }

    generateVoiceOptionsHTML() {
        const voices = [
            'af_alloy', 'af_aoede', 'af_bella', 'af_heart', 'af_jadzia', 'af_jessica',
            'af_kore', 'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky',
        ];

        return voices.map(voice => {
            const isSelected = this.selectedVoices.includes(voice) ? ' selected' : '';
            const isCurrent = this.currentVoice === voice ? ' current' : '';
            return '<div class="voice-option' + isSelected + isCurrent + '" data-voice="' + voice + '">' + voice + '</div>';
        }).join('\n');
    }

    generateVoiceButtons() {
        const voices = [
            'af_alloy', 'af_aoede', 'af_bella', 'af_heart', 'af_jadzia', 'af_jessica',
            'af_kore', 'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky',
        ];

        return voices.map(voice => {
            const isActive = this.selectedVoices.includes(voice) ? ' active' : '';
            return '<button class="voice-button' + isActive + '" ' +
                'data-voice="' + voice + '" ' +
                'onclick="window.dropdownManager.getComponent(\'tts\').handleVoiceClick(this, \'' + voice + '\')">' +
                voice +
                '</button>';
        }).join('\n');
    }

    getCurrentVoiceDisplay() {
        if (this.selectedVoices.length === 0) {
            return 'None';
        } else if (this.selectedVoices.length === 1) {
            return this.selectedVoices[0];
        } else {
            return this.selectedVoices.join(' + ');
        }
    }

    handleVoiceClick(button, voiceName) {
        const ttsSystem = this.getTTSSystem();

        // Check if voice is already selected
        if (this.selectedVoices.includes(voiceName)) {
            // Remove voice from both dropdown and TTS system
            this.selectedVoices = this.selectedVoices.filter(voice => voice !== voiceName);
            button.classList.remove('active');

            if (ttsSystem && ttsSystem.removeVoice) {
                ttsSystem.removeVoice(voiceName);
            }

            this.showFeedback('VOICE REMOVED: ' + voiceName.toUpperCase());
        } else {
            // Add voice (max 2)
            if (this.selectedVoices.length >= 2) {
                this.showFeedback('MAX 2 VOICES ALLOWED');
                return;
            }

            this.selectedVoices.push(voiceName);
            button.classList.add('active');

            if (ttsSystem && ttsSystem.addVoice) {
                ttsSystem.addVoice(voiceName);
            }

            this.showFeedback('VOICE ADDED: ' + voiceName.toUpperCase());
        }

        // Update current voice (combined string or single)
        if (this.selectedVoices.length > 0) {
            this.currentVoice = this.selectedVoices.join('+');
            // TTS system will be updated automatically through addVoice/removeVoice
        } else {
            this.currentVoice = 'af_bella'; // Default
            if (ttsSystem && ttsSystem.setVoice) {
                ttsSystem.setVoice(this.currentVoice);
            }
        }

        // Update display and save state
        this.updateVoiceDisplay();
        this.saveState();
    }

    updateVoiceDisplay() {
        const displayElement = document.getElementById('current-voice-display');
        if (displayElement) {
            displayElement.textContent = this.getCurrentVoiceDisplay();
        }
    }

    // DIAGNOSTIC: Debug TTS state issues
    diagnoseTTSState() {
        console.log('🔍 TTS State Diagnosis:');

        const ttsButton = document.getElementById(this.buttonId);
        const ttsSystem = this.getTTSSystem();

        console.log('Button State:', {
            'Button Exists': !!ttsButton,
            'data-state': ttsButton?.getAttribute('data-state'),
            'Button Text': ttsButton?.textContent,
            'Button Classes': ttsButton?.className
        });

        console.log('TTS System State:', {
            'System Exists': !!ttsSystem,
            'isEnabled': ttsSystem?.isEnabled,
            'currentVoice': ttsSystem?.currentVoice,
            'useKokoro': ttsSystem?.useKokoro,
            'socket connected': ttsSystem?.socket?.connected
        });

        console.log('LocalStorage State:', {
            'bambi-tts-voice-state': localStorage.getItem('bambi-tts-voice-state'),
            'bambi-tts-state': localStorage.getItem('bambi-tts-state')
        });

        // Test basic TTS functionality
        if (ttsSystem) {
            console.log('🧪 Testing TTS...');
            ttsSystem.enable();
            console.log('TTS enabled, testing speech...');
            ttsSystem.speak('TTS test successful');
        }
    }
}

// Make diagnostic function available globally for easy access
window.diagnoseTTS = () => {
    const dropdown = window.dropdownManager?.getComponent('tts');
    if (dropdown && dropdown.diagnoseTTSState) {
        dropdown.diagnoseTTSState();
    } else {
        console.error('TTS dropdown not available for diagnosis');
    }
};
