/**
 * BambiSleep Chat - Mobile Interface Controller
 * Handles mobile-specific interactions, navigation, and responsive behavior
 */

class MobileInterface {
    constructor() {
        this.isInitialized = false;
        this.activePanel = null;
        this.isMobile = this.detectMobile();
        this.currentNavItem = 'mobile-chat-btn';
        
        if (this.isMobile) {
            this.init();
        }
    }
    
    detectMobile() {
        return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    init() {
        if (this.isInitialized) return;
        
        console.log('🤖 Initializing Mobile Interface...');
        
        this.setupMobileNavigation();
        this.setupMobilePanels();
        this.setupMobileDropdowns();
        this.setupMobileGestures();
        this.setupResponsiveListeners();
        this.populateMobileContent();
        
        // Set initial active state
        this.setActiveNavItem('mobile-chat-btn');
        
        this.isInitialized = true;
        console.log('✅ Mobile Interface initialized');
    }
    
    setupMobileNavigation() {
        const navButtons = document.querySelectorAll('.mobile-nav-btn');
        
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleNavigation(btn);
            });
            
            // Add touch feedback
            btn.addEventListener('touchstart', () => {
                btn.style.transform = 'scale(0.95)';
            });
            
            btn.addEventListener('touchend', () => {
                setTimeout(() => {
                    btn.style.transform = '';
                }, 150);
            });
        });
    }
    
    handleNavigation(button) {
        const buttonId = button.id;
        
        // Close any open panels first
        this.closeAllPanels();
        
        // Set active navigation item
        this.setActiveNavItem(buttonId);
        
        switch(buttonId) {
            case 'mobile-chat-btn':
                this.showChatMode();
                break;
            case 'mobile-spiral-btn':
                this.togglePanel('mobile-spiral-panel');
                break;
            case 'mobile-triggers-btn':
                this.togglePanel('mobile-triggers-panel');
                break;
            case 'mobile-tts-btn':
                this.togglePanel('mobile-tts-panel');
                break;
            case 'mobile-ai-btn':
                this.togglePanel('mobile-ai-panel');
                break;
        }
    }
    
    setActiveNavItem(activeId) {
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.getElementById(activeId);
        if (activeBtn) {
            activeBtn.classList.add('active');
            this.currentNavItem = activeId;
        }
    }
    
    showChatMode() {
        // Default mode - just close all panels
        this.closeAllPanels();
        
        // Optional: Focus chat input
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            setTimeout(() => chatInput.focus(), 300);
        }
    }
    
    setupMobilePanels() {
        // Setup panel close buttons
        document.querySelectorAll('.mobile-panel-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetPanel = btn.getAttribute('data-target');
                this.closePanel(targetPanel);
                this.setActiveNavItem('mobile-chat-btn');
            });
        });
        
        // Setup panel touch gestures
        document.querySelectorAll('.mobile-panel').forEach(panel => {
            let startY = 0;
            let currentY = 0;
            let isDragging = false;
            
            panel.addEventListener('touchstart', (e) => {
                startY = e.touches[0].clientY;
                isDragging = true;
            });
            
            panel.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                
                currentY = e.touches[0].clientY;
                const deltaY = currentY - startY;
                
                // Allow swipe down to close
                if (deltaY > 50) {
                    panel.style.transform = `translateY(${deltaY}px)`;
                }
            });
            
            panel.addEventListener('touchend', () => {
                if (!isDragging) return;
                
                const deltaY = currentY - startY;
                
                if (deltaY > 100) {
                    // Close panel
                    this.closePanel(panel.id);
                    this.setActiveNavItem('mobile-chat-btn');
                } else {
                    // Snap back
                    panel.style.transform = '';
                }
                
                isDragging = false;
            });
        });
    }
    
    togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        
        if (panel.classList.contains('active')) {
            this.closePanel(panelId);
        } else {
            this.openPanel(panelId);
        }
    }
    
    openPanel(panelId) {
        this.closeAllPanels();
        
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.add('active');
            this.activePanel = panelId;
            
            // Add haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }
    }
    
    closePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.remove('active');
            panel.style.transform = '';
            
            if (this.activePanel === panelId) {
                this.activePanel = null;
            }
        }
    }
    
    closeAllPanels() {
        document.querySelectorAll('.mobile-panel').forEach(panel => {
            panel.classList.remove('active');
            panel.style.transform = '';
        });
        this.activePanel = null;
    }
    
    setupMobileDropdowns() {
        const overlay = document.querySelector('.mobile-dropdown-overlay');
        if (!overlay) return;
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeMobileDropdown();
            }
        });
    }
    
    showMobileDropdown(content) {
        const overlay = document.querySelector('.mobile-dropdown-overlay');
        const contentContainer = document.querySelector('.mobile-dropdown-content');
        
        if (overlay && contentContainer) {
            contentContainer.innerHTML = content;
            overlay.classList.add('active');
        }
    }
    
    closeMobileDropdown() {
        const overlay = document.querySelector('.mobile-dropdown-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }
    
    setupMobileGestures() {
        let touchStartX = 0;
        let touchStartY = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });
        
        document.addEventListener('touchend', (e) => {
            if (!e.changedTouches[0]) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            
            // Detect swipe gestures
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 100) {
                if (deltaX > 0) {
                    // Swipe right
                    this.handleSwipeRight();
                } else {
                    // Swipe left
                    this.handleSwipeLeft();
                }
            }
        });
    }
    
    handleSwipeRight() {
        // Optional: Implement swipe navigation
        console.log('👆 Swipe right detected');
    }
    
    handleSwipeLeft() {
        // Optional: Implement swipe navigation
        console.log('👆 Swipe left detected');
    }
    
    setupResponsiveListeners() {
        window.addEventListener('resize', () => {
            const newIsMobile = this.detectMobile();
            
            if (newIsMobile !== this.isMobile) {
                this.isMobile = newIsMobile;
                
                if (this.isMobile && !this.isInitialized) {
                    this.init();
                } else if (!this.isMobile && this.isInitialized) {
                    this.cleanup();
                }
            }
        });
        
        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });
    }
    
    handleOrientationChange() {
        // Adjust layout for orientation change
        this.closeAllPanels();
        this.setActiveNavItem('mobile-chat-btn');
        
        // Reset any transforms
        document.querySelectorAll('.mobile-panel').forEach(panel => {
            panel.style.transform = '';
        });
    }
    
    populateMobileContent() {
        this.populateTriggerCategories();
        this.populateVoiceOptions();
        this.setupMobileControls();
    }
    
    populateTriggerCategories() {
        const container = document.querySelector('.mobile-trigger-categories');
        if (!container) return;
        
        // Get triggers from the global window object if available
        if (window.triggerData && window.triggerData.categories) {
            container.innerHTML = '';
            
            Object.keys(window.triggerData.categories).forEach(category => {
                const categoryElement = this.createMobileTriggerCategory(category);
                container.appendChild(categoryElement);
            });
        } else {
            // Fallback loading state
            container.innerHTML = '<div class="mobile-loading">Loading triggers...</div>';
            
            // Try to load triggers after a delay
            setTimeout(() => {
                this.populateTriggerCategories();
            }, 1000);
        }
    }
    
    createMobileTriggerCategory(category) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'mobile-trigger-category';
        
        const triggers = window.triggerData.triggers.filter(trigger => trigger.category === category);
        
        categoryDiv.innerHTML = `
            <div class="mobile-category-header">
                <h4 class="mobile-category-title">${category.charAt(0).toUpperCase() + category.slice(1)}</h4>
                <span class="mobile-category-toggle">▼</span>
            </div>
            <div class="mobile-trigger-buttons">
                ${triggers.map(trigger => `
                    <button class="mobile-trigger-btn" data-trigger="${trigger.name}">
                        ${trigger.name}
                    </button>
                `).join('')}
            </div>
        `;
        
        // Add click handler for category toggle
        const header = categoryDiv.querySelector('.mobile-category-header');
        header.addEventListener('click', () => {
            categoryDiv.classList.toggle('expanded');
        });
        
        // Add click handlers for trigger buttons
        categoryDiv.querySelectorAll('.mobile-trigger-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.toggleTrigger(btn);
            });
        });
        
        return categoryDiv;
    }
    
    toggleTrigger(button) {
        button.classList.toggle('active');
        
        const triggerName = button.getAttribute('data-trigger');
        console.log(`🎯 Trigger ${button.classList.contains('active') ? 'activated' : 'deactivated'}: ${triggerName}`);
        
        // Add haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(30);
        }
        
        // Update global trigger state if available
        if (window.updateTriggers) {
            window.updateTriggers();
        }
    }
    
    populateVoiceOptions() {
        const container = document.querySelector('.mobile-voice-selector');
        if (!container) return;
        
        const voices = [
            'af_alloy', 'af_aoede', 'af_bella', 'af_heart', 
            'af_jadzia', 'af_jessica', 'af_kore', 'af_nicole', 
            'af_nova', 'af_river', 'af_sarah', 'af_sky'
        ];
        
        container.innerHTML = voices.map(voice => `
            <button class="mobile-voice-btn" data-voice="${voice}">
                ${voice.replace('af_', '').charAt(0).toUpperCase() + voice.replace('af_', '').slice(1)}
            </button>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.mobile-voice-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectVoice(btn);
            });
        });
    }
    
    selectVoice(button) {
        // Remove active from all voice buttons
        document.querySelectorAll('.mobile-voice-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active to selected button
        button.classList.add('active');
        
        const voice = button.getAttribute('data-voice');
        console.log(`🔊 Voice selected: ${voice}`);
        
        // Add haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
        
        // Update global voice setting if available
        if (window.setVoice) {
            window.setVoice(voice);
        }
    }
    
    setupMobileControls() {
        // Setup spiral controls
        document.querySelectorAll('.mobile-spiral-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleSpiralControl(btn);
            });
        });
        
        // Setup collar controls
        document.querySelectorAll('.mobile-collar-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleCollarControl(btn);
            });
        });
    }
    
    handleSpiralControl(button) {
        const action = button.getAttribute('data-action');
        console.log(`🌀 Spiral action: ${action}`);
        
        // Add visual feedback
        button.classList.add('active');
        setTimeout(() => {
            button.classList.remove('active');
        }, 300);
        
        // Add haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
        
        // Call appropriate function based on action
        switch(action) {
            case 'toggle-spiral':
                if (window.toggleSpiral) window.toggleSpiral();
                break;
            case 'speed-up':
                if (window.adjustSpiralSpeed) window.adjustSpiralSpeed(1.2);
                break;
            case 'slow-down':
                if (window.adjustSpiralSpeed) window.adjustSpiralSpeed(0.8);
                break;
            case 'reverse':
                if (window.reverseSpiralDirection) window.reverseSpiralDirection();
                break;
            case 'brainwash-mode':
                if (window.toggleBrainwashMode) window.toggleBrainwashMode();
                button.classList.add('active');
                break;
        }
    }
    
    handleCollarControl(button) {
        const isActivate = button.classList.contains('activate');
        console.log(`🔗 Collar ${isActivate ? 'activated' : 'deactivated'}`);
        
        // Add visual feedback
        button.classList.add('active');
        setTimeout(() => {
            button.classList.remove('active');
        }, 300);
        
        // Add haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }
        
        if (isActivate) {
            const textarea = document.querySelector('.mobile-collar-textarea');
            const text = textarea ? textarea.value : '';
            
            if (window.activateCollar) {
                window.activateCollar(text);
            }
        } else {
            if (window.deactivateCollar) {
                window.deactivateCollar();
            }
        }
    }
    
    // Public methods for integration with main app
    enterImmersiveMode() {
        document.body.classList.add('mobile-immersive');
        this.closeAllPanels();
    }
    
    exitImmersiveMode() {
        document.body.classList.remove('mobile-immersive');
    }
    
    showNotification(message, type = 'info') {
        // Simple mobile notification system
        const notification = document.createElement('div');
        notification.className = `mobile-notification mobile-notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--mobile-dark);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            border: 2px solid var(--mobile-accent);
            z-index: 10000;
            animation: mobileNotificationSlide 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    cleanup() {
        // Cleanup when switching from mobile to desktop
        this.closeAllPanels();
        this.isInitialized = false;
        document.body.classList.remove('mobile-immersive');
    }
}

// Initialize mobile interface when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.mobileInterface = new MobileInterface();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileInterface;
}