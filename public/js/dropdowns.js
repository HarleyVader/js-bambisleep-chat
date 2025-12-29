/**
 * Universal Dropdown Manager for BambiSleep Chat
 * Handles universal dropdown menu interactions and coordinates with component dropdowns
 * Includes enhanced interaction features and animations
 */

import {
  SpiralDropdown,
  TTSDropdown,
  TriggersDropdown,
  CollarDropdown,
  createBrainwaveDropdown,
} from "./dropdowns/index.js";

import { StorageUtils } from "./storage-utils.js";

/**
 * DropdownUtils - Enhanced interaction features
 * Provides advanced animations, keyboard navigation, and positioning
 */
class DropdownUtils {
  static enhanceDropdowns() {
    const dropdowns = document.querySelectorAll(".dropdown");

    dropdowns.forEach((dropdown) => {
      const button = dropdown.querySelector(".dropdown-btn, .dropdown-button");
      const dropdownType = dropdown.getAttribute("data-dropdown");
      const content = document.querySelector(
        `#dropdown-modals .dropdown-content[data-dropdown="${dropdownType}"]`
      );

      if (button) {
        // Add utility classes to button
        button.classList.add(
          "smooth-transition",
          "enhanced-focus",
          "click-feedback"
        );

        // Add hover effects
        button.addEventListener("mouseenter", () => {
          if (!button.classList.contains("glow-effect")) {
            button.classList.add("glow-effect");
          }
        });
      }

      if (content) {
        content.classList.add("smooth-transition");

        // Add items interaction
        const items = content.querySelectorAll(
          '.dropdown-item, [class*="item"], button, select, input'
        );
        items.forEach((item) => {
          item.classList.add("smooth-transition");

          item.addEventListener("mouseenter", () => {
            items.forEach((sibling) => sibling.classList.remove("highlighted"));
            item.classList.add("highlighted");
          });

          item.addEventListener("mouseleave", () => {
            item.classList.remove("highlighted");
          });
        });
      }
    });
  }

  static navigateItems(items, currentItem, direction) {
    if (items.length === 0) return;

    let currentIndex = currentItem
      ? Array.from(items).indexOf(currentItem)
      : -1;
    let nextIndex = currentIndex + direction;

    // Wrap around
    if (nextIndex >= items.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = items.length - 1;

    if (currentItem) currentItem.classList.remove("highlighted");

    const nextItem = items[nextIndex];
    if (nextItem) {
      nextItem.classList.add("highlighted");
      nextItem.focus();
    }
  }

  static repositionActiveDropdowns() {
    // Positioning now handled by CSS (fixed centering at 50%/50% with transform)
    // No inline positioning needed - dropdowns auto-center on screen
  }

  static addVisualFeedback(element, type = "success") {
    // Simplified feedback - no visual effects
    console.log(`✓ ${type}:`, element);

    setTimeout(() => feedback.remove(), 600);
  }
}

class DropdownManager {
  constructor() {
    this.activeDropdown ??= null;
    this.buttonStates ??= {
      "toggle-spiral": "off",
      "toggle-tts": "off",
      "toggle-triggers": "off",
      "toggle-collar": "off",
    };

    // Initialize component dropdowns
    this.components ??= {};
    this.init();
  }

  init() {
    // Initialize StorageUtils protection
    try {
      StorageUtils.init();
    } catch (error) {
      console.error("❌ Error initializing StorageUtils protection:", error);
    }

    // Clean up any invalid localStorage entries on startup
    try {
      StorageUtils.cleanupInvalidEntries();
    } catch (error) {
      console.error("❌ Error during localStorage cleanup:", error);
    }

    // Enhance dropdowns with utility features
    DropdownUtils.enhanceDropdowns();

    // Add universal event listeners
    document.addEventListener("click", this.handleClick.bind(this));
    document.addEventListener("keydown", this.handleKeydown.bind(this));

    // Reposition dropdowns on scroll and resize
    window.addEventListener(
      "scroll",
      () => DropdownUtils.repositionActiveDropdowns(),
      { passive: true }
    );
    window.addEventListener("resize", () =>
      DropdownUtils.repositionActiveDropdowns()
    );

    // Initialize components FIRST, then dropdowns (components must exist before dropdown handlers call populateDropdownContent)
    this.initializeComponents();
    this.initializeDropdowns();
  }

