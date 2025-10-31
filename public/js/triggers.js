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

        // Listen for trigger system toggle events
        document.addEventListener('triggerSystemToggle', (event) => {
            this.isEnabled = event.detail.enabled;
            console.log(`TriggerSystem: ${this.isEnabled ? 'ENABLED' : 'DISABLED'}`);
        });
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
        const isAlreadyProcessed = text.includes('ai-generated-highlight');

        let processedText;

        if (isAlreadyProcessed) {
            // Already contains HTML highlighting, still process new triggers
            processedText = text;
        } else {
            // Regular text that needs full processing
            processedText = this.escapeHtml(text);
        }

        // Process all triggers with overlapping support
        processedText = this.processAllTriggersWithOverlap(processedText);

        return processedText;
    }

    processAllTriggersWithOverlap(text) {
        // Sort triggers by length (longest first) to handle "Bambi Sleep" before "Bambi"
        const sortedTriggers = [...this.triggers].sort((a, b) => b.length - a.length);

        let processedText = text;

        // Process each trigger independently
        sortedTriggers.forEach(trigger => {
            const regex = new RegExp(`\\b(${this.escapeRegex(trigger)})\\b`, 'gi');

            processedText = processedText.replace(regex, (match, p1, offset, string) => {
                // Check if this match is already inside a trigger span
                const beforeMatch = string.substring(0, offset);

                // Count open and close spans before this position
                const openSpans = (beforeMatch.match(/<span[^>]*class="[^"]*trigger[^"]*"[^>]*>/g) || []).length;
                const closeSpans = (beforeMatch.match(/<\/span>/g) || []).length;

                // If we're inside a span, don't process
                if (openSpans > closeSpans) {
                    return match;
                }

                // Check if this exact text is already highlighted
                const alreadyHighlighted =
                    string.includes(`<span class="trigger-text" data-trigger="${trigger}">${match}</span>`);

                if (alreadyHighlighted) {
                    return match;
                }

                this.playTriggerEffect();
                return `<span class="trigger-text" data-trigger="${trigger}">${match}</span>`;
            });
        });

        return processedText;
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
        flashOverlay.className = 'trigger-flash-overlay z-modal';

        // Flash animation now handled by CSS
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
