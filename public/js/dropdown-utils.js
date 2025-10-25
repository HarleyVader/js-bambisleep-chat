/**
 * Enhanced Dropdown Utilities
 * Provides advanced interaction features for dropdowns
 */

export class DropdownUtils {
    static init() {
        // Add enhanced interaction classes to existing dropdowns
        this.enhanceDropdowns();
        // Set up keyboard navigation
        this.setupKeyboardNavigation();
        // Add click outside to close functionality
        this.setupClickOutsideClose();
    }

    static enhanceDropdowns() {
        const dropdowns = document.querySelectorAll('.dropdown');

        dropdowns.forEach(dropdown => {
            const button = dropdown.querySelector('.dropdown-btn, .dropdown-button');
            const content = dropdown.querySelector('.dropdown-content');

            if (button && content) {
                // Add utility classes
                button.classList.add('smooth-transition', 'enhanced-focus', 'click-feedback');
                content.classList.add('smooth-transition');

                // Add enhanced click handling
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleDropdown(dropdown);
                });

                // Add hover effects
                button.addEventListener('mouseenter', () => {
                    if (!button.classList.contains('glow-effect')) {
                        button.classList.add('glow-effect');
                    }
                });

                // Add items interaction
                const items = content.querySelectorAll('.dropdown-item, [class*="item"], button, select, input');
                items.forEach(item => {
                    item.classList.add('smooth-transition');

                    item.addEventListener('mouseenter', () => {
                        // Remove highlight from siblings
                        items.forEach(sibling => sibling.classList.remove('highlighted'));
                        // Add highlight to current item
                        item.classList.add('highlighted');
                    });

                    item.addEventListener('mouseleave', () => {
                        item.classList.remove('highlighted');
                    });
                });
            }
        });
    }

    static toggleDropdown(dropdown) {
        const content = dropdown.querySelector('.dropdown-content');
        const isActive = dropdown.classList.contains('active');

        // Close all other dropdowns first
        document.querySelectorAll('.dropdown.active').forEach(activeDropdown => {
            if (activeDropdown !== dropdown) {
                this.closeDropdown(activeDropdown);
            }
        });

        if (isActive) {
            this.closeDropdown(dropdown);
        } else {
            this.openDropdown(dropdown);
        }
    }

    static openDropdown(dropdown) {
        const content = dropdown.querySelector('.dropdown-content');
        const button = dropdown.querySelector('.dropdown-btn, .dropdown-button');

        if (content && button) {
            // Activate dropdown FIRST to make content visible for measurement
            dropdown.classList.add('active');

            // Force reflow to ensure content is rendered
            content.offsetHeight;

            // Now position dropdown relative to button (since dropdown-content is now position: fixed)
            const buttonRect = button.getBoundingClientRect();
            const contentRect = content.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Calculate initial position
            let top = buttonRect.bottom + 4;
            let left = buttonRect.left;

            // Adjust horizontal position if off-screen
            if (left + contentRect.width > viewportWidth) {
                left = Math.max(10, viewportWidth - contentRect.width - 10);
            }

            // Adjust vertical position if off-screen (show above button instead)
            if (top + contentRect.height > viewportHeight) {
                top = Math.max(10, buttonRect.top - contentRect.height - 4);
            }

            // Apply final position
            content.style.top = `${top}px`;
            content.style.left = `${left}px`;

            // Add entering animation
            content.classList.add('dropdown-entering');
            content.classList.remove('dropdown-leaving');

            // Remove entering animation after completion
            setTimeout(() => {
                content.classList.remove('dropdown-entering');
            }, 200);

            // Focus first focusable element
            const firstFocusable = content.querySelector('button, input, select, [tabindex]:not([tabindex="-1"])');
            if (firstFocusable) {
                setTimeout(() => firstFocusable.focus(), 100);
            }
        }
    }

    static closeDropdown(dropdown) {
        const content = dropdown.querySelector('.dropdown-content');

        if (content) {
            // Add leaving animation
            content.classList.add('dropdown-leaving');
            content.classList.remove('dropdown-entering');

            // Remove active state after animation
            setTimeout(() => {
                dropdown.classList.remove('active');
                content.classList.remove('dropdown-leaving');
            }, 200);
        }
    }

    static setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            const activeDropdown = document.querySelector('.dropdown.active');
            if (!activeDropdown) return;

            const items = activeDropdown.querySelectorAll('.dropdown-item, button, input, select');
            const highlightedItem = activeDropdown.querySelector('.highlighted');

            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    this.closeDropdown(activeDropdown);
                    // Return focus to dropdown button
                    const button = activeDropdown.querySelector('.dropdown-btn, .dropdown-button');
                    if (button) button.focus();
                    break;

                case 'ArrowDown':
                    e.preventDefault();
                    this.navigateItems(items, highlightedItem, 1);
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    this.navigateItems(items, highlightedItem, -1);
                    break;

                case 'Enter':
                case ' ':
                    if (highlightedItem && highlightedItem.classList.contains('dropdown-item')) {
                        e.preventDefault();
                        highlightedItem.click();
                    }
                    break;
            }
        });
    }

    static navigateItems(items, currentItem, direction) {
        if (items.length === 0) return;

        let currentIndex = currentItem ? Array.from(items).indexOf(currentItem) : -1;
        let nextIndex = currentIndex + direction;

        // Wrap around
        if (nextIndex >= items.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = items.length - 1;

        // Remove current highlight
        if (currentItem) currentItem.classList.remove('highlighted');

        // Add new highlight
        const nextItem = items[nextIndex];
        if (nextItem) {
            nextItem.classList.add('highlighted');
            nextItem.focus();
        }
    }

    static setupClickOutsideClose() {
        document.addEventListener('click', (e) => {
            const activeDropdowns = document.querySelectorAll('.dropdown.active');

            activeDropdowns.forEach(dropdown => {
                if (!dropdown.contains(e.target)) {
                    this.closeDropdown(dropdown);
                }
            });
        });

        // Reposition dropdowns on scroll and resize
        window.addEventListener('scroll', () => {
            this.repositionActiveDropdowns();
        }, { passive: true });

        window.addEventListener('resize', () => {
            this.repositionActiveDropdowns();
        });
    }

    static repositionActiveDropdowns() {
        const activeDropdowns = document.querySelectorAll('.dropdown.active');
        activeDropdowns.forEach(dropdown => {
            const content = dropdown.querySelector('.dropdown-content');
            const button = dropdown.querySelector('.dropdown-btn, .dropdown-button');

            if (content && button) {
                const buttonRect = button.getBoundingClientRect();
                content.style.top = `${buttonRect.bottom + 4}px`;
                content.style.left = `${buttonRect.left}px`;

                // Adjust if dropdown would go off-screen
                const contentRect = content.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                if (contentRect.right > viewportWidth) {
                    content.style.left = `${viewportWidth - contentRect.width - 10}px`;
                }

                if (contentRect.bottom > viewportHeight) {
                    content.style.top = `${buttonRect.top - contentRect.height - 4}px`;
                }
            }
        });
    }

    // Utility method to add visual feedback
    static addVisualFeedback(element, type = 'success') {
        const feedback = document.createElement('div');
        feedback.className = `visual-feedback ${type}`;
        feedback.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: ${type === 'success' ? '#00ff88' : '#ff4444'};
            animation: feedbackPulse 0.6s ease-out;
            pointer-events: none;
            z-index: 1000;
        `;

        element.style.position = 'relative';
        element.appendChild(feedback);

        setTimeout(() => {
            feedback.remove();
        }, 600);
    }
}

// CSS for visual feedback animation
const style = document.createElement('style');
style.textContent = `
    @keyframes feedbackPulse {
        0% { transform: scale(0); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.8; }
        100% { transform: scale(0); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DropdownUtils.init());
} else {
    DropdownUtils.init();
}