  initializeComponents() {
    try {
      // Initialize each dropdown component
      this.components.spiral = new SpiralDropdown(this);
      this.components.tts = new TTSDropdown(this);
      this.components.triggers = new TriggersDropdown(this);
      this.components.collar = new CollarDropdown(this);

      // Initialize brainwave dropdown content (button is in HTML like others)
      createBrainwaveDropdown();

      // Create brainwave component wrapper for toggle handling
      this.components.brainwave = {
        buttonId: "toggle-brainwave",
        toggleState: (btn) => {
          const currentState = btn.getAttribute("data-state") || "off";
          const newState = currentState === "off" ? "on" : "off";
          const statusIndicator = document.getElementById("brainwave-status");

          btn.setAttribute("data-state", newState);

          // Update status indicator
          if (statusIndicator) {
            statusIndicator.style.color =
              newState === "on" ? "#00ff00" : "#666";
            statusIndicator.textContent = "●";
          }

          // Toggle brainwave generator if available
          if (window.brainwaveGenerator) {
            if (newState === "on") {
              // Will be started when user selects a preset
              console.log("🧠 Brainwave system enabled");
            } else {
              window.brainwaveGenerator.stop();
              console.log("🧠 Brainwave system disabled");
            }
          }

          // Dispatch toggle event
          const event = new CustomEvent("toggleStateChange", {
            detail: {
              buttonId: "toggle-brainwave",
              state: newState,
              buttonName: "BRAINWAVE",
            },
          });
          document.dispatchEvent(event);

          this.showToggleFeedback("BRAINWAVE", newState);
        },
      };
    } catch (error) {
      console.error("❌ Error initializing dropdown components:", error);
    }
  }

  initializeDropdowns() {
    const dropdowns = document.querySelectorAll(".dropdown");
    dropdowns.forEach((dropdown) => {
      const btn = dropdown.querySelector(".dropdown-btn");

      // Set up click handlers for all standard dropdowns (AI and collar have custom handling but now follow same pattern)
      if (btn) {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();

          if (dropdown.classList.contains("active")) {
            this.closeDropdown(dropdown);
          } else {
            this.openDropdown(dropdown);
          }

          // Handle toggle functionality for toggle buttons
          if (btn.classList.contains("toggle-button")) {
            this.handleToggleClick(btn);
          }
        });
      }
    });

