/**
 * Central Animation Controller for BambiSleep Chat
 * Prevents visual stuttering from concurrent animations
 * Manages animation queue and conflict resolution using CSS layers priority
 */

class AnimationController {
    constructor() {
        this.activeAnimations = new Map(); // Track currently running animations
        this.animationQueue = []; // Queue for pending animations
        this.animationPriorities = {
            'critical': 100,   // Critical system animations (errors, alerts)
            'tts': 80,         // TTS animations (speech display, voice feedback)
            'dropdown': 70,    // Dropdown open/close animations
            'trigger': 60,     // Trigger highlight animations
            'interface': 40,   // General UI animations (button states, etc.)
            'background': 20   // Background effects (spirals, etc.)
        };
        this.maxConcurrentAnimations = 3; // Limit concurrent animations
        this.init();
    }

    init() {
        // Set up animation frame monitoring
        this.animationFrame = null;
        this.isProcessing = false;

        // Listen for custom animation events
        document.addEventListener('animationRequest', (e) => {
            this.handleAnimationRequest(e.detail);
        });

        // Monitor for CSS animation events
        document.addEventListener('animationstart', this.handleAnimationStart.bind(this));
        document.addEventListener('animationend', this.handleAnimationEnd.bind(this));
        document.addEventListener('animationcancel', this.handleAnimationCancel.bind(this));

        console.log('✅ Animation Controller initialized');
    }

    /**
     * Request an animation with priority and conflict resolution
     * @param {Object} options - Animation options
     * @param {string} options.id - Unique animation identifier
     * @param {string} options.type - Animation type/category
     * @param {number} options.priority - Animation priority (0-100)
     * @param {HTMLElement} options.element - Target element
     * @param {string} options.animation - CSS animation name or class
     * @param {number} options.duration - Animation duration in ms
     * @param {boolean} options.canInterrupt - Whether this animation can be interrupted
     * @param {Function} options.onStart - Callback when animation starts
     * @param {Function} options.onEnd - Callback when animation ends
     */
    requestAnimation(options) {
        const {
            id,
            type = 'interface',
            priority = this.animationPriorities[type] || 40,
            element,
            animation,
            duration = 300,
            canInterrupt = true,
            onStart = null,
            onEnd = null
        } = options;

        if (!id || !element || !animation) {
            console.warn('⚠️ Invalid animation request:', options);
            return false;
        }

        // Check for conflicts with existing animations
        const existingAnimation = this.activeAnimations.get(id);
        if (existingAnimation) {
            if (existingAnimation.priority >= priority && !existingAnimation.canInterrupt) {
                console.log(`🔄 Animation ${id} blocked by higher priority animation`);
                return false;
            } else {
                // Cancel existing animation
                this.cancelAnimation(id);
            }
        }

        const animationRequest = {
            id,
            type,
            priority,
            element,
            animation,
            duration,
            canInterrupt,
            onStart,
            onEnd,
            timestamp: Date.now()
        };

        // Add to queue or start immediately
        if (this.activeAnimations.size < this.maxConcurrentAnimations) {
            this.startAnimation(animationRequest);
        } else {
            this.queueAnimation(animationRequest);
        }

        return true;
    }

    /**
     * Start an animation immediately
     */
    startAnimation(animationRequest) {
        const { id, element, animation, duration, onStart, onEnd } = animationRequest;

        // Store in active animations
        this.activeAnimations.set(id, {
            ...animationRequest,
            startTime: performance.now()
        });

        // Apply animation
        if (animation.startsWith('.')) {
            // CSS class animation
            element.classList.add(animation.substring(1));
        } else {
            // CSS animation name
            element.style.animation = animation;
        }

        // Call start callback
        if (onStart) {
            try {
                onStart();
            } catch (error) {
                console.error(`❌ Animation ${id} start callback failed:`, error);
            }
        }

        // Set up end handler
        const cleanup = () => {
            this.handleAnimationComplete(id);
            if (onEnd) {
                try {
                    onEnd();
                } catch (error) {
                    console.error(`❌ Animation ${id} end callback failed:`, error);
                }
            }
        };

        // Automatic cleanup after duration + buffer - track timeout for cleanup
        const timeoutId = setTimeout(cleanup, duration + 100);

        // Store timeout ID for proper cleanup
        if (this.activeAnimations.has(id)) {
            const animation = this.activeAnimations.get(id);
            animation.timeoutId = timeoutId;
            this.activeAnimations.set(id, animation);
        }

        console.log(`🎬 Animation ${id} started (priority: ${animationRequest.priority})`);
    }

