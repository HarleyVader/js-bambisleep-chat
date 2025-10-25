// effects.js - TRIGGER PHRASE ONLY highlighting system
class TextEffects {
    constructor() {
        this.capsColor = '#df0471'; // Hot pink color for trigger phrases ONLY
        this.triggers = [];
        this.chatVisible = true; // Track chat container visibility
        this.loadTriggers();
        this.init();
        this.initChatToggle();
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
        } catch (error) {
            console.error('CRITICAL: Failed to load official BambiSleep triggers:', error);
            // NO FALLBACK - Only use official triggers
            this.triggers = [];
            this.triggerData = {};
        }
    }

    init() {
        // Initialization complete - no logging needed
    }

    // Initialize chat container toggle functionality
    initChatToggle() {
        this.createToggleButton();
        this.setupToggleEvents();
        this.initializeStates();
    }

    // Initialize default states
    initializeStates() {
        const chatContainer = document.getElementById('chat-container');
        const spiralContainer = document.getElementById('spiral-container');

        if (chatContainer && spiralContainer) {
            // Set initial visible state
            chatContainer.classList.add('chat-visible');
            spiralContainer.classList.add('spiral-normal');
        }
    }

    // Create the toggle button outside chat container
    createToggleButton() {
        const toggleButton = document.createElement('div');
        toggleButton.id = 'chat-toggle-button';
        toggleButton.innerHTML = '<';
        toggleButton.className = 'chat-toggle-btn';
        toggleButton.title = 'Hide/Show Chat';

        // Insert button right after chat-container
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer && chatContainer.parentNode) {
            chatContainer.parentNode.insertBefore(toggleButton, chatContainer.nextSibling);
        }
    }

    // Setup toggle button events
    setupToggleEvents() {
        const toggleButton = document.getElementById('chat-toggle-button');
        const chatContainer = document.getElementById('chat-container');

        if (!toggleButton || !chatContainer) return;

        toggleButton.addEventListener('click', () => {
            this.toggleChatContainer();
        });

        // Add keyboard shortcut (Ctrl+H)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                this.toggleChatContainer();
            }
        });
    }

    // Toggle chat container visibility with sliding animation
    toggleChatContainer() {
        const chatContainer = document.getElementById('chat-container');
        const toggleButton = document.getElementById('chat-toggle-button');
        const spiralContainer = document.getElementById('spiral-container');

        if (!chatContainer || !toggleButton || !spiralContainer) return;

        this.chatVisible = !this.chatVisible;

        if (this.chatVisible) {
            // Show chat container
            chatContainer.classList.remove('chat-hidden');
            chatContainer.classList.add('chat-visible');
            toggleButton.innerHTML = '<';
            toggleButton.title = 'Hide Chat';
            toggleButton.style.left = '30vw';

            // Adjust spiral container
            spiralContainer.classList.remove('spiral-expanded');
            spiralContainer.classList.add('spiral-normal');

        } else {
            // Hide chat container
            chatContainer.classList.remove('chat-visible');
            chatContainer.classList.add('chat-hidden');
            toggleButton.innerHTML = '>';
            toggleButton.title = 'Show Chat';
            toggleButton.style.left = '0';

            // Expand spiral container
            spiralContainer.classList.remove('spiral-normal');
            spiralContainer.classList.add('spiral-expanded');
        }

        console.log('Chat container toggled:', this.chatVisible ? 'visible' : 'hidden');
    }    // Process AI response and highlight ONLY trigger phrases - NOTHING ELSE
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
                        triggerColor = '#ff1482e5'; // Deep pink for primary triggers
                        additionalClasses += ' trigger-primary';
                        break;
                    case 'mental':
                        triggerColor = '#a032cce7'; // Purple for mental triggers
                        additionalClasses += ' trigger-mental';
                        break;
                    case 'physical':
                        triggerColor = '#00ffffe7'; // Orange-red for physical triggers
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