    // Add event listeners for dropdown menu items
    const dropdownLinks = document.querySelectorAll(".dropdown-content a");
    dropdownLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleDropdownAction(link);
      });
    });
  }

  handleToggleClick(btn) {
    const buttonId = btn.id;
    const component = this.getComponentForButton(buttonId);

    if (component && component.toggleState) {
      component.toggleState(btn);
    } else {
      // Fallback for buttons without specific components
      this.toggleButtonState(btn);
    }
  }

  getComponentForButton(buttonId) {
    switch (buttonId) {
      case "toggle-spiral":
        return this.components.spiral;
      case "toggle-tts":
        return this.components.tts;
      case "toggle-triggers":
        return this.components.triggers;
      case "toggle-collar":
        return this.components.collar;
      case "toggle-brainwave":
        return this.components.brainwave;
      default:
        return null;
    }
  }

  toggleButtonState(btn) {
    const buttonId = btn.id;
    const currentState = btn.getAttribute("data-state") || "off";
    const newState = currentState === "off" ? "on" : "off";
    const baseName = buttonId.replace("toggle-", "");

    this.buttonStates[buttonId] = newState;
    btn.setAttribute("data-state", newState);

    // Update ONLY the status indicator (preserve button icon and text)
    const statusIndicator =
      btn.querySelector(".status-indicator") ||
      document.getElementById(`${baseName}-status`);
    if (statusIndicator) {
      statusIndicator.style.color = newState === "on" ? "#00ff00" : "#666";
      statusIndicator.textContent = "●";
    }

    // Dispatch custom event
    const event = new CustomEvent("toggleStateChange", {
      detail: {
        buttonId: buttonId,
        state: newState,
        buttonName: baseName.toUpperCase(),
      },
    });
    document.dispatchEvent(event);

    this.showToggleFeedback(baseName.toUpperCase(), newState);
  }

  // Universal dropdown management methods - SEPARATED BUTTONS FROM CONTENT
  getDropdownContent(dropdown) {
    // Get data-dropdown attribute from button's parent or button itself
    const dropdownType =
      dropdown.getAttribute("data-dropdown") ||
      dropdown.querySelector(".dropdown-btn")?.id?.replace("toggle-", "");
    if (!dropdownType) return null;

    // Find the corresponding dropdown-content in #dropdown-modals
    return document.querySelector(
      `#dropdown-modals .dropdown-content[data-dropdown="${dropdownType}"]`
    );
  }

  openDropdown(dropdown) {
    // Close any other open dropdown
    if (this.activeDropdown && this.activeDropdown !== dropdown) {
      this.closeDropdown(this.activeDropdown);
    }

    console.log("🔽 Dropdown opening:", dropdown);

    // Get the separate dropdown-content element
    const content = this.getDropdownContent(dropdown);

    // Activate both the button container and the content
    dropdown.classList.add("active");
    if (content) {
      content.classList.add("show");
    }
    this.activeDropdown = dropdown;

    // Populate dropdown content if needed
    this.populateDropdownContent(dropdown);

    // Focus first element in content
    if (content) {
      const firstFocusable = content.querySelector("button, input, select");
      if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 50);
      }
    }
  }

  closeDropdown(dropdown) {
    if (!dropdown) return;

    // Get the separate dropdown-content element
    const content = this.getDropdownContent(dropdown);

    // Simple close - immediate, no animations
    dropdown.classList.remove("active");
    if (content) {
      content.classList.remove("show");
    }

    if (this.activeDropdown === dropdown) {
      this.activeDropdown = null;
    }
  }

  closeAllDropdowns() {
    const activeDropdowns = document.querySelectorAll(".dropdown.active");
    activeDropdowns.forEach((dropdown) => {
      this.closeDropdown(dropdown);
    });

    // Also close any orphaned dropdown-content that might be showing
    const openContents = document.querySelectorAll(".dropdown-content.show");
    openContents.forEach((content) => {
      content.classList.remove("show");
    });

    // Ensure chat toggle button is restored when all dropdowns are closed
    const chatToggleBtn = document.getElementById("chat-toggle-button");
    if (chatToggleBtn) {
      chatToggleBtn.classList.remove("dropdown-active");
    }
  }

  populateDropdownContent(dropdown) {
    const btn = dropdown.querySelector(".dropdown-btn");
    if (!btn) {
      console.warn("No button found in dropdown");
      return;
    }

    const component = this.getComponentForButton(btn.id);
    const contentContainer = this.getDropdownContent(dropdown);

    if (component && component.getDropdownContent && contentContainer) {
      // ALWAYS populate content - NO CONDITIONS
      try {
        const content = component.getDropdownContent();
        contentContainer.innerHTML = content;
        this.attachContentEventListeners(contentContainer);
      } catch (error) {
        console.error(`❌ Error generating content for ${btn.id}:`, error);
      }
    }
  }

  attachContentEventListeners(container) {
    // Re-attach event listeners for dynamically added content
    const links = container.querySelectorAll("a[data-action]");
    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleDropdownAction(link);
      });
    });

    const inputs = container.querySelectorAll("input, textarea");
    inputs.forEach((input) => {
      input.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent dropdown from closing
      });
    });

    // Handle SELECT elements
    const selects = container.querySelectorAll("select[data-action]");
    selects.forEach((select) => {
      select.addEventListener("change", (e) => {
        e.stopPropagation();
        this.handleDropdownSelect(select);
      });

      select.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent dropdown from closing
      });
    });
  }

  handleClick(e) {
    // Enhanced click handling with resize protection and component considerations
    const isInsideDropdownBtn = e.target.closest(".dropdown");
    const isInsideDropdownContent = e.target.closest(".dropdown-content");
    const isDropdownButton = e.target.closest(".dropdown-btn");
    const isResizing =
      e.target.classList.contains("collar-textarea") ||
      (this.components.collar && this.components.collar.isResizing);

    // Don't close if clicking on dropdown button (button handler will manage open/close)
    // Don't close if clicking inside dropdown content
    // Don't close if resizing collar textarea
    if (!isInsideDropdownBtn && !isInsideDropdownContent && !isResizing) {
      this.closeAllDropdowns();
    }
  }

  handleKeydown(e) {
    // Enhanced keyboard navigation
    const activeDropdown = document.querySelector(".dropdown.active");
    const activeContent = document.querySelector(".dropdown-content.show");

    if (e.key === "Escape") {
      this.closeAllDropdowns();
      // Return focus to dropdown button
      if (activeDropdown) {
        const button = activeDropdown.querySelector(
          ".dropdown-btn, .dropdown-button"
        );
        if (button) button.focus();
      }
      return;
    }

    if (!activeContent) return;

    // Navigate within the active content (separate from button container)
    const items = activeContent.querySelectorAll(
      ".dropdown-item, button, input, select"
    );
    const highlightedItem = activeContent.querySelector(".highlighted");

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        DropdownUtils.navigateItems(items, highlightedItem, 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        DropdownUtils.navigateItems(items, highlightedItem, -1);
        break;
      case "Enter":
      case " ":
        if (
          highlightedItem &&
          highlightedItem.classList.contains("dropdown-item")
        ) {
          e.preventDefault();
          highlightedItem.click();
        }
        break;
    }
  }

  handleDropdownAction(link) {
    const action = link.getAttribute("data-action");
    // Find the dropdown by checking data-dropdown on content, then finding matching button
    const content = link.closest(".dropdown-content");
    const dropdownType = content?.getAttribute("data-dropdown");
    const dropdown = document.querySelector(
      `.dropdown[data-dropdown="${dropdownType}"]`
    );
    const buttonId =
      dropdown?.querySelector(".dropdown-btn")?.id || `toggle-${dropdownType}`;

    console.log(`Dropdown action: ${action} for button: ${buttonId}`);

    // Close the dropdown
    this.closeDropdown(dropdown);

    // Execute the action
    this.executeAction(action, buttonId, link.textContent);
  }

  handleDropdownSelect(select) {
    const action = select.getAttribute("data-action");
    // Find dropdown via data-dropdown on content element (select is inside #dropdown-modals)
    const content = select.closest(".dropdown-content");
    const dropdownType = content?.getAttribute("data-dropdown");
    const dropdown = document.querySelector(
      `.dropdown[data-dropdown="${dropdownType}"]`
    );
    const buttonId =
      dropdown?.querySelector(".dropdown-btn")?.id || `toggle-${dropdownType}`;

    console.log(
      `Dropdown select: ${action} for button: ${buttonId}, value: ${select.value}`
    );

    // Don't close dropdown for select elements - let user make multiple selections

    // Execute the action
    this.executeSelectAction(action, buttonId, select);
  }

  executeSelectAction(action, buttonId, selectElement) {
    // Create a custom event for the select action
    const event = new CustomEvent("dropdownAction", {
      detail: {
        action: action,
        buttonId: buttonId,
        element: selectElement,
        value: selectElement.value,
        selectedText: selectElement.options[selectElement.selectedIndex].text,
      },
    });
    document.dispatchEvent(event);
  }

  executeAction(action, buttonId, selectedText) {
    // Create a custom event for the action
    const event = new CustomEvent("dropdownAction", {
      detail: {
        action: action,
        buttonId: buttonId,
        selectedText: selectedText,
      },
    });

    document.dispatchEvent(event);

    // Add visual feedback
    this.showActionFeedback(
      buttonId.replace("toggle-", "").toUpperCase(),
      selectedText
    );
  }

  // Universal feedback methods
  showToggleFeedback(buttonName, state) {
    this.showActionFeedback(buttonName, `${state.toUpperCase()}`);
  }

  showActionFeedback(buttonName, message) {
    // Create a temporary notification
    const notification = document.createElement("div");
    notification.className = "dropdown-notification";
    notification.textContent = `${buttonName}: ${message}`;
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--button-color);
            color: white;
            padding: 10px 15px;
            border-radius: var(--border-radius);
            font-family: "Audiowide", sans-serif;
            font-size: 0.7rem;
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;

    document.body.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  // Public API methods for external scripts
  getComponent(componentName) {
    return this.components[componentName];
  }

  triggerAction(buttonId, action) {
    this.executeAction(action, buttonId, "");
  }

  // Enhanced utility method exposed to external scripts
  addVisualFeedback(element, type = "success") {
    DropdownUtils.addVisualFeedback(element, type);
  }
}