    /**
     * Queue an animation for later execution
     */
    queueAnimation(animationRequest) {
        // Insert into queue based on priority
        const insertIndex = this.animationQueue.findIndex(
            item => item.priority < animationRequest.priority
        );

        if (insertIndex === -1) {
            this.animationQueue.push(animationRequest);
        } else {
            this.animationQueue.splice(insertIndex, 0, animationRequest);
        }

        console.log(`⏳ Animation ${animationRequest.id} queued (position: ${insertIndex + 1})`);
        this.processQueue();
    }

    /**
     * Process the animation queue
     */
    processQueue() {
        if (this.isProcessing || this.animationQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        // Check if we can start more animations
        while (
            this.animationQueue.length > 0 &&
            this.activeAnimations.size < this.maxConcurrentAnimations
        ) {
            const nextAnimation = this.animationQueue.shift();
            this.startAnimation(nextAnimation);
        }

        this.isProcessing = false;
    }

    /**
     * Cancel an animation
     */
    cancelAnimation(id) {
        const animation = this.activeAnimations.get(id);
        if (!animation) {
            console.warn(`⚠️ Cannot cancel animation ${id}: not found`);
            return false;
        }

        const { element, animation: animationName } = animation;

        // Remove animation
        if (animationName.startsWith('.')) {
            element.classList.remove(animationName.substring(1));
        } else {
            element.style.animation = '';
        }

        // Clean up
        this.activeAnimations.delete(id);
        this.processQueue();

        console.log(`🛑 Animation ${id} cancelled`);
        return true;
    }

    /**
     * Handle animation completion
     */
    handleAnimationComplete(id) {
        const animation = this.activeAnimations.get(id);
        if (!animation) return;

        const { element, animation: animationName } = animation;

        // Clean up animation
        if (animationName.startsWith('.')) {
            element.classList.remove(animationName.substring(1));
        } else {
            element.style.animation = '';
        }

        // Remove from active animations
        this.activeAnimations.delete(id);

        // Process queue for next animations
        this.processQueue();

        console.log(`✅ Animation ${id} completed`);
    }

    /**
     * Event handlers for native CSS animations
     */
    handleAnimationStart(event) {
        const element = event.target;
        const animationName = event.animationName;
        console.log(`🎬 CSS Animation started: ${animationName} on`, element);
    }

    handleAnimationEnd(event) {
        const element = event.target;
        const animationName = event.animationName;
        console.log(`✅ CSS Animation ended: ${animationName} on`, element);
    }

    handleAnimationCancel(event) {
        const element = event.target;
        const animationName = event.animationName;
        console.log(`🛑 CSS Animation cancelled: ${animationName} on`, element);
    }

    /**
     * Handle custom animation requests from events
     */
    handleAnimationRequest(detail) {
        this.requestAnimation(detail);
    }

    /**
     * Utility methods for common animations
     */

    // TTS animations
    playTTSAnimation(element, text) {
        return this.requestAnimation({
            id: 'tts-display',
            type: 'tts',
            element: element,
            animation: 'ttsPulse 0.5s ease-in-out infinite alternate',
            duration: 2000,
            canInterrupt: true,
            onStart: () => {
                element.textContent = text;
                element.style.display = 'block';
            },
            onEnd: () => {
                element.style.display = 'none';
            }
        });
    }

    // Dropdown animations
    openDropdown(element) {
        return this.requestAnimation({
            id: `dropdown-${element.id}`,
            type: 'dropdown',
            element: element,
            animation: '.dropdown-entering',
            duration: 200,
            canInterrupt: false
        });
    }

    closeDropdown(element) {
        return this.requestAnimation({
            id: `dropdown-${element.id}`,
            type: 'dropdown',
            element: element,
            animation: '.dropdown-leaving',
            duration: 200,
            canInterrupt: false
        });
    }

    // Trigger animations
    highlightTrigger(element, triggerText) {
        return this.requestAnimation({
            id: `trigger-${Date.now()}`,
            type: 'trigger',
            element: element,
            animation: 'flashTrigger 1s ease-in-out',
            duration: 1000,
            canInterrupt: true
        });
    }

    // Button feedback animations
    buttonFeedback(element, message) {
        return this.requestAnimation({
            id: `button-${element.id || Date.now()}`,
            type: 'interface',
            element: element,
            animation: '.pulse',
            duration: 300,
            canInterrupt: true
        });
    }

    /**
     * Pause all animations (for performance)
     */
    pauseAll() {
        this.activeAnimations.forEach((animation, id) => {
            const { element } = animation;
            element.style.animationPlayState = 'paused';
        });
        console.log('⏸️ All animations paused');
    }

    /**
     * Resume all animations
     */
    resumeAll() {
        this.activeAnimations.forEach((animation, id) => {
            const { element } = animation;
            element.style.animationPlayState = 'running';
        });
        console.log('▶️ All animations resumed');
    }

    /**
     * Get current animation status
     */
    getStatus() {
        return {
            active: this.activeAnimations.size,
            queued: this.animationQueue.length,
            maxConcurrent: this.maxConcurrentAnimations,
            activeAnimations: Array.from(this.activeAnimations.keys())
        };
    }

    /**
     * Clear all animations (emergency stop)
     */
    clearAll() {
        // Cancel all active animations
        this.activeAnimations.forEach((animation, id) => {
            this.cancelAnimation(id);
        });

        // Clear queue
        this.animationQueue.length = 0;

        console.log('🚨 All animations cleared');
    }

    /**
     * Cleanup method for proper memory management
     * Cancels all active animations and clears timers
     */
    cleanup() {
        console.log('🧹 Cleaning up Animation Controller...');

        // Cancel all active animations with proper cleanup
        this.activeAnimations.forEach((animation, id) => {
            const { element, timeoutId, animationFrameId } = animation;

            // Clear any timeouts
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            // Cancel any animation frames
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }

            // Reset element styles
            if (element) {
                element.style.animation = '';
                element.classList.remove('dropdown-entering', 'dropdown-leaving');
            }
        });

        // Clear all data structures
        this.activeAnimations.clear();
        this.animationQueue.length = 0;

        console.log('✅ Animation Controller cleanup complete');
    }

    /**
     * Enhanced cancel animation with proper cleanup
     */
    cancelAnimationFrame(id) {
        const animation = this.activeAnimations.get(id);
        if (animation) {
            // Clear timeout if exists
            if (animation.timeoutId) {
                clearTimeout(animation.timeoutId);
            }

            // Cancel animation frame if exists
            if (animation.animationFrameId) {
                cancelAnimationFrame(animation.animationFrameId);
            }

            // Reset element
            if (animation.element) {
                animation.element.style.animation = '';
                animation.element.classList.remove('dropdown-entering', 'dropdown-leaving');
            }

            // Remove from active animations
            this.activeAnimations.delete(id);

            console.log(`🚫 Animation ${id} cancelled with cleanup`);
            return true;
        }
        return false;
    }
}

// Initialize global animation controller
document.addEventListener('DOMContentLoaded', () => {
    if (!window.animationController) {
        window.animationController = new AnimationController();
        console.log('✅ Global Animation Controller ready');
    }
});

// Export for module use
export default AnimationController;
