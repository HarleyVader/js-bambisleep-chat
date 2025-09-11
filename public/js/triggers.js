// triggers.js - Trigger word management and flashing text effects
class TriggerSystem {
    constructor() {
        this.isEnabled = false;
        this.triggers = [
            'bambi', 'bimbo', 'good girl', 'pink', 'spiral', 'obey', 'submit',
            'empty', 'blank', 'mindless', 'doll', 'pretty', 'cute', 'sleep'
        ];
        this.flashDuration = 1000; // ms
        this.audioEnabled = false;

        this.init();
    }

    init() {
        // Load triggers from server or local storage
        this.loadTriggers();
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
            return this.escapeHtml(text);
        }

        let processedText = this.escapeHtml(text);

        // Find and wrap trigger words
        this.triggers.forEach(trigger => {
            const regex = new RegExp(`\\b(${this.escapeRegex(trigger)})\\b`, 'gi');
            processedText = processedText.replace(regex, (match) => {
                this.playTriggerEffect();
                return `<span class="trigger-text">${match}</span>`;
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
