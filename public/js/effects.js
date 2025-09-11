// effects.js - Advanced text effects and highlighting system
class TextEffects {
    constructor() {
        this.animationId = 0;
        this.colorPalette = [
            '#df0471', // Hot pink (primary)
            '#cc0174', // Bright pink
            '#ff1493', // Deep pink
            '#ff69b4', // Hot pink variant
            '#ff0080', // Electric pink
            '#e91e63', // Material pink
            '#f50057', // Pink accent
        ];
        this.init();
    }

    init() {
        console.log('TextEffects initialized');
    }

    // Process AI response and highlight CAPS text with effects
    processAIResponse(text) {
        // Find all **text** patterns and process them
        return text.replace(/\*\*([^*]+)\*\*/g, (match, content) => {
            return this.createHighlightedSpan(content);
        });
    }

    // Create highlighted span with special effects for CAPS
    createHighlightedSpan(text) {
        const isAllCaps = this.isAllCaps(text);
        
        if (isAllCaps) {
            return this.createCapsHighlight(text);
        } else {
            return `<span class="ai-generated-highlight">${text}</span>`;
        }
    }

    // Check if text is all caps
    isAllCaps(text) {
        // Allow uppercase letters, spaces, and common punctuation
        return /^[A-Z\s\-!'.,;:?]*$/.test(text) && /[A-Z]/.test(text);
    }

    // Create enhanced CAPS highlight with individual letter effects
    createCapsHighlight(text) {
        const letters = text.split('');
        const highlightedLetters = letters.map((char, index) => {
            if (/[A-Z]/.test(char)) {
                // Create individual letter spans with staggered animations
                const delay = index * 100; // 100ms delay between letters
                const colorIndex = index % this.colorPalette.length;
                const color = this.colorPalette[colorIndex];
                
                return `<span class="caps-letter" 
                            style="--animation-delay: ${delay}ms; --letter-color: ${color};"
                            data-letter="${char}">${char}</span>`;
            } else {
                // Spaces and punctuation
                return `<span class="caps-space">${char}</span>`;
            }
        }).join('');

        return `<span class="ai-generated-caps-container">${highlightedLetters}</span>`;
    }

    // Apply rainbow color cycle to CAPS text
    startRainbowEffect(element) {
        const letters = element.querySelectorAll('.caps-letter');
        let colorIndex = 0;

        const cycleColors = () => {
            letters.forEach((letter, index) => {
                const currentColorIndex = (colorIndex + index) % this.colorPalette.length;
                letter.style.setProperty('--letter-color', this.colorPalette[currentColorIndex]);
            });
            colorIndex = (colorIndex + 1) % this.colorPalette.length;
        };

        // Start color cycling
        setInterval(cycleColors, 300);
    }

    // Apply glitch effect to CAPS text
    applyGlitchEffect(element) {
        const letters = element.querySelectorAll('.caps-letter');
        
        letters.forEach((letter, index) => {
            setTimeout(() => {
                letter.classList.add('glitch-effect');
                
                // Remove glitch after random duration
                setTimeout(() => {
                    letter.classList.remove('glitch-effect');
                }, Math.random() * 500 + 200);
            }, index * 150);
        });
    }

    // Apply wave animation to CAPS text
    applyWaveEffect(element) {
        const letters = element.querySelectorAll('.caps-letter');
        
        letters.forEach((letter, index) => {
            setTimeout(() => {
                letter.classList.add('wave-effect');
                
                setTimeout(() => {
                    letter.classList.remove('wave-effect');
                }, 1000);
            }, index * 100);
        });
    }

    // Apply pulsing effect to individual letters
    applyPulseEffect(element) {
        const letters = element.querySelectorAll('.caps-letter');
        
        letters.forEach((letter, index) => {
            const delay = index * 50;
            letter.style.animationDelay = `${delay}ms`;
            letter.classList.add('pulse-effect');
        });
    }

    // Create typing effect for CAPS text
    createTypingEffect(element, text, callback) {
        element.innerHTML = '';
        const letters = text.split('');
        let currentIndex = 0;

        const typeNextLetter = () => {
            if (currentIndex < letters.length) {
                const char = letters[currentIndex];
                if (/[A-Z]/.test(char)) {
                    const colorIndex = currentIndex % this.colorPalette.length;
                    const color = this.colorPalette[colorIndex];
                    element.innerHTML += `<span class="caps-letter typing-letter" 
                                            style="--letter-color: ${color};">${char}</span>`;
                } else {
                    element.innerHTML += `<span class="caps-space">${char}</span>`;
                }
                currentIndex++;
                setTimeout(typeNextLetter, 100);
            } else if (callback) {
                callback();
            }
        };

        typeNextLetter();
    }

    // Enhanced screen flash for CAPS triggers
    flashScreenForCaps(intensity = 1) {
        const flashOverlay = document.createElement('div');
        flashOverlay.className = 'caps-screen-flash';
        flashOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(45deg, 
                rgba(223, 4, 113, ${0.3 * intensity}), 
                rgba(255, 20, 147, ${0.4 * intensity}), 
                rgba(204, 1, 116, ${0.3 * intensity}));
            z-index: 9999;
            pointer-events: none;
            animation: capsFlash ${0.6 / intensity}s ease-out;
        `;

        document.body.appendChild(flashOverlay);

        setTimeout(() => {
            if (flashOverlay.parentNode) {
                document.body.removeChild(flashOverlay);
            }
        }, 600 / intensity);
    }

    // Apply random effects to CAPS containers
    enhanceCapsContainers() {
        const capsContainers = document.querySelectorAll('.ai-generated-caps-container');
        
        capsContainers.forEach((container, index) => {
            // Add random effects with delays
            setTimeout(() => {
                const effects = ['rainbow', 'pulse', 'wave'];
                const randomEffect = effects[Math.floor(Math.random() * effects.length)];
                
                switch (randomEffect) {
                    case 'rainbow':
                        this.startRainbowEffect(container);
                        break;
                    case 'pulse':
                        this.applyPulseEffect(container);
                        break;
                    case 'wave':
                        this.applyWaveEffect(container);
                        break;
                }
                
                // Flash screen for dramatic effect
                this.flashScreenForCaps(0.8);
            }, index * 200);
        });
    }

    // Main processing function called by aigf-core
    processMessage(text, isAI = false) {
        if (!isAI) {
            return text;
        }

        // Process AI message for enhanced effects
        const processedText = this.processAIResponse(text);
        
        // Schedule effects to be applied after DOM update
        setTimeout(() => {
            this.enhanceCapsContainers();
        }, 100);

        return processedText;
    }
}

// Initialize global text effects system
window.textEffects = new TextEffects();

console.log('TextEffects system loaded');
