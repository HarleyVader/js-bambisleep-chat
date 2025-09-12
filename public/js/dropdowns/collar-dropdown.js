/**
 * Collar Dropdown Component for BambiSleep Chat
 * Handles collar settings and socket.io connectivity
 */

import { StorageUtils } from '../storage-utils.js';

export class CollarDropdown {
    constructor(dropdownManager) {
        this.dropdownManager = dropdownManager;
        this.buttonId = 'toggle-collar';
        this.collarSettings = '';
        this.isResizing = false;
        this.init();
    }

    init() {
        console.log('🔗 Initializing Collar Dropdown...');
        this.setupEventListeners();
        this.setupResizeHandling();
        this.loadSavedSettings();
    }

    setupEventListeners() {
        // Listen for dropdown actions specific to collar
        document.addEventListener('dropdownAction', (e) => {
            const { action, buttonId } = e.detail;
            if (buttonId === this.buttonId) {
                this.handleAction(action, e.detail);
            }
        });
    }

    setupResizeHandling() {
        document.addEventListener('mousedown', (e) => {
            if (e.target.id === 'collar-text') {
                this.isResizing = true;
            }
        });

        document.addEventListener('mouseup', () => {
            this.isResizing = false;
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isResizing) {
                // Prevent dropdown from closing while resizing
                e.stopPropagation();
            }
        });
    }

    handleAction(action, detail) {
        console.log(`🔗 Collar action: ${action}`);

        switch (action) {
            case 'collar-copy':
                this.copySettings();
                break;
            case 'collar-paste':
                this.pasteSettings();
                break;
            case 'collar-save':
                this.saveSettings();
                break;
            case 'collar-clear':
                this.clearSettings();
                break;
            case 'collar-export':
                this.exportSettings();
                break;
            case 'collar-import':
                this.importSettings();
                break;
            default:
                console.warn(`Unknown collar action: ${action}`);
        }
    }

    async copySettings() {
        const textarea = document.getElementById('collar-text');
        const text = textarea ? textarea.value.trim() : '';

        if (text) {
            try {
                await navigator.clipboard.writeText(text);
                this.showFeedback('SETTINGS COPIED');
                console.log('📋 Collar settings copied to clipboard');
            } catch (err) {
                console.error('❌ Failed to copy to clipboard:', err);
                this.showFeedback('COPY FAILED');
            }
        } else {
            this.showFeedback('NO SETTINGS TO COPY');
        }
    }

    async pasteSettings() {
        try {
            const text = await navigator.clipboard.readText();
            const textarea = document.getElementById('collar-text');
            if (textarea) {
                textarea.value = text;
                this.collarSettings = text;
                this.showFeedback('SETTINGS PASTED');
                console.log('📋 Collar settings pasted from clipboard');
            }
        } catch (err) {
            console.error('❌ Failed to paste from clipboard:', err);
            this.showFeedback('PASTE FAILED');
        }
    }

    saveSettings() {
        const textarea = document.getElementById('collar-text');
        const collarText = textarea ? textarea.value.trim() : '';

        if (collarText) {
            this.collarSettings = collarText;
            StorageUtils.setItem('bambi-collar-settings', collarText);
            this.showFeedback('SETTINGS SAVED');
            console.log('💾 Collar settings saved to localStorage');

            // Send to server via socket if available
            const socket = this.getSocket();
            if (socket) {
                // Ensure the socket data is properly structured and safe
                const socketData = {
                    settings: collarText,
                    timestamp: Date.now()
                };

                // Validate the data before sending
                if (StorageUtils.isSafeToStore(socketData)) {
                    socket.emit('collar-settings', socketData);
                    console.log('📡 Collar settings sent via socket');
                } else {
                    console.warn('⚠️ Socket data validation failed, not sending');
                }
            }

            // Update collar button state to ON
            this.updateCollarButton(true);
        } else {
            this.showFeedback('NO SETTINGS TO SAVE');
        }

        // Close dropdown after save
        const dropdown = document.querySelector('.collar-dropdown');
        if (dropdown) {
            this.dropdownManager.closeDropdown(dropdown);
        }
    }

    clearSettings() {
        const textarea = document.getElementById('collar-text');
        if (textarea) {
            textarea.value = '';
            this.collarSettings = '';
            StorageUtils.removeItem('bambi-collar-settings');
            this.showFeedback('SETTINGS CLEARED');
            this.updateCollarButton(false);
            console.log('🗑️ Collar settings cleared');
        }
    }

    exportSettings() {
        const textarea = document.getElementById('collar-text');
        const text = textarea ? textarea.value.trim() : '';

        if (text) {
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bambi-collar-settings-${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            this.showFeedback('SETTINGS EXPORTED');
        } else {
            this.showFeedback('NO SETTINGS TO EXPORT');
        }
    }

    importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const text = e.target.result;
                    const textarea = document.getElementById('collar-text');
                    if (textarea) {
                        textarea.value = text;
                        this.collarSettings = text;
                        this.showFeedback('SETTINGS IMPORTED');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    loadSavedSettings() {
        const savedSettings = StorageUtils.getItem('bambi-collar-settings');
        if (savedSettings) {
            this.collarSettings = savedSettings;
            console.log('📋 Loading saved collar settings');

            // Set textarea value when available
            setTimeout(() => {
                const textarea = document.getElementById('collar-text');
                if (textarea) {
                    textarea.value = savedSettings;
                }
            }, 100);

            this.updateCollarButton(true);
        }
    }

    updateCollarButton(isActive) {
        const collarButton = document.getElementById(this.buttonId);
        if (collarButton) {
            if (isActive) {
                collarButton.textContent = 'Collar: ON';
                collarButton.setAttribute('data-state', 'on');
                // Remove inline styles to let CSS handle the cyber electric styling
                collarButton.style.removeProperty('background');
                collarButton.style.removeProperty('boxShadow');
            } else {
                collarButton.textContent = 'Collar: OFF';
                collarButton.setAttribute('data-state', 'off');
                // Remove inline styles to let CSS handle the cyber electric styling
                collarButton.style.removeProperty('background');
                collarButton.style.removeProperty('boxShadow');
            }
        }
    }

    showFeedback(message) {
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
            if (feedback && feedback.parentNode) {
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

    toggleState(btn) {
        const currentState = btn.getAttribute('data-state');
        const newState = currentState === 'off' ? 'on' : 'off';

        btn.setAttribute('data-state', newState);
        btn.textContent = `Collar: ${newState.toUpperCase()}`;

        // Handle collar logic based on state
        if (newState === 'on') {
            // Try to save existing settings or prompt for input
            setTimeout(() => {
                const textarea = document.getElementById('collar-text');
                const hasContent = textarea && textarea.value.trim();

                if (hasContent) {
                    this.saveSettings();
                } else {
                    // Focus on textarea to encourage input
                    if (textarea) {
                        textarea.focus();
                    }
                    this.showFeedback('ENTER COLLAR SETTINGS');
                }
            }, 100); // Wait for dropdown content to be populated
        } else {
            // Clear collar settings when turned off
            this.clearSettings();
        }

        this.showFeedback(`COLLAR: ${newState.toUpperCase()}`);
    }

    // Get HTML content for the dropdown
    getDropdownContent() {
        return `
            <div class="collar-config">
                <p class="config-label">🔗 Collar Settings:</p>
                <textarea id="collar-text" class="collar-textarea" placeholder="Enter collar settings..." style="
                    width: 100%;
                    min-height: 120px;
                    resize: both;
                    padding: 10px;
                    border: 1px solid var(--button-color);
                    border-radius: var(--border-radius);
                    background: var(--chat-bg);
                    color: var(--text-color);
                    font-family: 'Courier New', monospace;
                    font-size: 0.8rem;
                "></textarea>
                <div class="collar-buttons" style="
                    display: flex;
                    gap: 8px;
                    margin-top: 10px;
                    flex-wrap: wrap;
                ">
                    <button class="collar-btn" data-action="collar-copy" onclick="window.dropdownManager.getComponent('collar').copySettings()" style="
                        flex: 1;
                        min-width: 60px;
                        padding: 6px 12px;
                        background: var(--button-color);
                        color: var(--primary-color);
                        border: none;
                        border-radius: var(--border-radius);
                        font-family: 'Audiowide', sans-serif;
                        font-size: 0.7rem;
                        cursor: pointer;
                    ">Copy</button>
                    <button class="collar-btn" data-action="collar-paste" onclick="window.dropdownManager.getComponent('collar').pasteSettings()" style="
                        flex: 1;
                        min-width: 60px;
                        padding: 6px 12px;
                        background: var(--button-color);
                        color: var(--primary-color);
                        border: none;
                        border-radius: var(--border-radius);
                        font-family: 'Audiowide', sans-serif;
                        font-size: 0.7rem;
                        cursor: pointer;
                    ">Paste</button>
                    <button class="collar-btn" data-action="collar-save" onclick="window.dropdownManager.getComponent('collar').saveSettings()" style="
                        flex: 1;
                        min-width: 60px;
                        padding: 6px 12px;
                        background: linear-gradient(45deg, #ff1493, #ff69b4);
                        color: white;
                        border: none;
                        border-radius: var(--border-radius);
                        font-family: 'Audiowide', sans-serif;
                        font-size: 0.7rem;
                        font-weight: bold;
                        cursor: pointer;
                    ">Save</button>
                </div>
                <div class="control-section">
                    <p class="config-label">🔧 Advanced:</p>
                    <a href="#" data-action="collar-clear" onclick="window.dropdownManager.getComponent('collar').clearSettings(); return false;">🗑️ Clear Settings</a>
                    <a href="#" data-action="collar-export" onclick="window.dropdownManager.getComponent('collar').exportSettings(); return false;">📥 Export</a>
                    <a href="#" data-action="collar-import" onclick="window.dropdownManager.getComponent('collar').importSettings(); return false;">📤 Import</a>
                </div>
            </div>
        `;
    }
}
