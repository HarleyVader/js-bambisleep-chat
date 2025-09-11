// triggers.js - Trigger word management and flashing text effects
class TriggerSystem {
    constructor() {
        this.isEnabled = false;
        this.triggers = []; // Will be loaded from official triggers.json
        this.flashDuration = 1000; // ms
        this.audioEnabled = false;

        this.init();
    }

    init() {
        // Load official triggers from JSON
        this.loadOfficialTriggers();
    }

    async loadOfficialTriggers() {
        try {
            const response = await fetch('/api/triggers/json');
            const data = await response.json();

            // Extract trigger names from official data
            this.triggers = [];
            if (data.triggers && Array.isArray(data.triggers)) {
                data.triggers.forEach(trigger => {
                    this.triggers.push(trigger.name.toLowerCase());
                });
            }

            console.log('🎯 TriggerSystem loaded OFFICIAL triggers:', this.triggers);
            console.log('📋 Source:', data.source);

        } catch (error) {
            console.error('CRITICAL: TriggerSystem failed to load official triggers:', error);
            // NO FALLBACK - Only use official triggers
            this.triggers = [];
        }
    }

    async loadTriggers() {
        try {
            const response = await fetch('/api/triggers');
            if (response.ok) {
                const data = await response.json();
                this.triggers = data.triggers || this.triggers;
            }
        } catch (error) {
            console.warn('Could not load triggers from server, using defaults');
        }
    }

    toggle() {
        this.isEnabled = !this.isEnabled;
        return this.isEnabled;
    }

    processMessage(text) {
        if (!this.isEnabled) {
            // If triggers are disabled but text contains HTML, preserve it
            return text.includes('<span') ? text : this.escapeHtml(text);
        }

        // Check if this is already processed HTML (contains our highlight classes)
        const isAlreadyProcessed = text.includes('ai-generated-highlight') || text.includes('enhanced-trigger');

        let processedText;

        if (isAlreadyProcessed) {
            // Already contains HTML highlighting, just process any remaining unhighlighted triggers
            processedText = text;
        } else {
            // Regular text that needs full processing
            processedText = this.escapeHtml(text);
            // First process **TRIGGER** format (enhanced triggers in caps between asterisks)
            processedText = this.processEnhancedTriggers(processedText);
        }

        // Then find and wrap regular trigger words (but avoid double-processing)
        this.triggers.forEach(trigger => {
            // Skip processing if this trigger is already wrapped in any highlight span
            if (processedText.includes(`<span class="enhanced-trigger">${trigger.toUpperCase()}</span>`) ||
                processedText.includes(`<span class="ai-generated-highlight">${trigger.toUpperCase()}</span>`)) {
                return;
            }

            const regex = new RegExp(`\\b(${this.escapeRegex(trigger)})\\b`, 'gi');
            processedText = processedText.replace(regex, (match) => {
                // Don't process if it's inside any highlight span
                const beforeMatch = processedText.substring(0, processedText.indexOf(match));
                const openSpanCount = (beforeMatch.match(/<span class="[^"]*highlight[^"]*">/g) || []).length;
                const closeSpanCount = (beforeMatch.match(/<\/span>/g) || []).length;

                // If we're inside a highlight span, skip
                if (openSpanCount > closeSpanCount) {
                    return match;
                }

                this.playTriggerEffect();
                return `<span class="trigger-text">${match}</span>`;
            });
        });

        return processedText;
    }

    processEnhancedTriggers(text) {
        // Use string.replace() to find **TRIGGER** patterns and convert them
        // Matches **[CAPS WORDS]** format - handles single words or multiple words
        const enhancedTriggerRegex = /\*\*([A-Z]+(?:\s+[A-Z]+)*)\*\*/g;

        return text.replace(enhancedTriggerRegex, (match, triggerText) => {
            // Play enhanced trigger effect
            this.playEnhancedTriggerEffect();

            // Return the trigger without asterisks but with hot pink styling
            return `<span class="enhanced-trigger">${triggerText}</span>`;
        });
    }

    playEnhancedTriggerEffect() {
        // Enhanced effect for **TRIGGER** format
        if (this.audioEnabled) {
            this.playEnhancedTriggerSound();
        }

        // Enhanced visual flash effect
        this.flashEnhancedScreen();
    }

    playEnhancedTriggerSound() {
        // Create a more intense sound for enhanced triggers
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Higher frequency and longer duration for enhanced triggers
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    }

    flashEnhancedScreen() {
        const flashOverlay = document.createElement('div');
        flashOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(223, 4, 113, 0.6);
            z-index: 9999;
            pointer-events: none;
            animation: enhancedTriggerFlash 0.5s ease-out;
        `;

        // Add enhanced flash animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes enhancedTriggerFlash {
                0% { opacity: 0; }
                50% { opacity: 1; }
                100% { opacity: 0; }
            }
        `;

        if (!document.querySelector('#enhanced-trigger-flash-style')) {
            style.id = 'enhanced-trigger-flash-style';
            document.head.appendChild(style);
        }

        document.body.appendChild(flashOverlay);

        setTimeout(() => {
            document.body.removeChild(flashOverlay);
        }, 500);
    }

    playTriggerEffect() {
        if (this.audioEnabled) {
            this.playTriggerSound();
        }

        // Add visual flash effect to screen
        this.flashScreen();
    }

    playTriggerSound() {
        // Create a simple beep sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    }

    flashScreen() {
        const flashOverlay = document.createElement('div');
        flashOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(223, 4, 113, 0.4);
            z-index: 9999;
            pointer-events: none;
            animation: triggerFlash 0.3s ease-out;
        `;

        // Add flash animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes triggerFlash {
                0% { opacity: 0; }
                50% { opacity: 1; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(flashOverlay);

        setTimeout(() => {
            document.body.removeChild(flashOverlay);
            document.head.removeChild(style);
        }, 300);
    }

    addTrigger(word) {
        const cleanWord = word.toLowerCase().trim();
        if (cleanWord && !this.triggers.includes(cleanWord)) {
            this.triggers.push(cleanWord);
            this.saveTriggers();
            return true;
        }
        return false;
    }

    removeTrigger(word) {
        const index = this.triggers.indexOf(word.toLowerCase().trim());
        if (index > -1) {
            this.triggers.splice(index, 1);
            this.saveTriggers();
            return true;
        }
        return false;
    }

    async saveTriggers() {
        try {
            await fetch('/api/triggers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ triggers: this.triggers })
            });
        } catch (error) {
            console.warn('Could not save triggers to server');
        }
    }

    getTriggers() {
        return [...this.triggers];
    }

    toggleAudio() {
        this.audioEnabled = !this.audioEnabled;
        return this.audioEnabled;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// Initialize trigger system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.triggerSystem = new TriggerSystem();
});
