// effects.js - TRIGGER PHRASE ONLY highlighting system
class TextEffects {
    constructor() {
        this.capsColor = '#df0471'; // Hot pink color for trigger phrases ONLY
        this.triggers = [];
        this.loadTriggers();
        this.init();
    }

    // Load OFFICIAL BambiSleep triggers from JSON file with enhanced data
    async loadTriggers() {
        try {
            const response = await fetch('/api/triggers/json');
            const data = await response.json();

            // Extract official BambiSleep trigger names and metadata
            this.triggers = [];
            this.triggerData = {}; // Store full trigger information

            if (data.triggers && Array.isArray(data.triggers)) {
                data.triggers.forEach(trigger => {
                    // Add case variations for matching
                    const triggerName = trigger.name;
                    this.triggers.push(triggerName.toUpperCase()); // UPPERCASE
                    this.triggers.push(triggerName.toLowerCase()); // lowercase
                    this.triggers.push(triggerName); // Original case

                    // Store full trigger data for enhanced highlighting
                    this.triggerData[triggerName.toUpperCase()] = {
                        category: trigger.category,
                        safetyLevel: trigger.safetyLevel,
                        effects: trigger.effects || [],
                        description: trigger.description
                    };
                });
            }

            console.log('🎯 Loaded OFFICIAL BambiSleep triggers:', this.triggers.length, 'variations');
            console.log('📋 Source:', data.source, '| Version:', data.version);
            console.log('🏷️ Categories:', Object.keys(data.categories || {}));
            console.log('⚡ Trigger data loaded for enhanced highlighting');

        } catch (error) {
            console.error('CRITICAL: Failed to load official BambiSleep triggers:', error);
            // NO FALLBACK - Only use official triggers
            this.triggers = [];
            this.triggerData = {};
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

        // Process each trigger phrase individually with category-based styling
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

                // Get trigger data for enhanced styling
                const upperTrigger = match.toUpperCase();
                const triggerInfo = this.triggerData[upperTrigger] || {};

                // Category-based color scheme
                let triggerColor = this.capsColor; // Default hot pink
                let additionalClasses = 'caps-text';

                switch (triggerInfo.category) {
                    case 'primary':
                        triggerColor = '#ff1493'; // Deep pink for primary triggers
                        additionalClasses += ' trigger-primary';
                        break;
                    case 'mental':
                        triggerColor = '#9932cc'; // Purple for mental triggers
                        additionalClasses += ' trigger-mental';
                        break;
                    case 'physical':
                        triggerColor = '#ff4500'; // Orange-red for physical triggers
                        additionalClasses += ' trigger-physical';
                        break;
                    default:
                        additionalClasses += ' trigger-default';
                }

                // Enhanced highlighting with category info
                return `<span class="${additionalClasses}"
                              style="color: ${triggerColor}; font-weight: bold;"
                              data-trigger="${trigger}"
                              data-category="${triggerInfo.category || 'unknown'}"
                              data-safety="${triggerInfo.safetyLevel || 'unknown'}"
                              title="${triggerInfo.description || 'Official BambiSleep trigger'}">${match}</span>`;
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
