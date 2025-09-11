// effects.js - Simple CAPS text font color and glitch effects
class TextEffects {
    constructor() {
        this.capsColor = '#df0471'; // Hot pink color for CAPS text
        this.init();
    }

    init() {
        console.log('TextEffects initialized - Simple CAPS color system');
    }

    // Process AI response and highlight CAPS text with simple color change
    processAIResponse(text) {        
        // Find all **text** patterns and process them
        return text.replace(/\*\*([^*]+)\*\*/g, (match, content) => {
            return this.createHighlightedSpan(content);
        });
    }

    // Create highlighted span with font color change for CAPS
    createHighlightedSpan(text) {
        const isAllCaps = this.isAllCaps(text);

        if (isAllCaps) {
            return `<span class="caps-text" style="color: ${this.capsColor};" data-text="${text}">${text}</span>`;
        } else {
            return `<span class="ai-generated-highlight">${text}</span>`;
        }
    }

    // Check if text is all caps
    isAllCaps(text) {
        // Allow uppercase letters, spaces, and common punctuation
        return /^[A-Z\s\-!'.,;:?]*$/.test(text) && /[A-Z]/.test(text);
    }

    // Apply glitch effect to CAPS text
    applyGlitchEffect(element) {
        element.classList.add('glitch-active');

        // Remove glitch after animation duration
        setTimeout(() => {
            element.classList.remove('glitch-active');
        }, 600);
    }

    // Main processing function called by aigf-core
    processMessage(text, isAI = false) {
        if (!isAI) {
            return text;
        }

        // Process AI message for CAPS color change
        const processedText = this.processAIResponse(text);

        // Schedule glitch effects to be applied after DOM update
        setTimeout(() => {
            const capsElements = document.querySelectorAll('.caps-text:not(.glitch-processed)');
            capsElements.forEach((element, index) => {
                // Mark as processed to avoid re-applying effects
                element.classList.add('glitch-processed');
                
                // Stagger glitch effects
                setTimeout(() => {
                    this.applyGlitchEffect(element);
                }, index * 200);
            });
        }, 150); // Increased delay to ensure DOM is fully updated

        return processedText;
    }
}

// Initialize global text effects system
window.textEffects = new TextEffects();

console.log('Simple TextEffects system loaded');
