// effects.js - TRIGGER PHRASE ONLY highlighting system
class TextEffects {
    constructor() {
        this.capsColor = '#df0471'; // Hot pink color for trigger phrases ONLY
        this.triggers = [];
        this.loadTriggers();
        this.init();
    }

    // Load OFFICIAL BambiSleep triggers from JSON file ONLY
    async loadTriggers() {
        try {
            const response = await fetch('/workers/triggers.json');
            const data = await response.json();

            // Extract official BambiSleep trigger names from the JSON
            this.triggers = [];
            if (data.triggers && Array.isArray(data.triggers)) {
                data.triggers.forEach(trigger => {
                    // Add the official trigger name (case variations)
                    const triggerName = trigger.name;
                    this.triggers.push(triggerName.toUpperCase()); // UPPERCASE version
                    this.triggers.push(triggerName.toLowerCase()); // lowercase version
                    this.triggers.push(triggerName); // Original case version
                });
            }

            console.log('Loaded OFFICIAL BambiSleep triggers:', this.triggers);
            console.log('Trigger source:', data.source);
            console.log('Trigger version:', data.version);
        } catch (error) {
            console.error('CRITICAL: Failed to load official BambiSleep triggers:', error);
            // NO FALLBACK - Only use official triggers
            this.triggers = [];
        }
    }

    init() {
        console.log('TextEffects initialized - TRIGGER PHRASES ONLY highlighting');
    }

    // Process AI response and highlight ONLY trigger phrases - NOTHING ELSE
    processAIResponse(text) {
        if (!this.triggers || this.triggers.length === 0) {
            return text; // No triggers loaded yet, return original text
        }

        let processedText = text;

        // Process each trigger phrase individually
        this.triggers.forEach(trigger => {
            // Escape special regex characters and create exact match pattern
            const escapedTrigger = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const triggerRegex = new RegExp(`\\b(${escapedTrigger})\\b`, 'gi');

            processedText = processedText.replace(triggerRegex, (match) => {
                // Skip if already inside HTML tags
                const beforeMatch = processedText.substring(0, processedText.indexOf(match));
                if (beforeMatch.lastIndexOf('<') > beforeMatch.lastIndexOf('>') ||
                    match.includes('<span') || match.includes('</span>')) {
                    return match;
                }

                // Highlight ONLY trigger phrases in hot pink
                return `<span class="caps-text" style="color: ${this.capsColor}; font-weight: bold;" data-trigger="${trigger}">${match}</span>`;
            });
        });

        return processedText;
    }

    // Apply glitch effect ONLY to trigger phrases
    applyGlitchEffect(element) {
        element.classList.add('glitch-active');

        // Remove glitch after animation duration
        setTimeout(() => {
            element.classList.remove('glitch-active');
        }, 600);
    }

    // Main processing function called by aigf-core - TRIGGER PHRASES ONLY
    processMessage(text, isAI = false) {
        if (!isAI) {
            return text; // Only process AI messages
        }

        // Process AI message for TRIGGER PHRASE highlighting ONLY
        const processedText = this.processAIResponse(text);

        // Schedule glitch effects ONLY for trigger phrases
        setTimeout(() => {
            const triggerElements = document.querySelectorAll('.caps-text[data-trigger]:not(.glitch-processed)');
            triggerElements.forEach((element, index) => {
                // Mark as processed to avoid re-applying effects
                element.classList.add('glitch-processed');

                // Stagger glitch effects for trigger phrases only
                setTimeout(() => {
                    this.applyGlitchEffect(element);
                }, index * 200);
            });
        }, 150);

        return processedText;
    }
}

// Initialize global text effects system for TRIGGER PHRASES ONLY
window.textEffects = new TextEffects();

console.log('TRIGGER PHRASES ONLY TextEffects system loaded');