// Add enhanced animations and styles
const existingStyle = document.querySelector("style[data-dropdown-animations]");
if (!existingStyle) {
  const style = document.createElement("style");
  style.setAttribute("data-dropdown-animations", "true");
  style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }

        @keyframes feedbackPulse {
            0% { transform: scale(0); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.8; }
            100% { transform: scale(0); opacity: 0; }
        }

        .dropdown-entering {
            animation: dropdownSlideIn 0.2s ease-out;
        }

        .dropdown-leaving {
            animation: dropdownSlideOut 0.2s ease-in;
        }

        @keyframes dropdownSlideIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes dropdownSlideOut {
            from {
                opacity: 1;
                transform: translateY(0);
            }
            to {
                opacity: 0;
                transform: translateY(-10px);
            }
        }

        .collar-feedback {
            animation: slideInRight 0.3s ease-out, slideOutRight 0.3s ease-in 2.7s !important;
        }

        .smooth-transition {
            transition: all 0.2s ease;
        }

        .highlighted {
            background: rgba(255, 255, 255, 0.1);
            outline: 2px solid var(--button-color);
        }
    `;
  document.head.appendChild(style);
}

// Initialize dropdown manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  try {
    window.dropdownManager = new DropdownManager();
    console.log("✅ DropdownManager initialized");
  } catch (error) {
    console.error("❌ Failed to initialize DropdownManager:", error);
  }
});

// Debug function for testing dropdown functionality
window.testDropdowns = function () {
  console.log("🧪 Testing dropdown system...");

  if (!window.dropdownManager) {
    console.error("❌ DropdownManager not initialized");
    return false;
  }

  // Test each component
  const components = ["spiral", "tts", "triggers", "ai", "collar"];
  let allPassed = true;

  components.forEach((componentName) => {
    const component = window.dropdownManager.getComponent(componentName);
    if (component) {
      console.log(`✓ ${componentName} component test passed`);

      // Test content generation
      try {
        const content = component.getDropdownContent();
        if (content && content.length > 0) {
          console.log(`  ✓ ${componentName} content generation test passed`);
        } else {
          console.warn(`  ⚠️ ${componentName} returned empty content`);
        }
      } catch (error) {
        console.error(
          `  ❌ ${componentName} content generation failed:`,
          error
        );
        allPassed = false;
      }
    } else {
      console.error(`❌ ${componentName} component test failed`);
      allPassed = false;
    }
  });

  console.log(
    allPassed ? "✅ All dropdown tests passed" : "❌ Some dropdown tests failed"
  );
  return allPassed;
};

// Add global error handling for localStorage issues
window.addEventListener("error", (event) => {
  if (
    event.error &&
    event.error.message &&
    event.error.message.includes("JSON.parse")
  ) {
    console.warn(
      "🔍 JSON parsing error detected (possibly from external extension):",
      event.error
    );
    // Don't let external JSON errors break our app
    event.preventDefault();
  }
});

// Storage change event listener to catch potential issues from external sources
window.addEventListener("storage", (event) => {
  if (event.key && event.key.startsWith("bambi-")) {
    console.log("🔍 Storage change detected for bambi key:", event.key);

    // Validate that the new value is not "[object Object]"
    if (event.newValue === "[object Object]") {
      console.warn(
        '⚠️ Detected "[object Object]" storage value, cleaning up:',
        event.key
      );
      try {
        localStorage.removeItem(event.key);
      } catch (error) {
        console.error("Failed to clean up invalid storage:", error);
      }
    }
  }
});

// Export for external use
export default DropdownManager;
