/**
 * Triggers Dropdown Component for BambiSleep Chat
 * Handles trigger system dropdown functionality
 */

export class TriggersDropdown {
  constructor(dropdownManager) {
    this.dropdownManager = dropdownManager;
    this.buttonId = "toggle-triggers";
    this.triggersData = null;
    this.init();
  }

  // Helper function to safely access trigger system
  getTriggerSystem() {
    if (window.triggerSystem) {
      return window.triggerSystem;
    }
    console.warn("⚠️ Trigger system not available yet");
    return null;
  }

  init() {
    this.setupEventListeners();
    this.setupToggleHandling();
    // Load trigger data immediately during init
    this.loadTriggerCategories();
  }

  setupEventListeners() {
    // Listen for dropdown actions specific to triggers
    document.addEventListener("dropdownAction", (e) => {
      const { action, buttonId } = e.detail;
      if (buttonId === this.buttonId) {
        this.handleAction(action, e.detail);
      }
    });

    // Listen for trigger selection events
    document.addEventListener("triggerSelection", (e) => {
      this.handleTriggerSelection(e.detail);
    });

    // Event delegation for trigger buttons to avoid inline onclick issues
    document.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("trigger-button") &&
        e.target.dataset.triggerName
      ) {
        e.preventDefault();
        this.handleTriggerClick(e.target, e.target.dataset.triggerName);
      } else if (
        e.target.classList.contains("retry-button") &&
        e.target.dataset.action === "retry-triggers"
      ) {
        e.preventDefault();
        this.loadTriggerCategories();
      }
    });
  }

  setupToggleHandling() {
    // Dropdown open/close is handled by DropdownManager
    // This method kept for potential future toggle-specific logic
  }

  async loadTriggerCategories() {
    try {
      const response = await fetch("/api/triggers/json");

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      this.triggersData = await response.json();
    } catch (error) {
      console.error("❌ Failed to load trigger categories:", error);
      this.loadError = error.message;
    }
  }

  handleAction(action, detail) {
    switch (action) {
      case "triggers-enable-all":
        this.enableAllTriggers();
        break;
      case "triggers-disable-all":
        this.disableAllTriggers();
        break;
      case "triggers-toggle-category":
        this.toggleCategory(detail.category);
        break;
      case "triggers-reload":
        // Clear existing data and force reload
        this.triggersData = null;
        this.loadError = null;
        this.loadTriggerCategories().then(() => {
          // Find the content container via data-dropdown attribute (separated from button)
          const currentDropdown = document
            .querySelector("#toggle-triggers")
            .closest(".dropdown");
          if (currentDropdown && currentDropdown.classList.contains("active")) {
            const contentContainer = document.querySelector(
              '#dropdown-modals .dropdown-content[data-dropdown="triggers"]'
            );
            if (contentContainer) {
              contentContainer.innerHTML = this.getDropdownContent();
              this.dropdownManager.attachContentEventListeners(
                contentContainer
              );
            }
          }
        });
        break;
      case "retry-triggers":
        this.loadTriggerCategories();
        this.dropdownManager.showActionFeedback("TRIGGERS", "RELOADING...");
        break;
      case "triggers-sync-cloud":
        this.syncFromCloud();
        break;
      default:
        console.warn(`Unknown triggers action: ${action}`);
    }
  }

  // Fetches BambiCloud's community-contributed triggers and merges any not
  // already present (by name) into the currently displayed trigger list.
  async syncFromCloud() {
    this.dropdownManager.showActionFeedback("TRIGGERS", "SYNCING FROM CLOUD...");
    try {
      const response = await fetch("/api/triggers/community/json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const cloudData = await response.json();
      const cloudTriggers = Array.isArray(cloudData.triggers)
        ? cloudData.triggers
        : [];

      if (!this.triggersData) {
        this.triggersData = { triggers: [] };
      }

      const existingNames = new Set(
        this.triggersData.triggers.map((t) => t.name.toLowerCase())
      );
      const newTriggers = cloudTriggers.filter(
        (t) => !existingNames.has(t.name.toLowerCase())
      );

      this.triggersData.triggers.push(...newTriggers);

      const currentDropdown = document
        .querySelector("#toggle-triggers")
        .closest(".dropdown");
      if (currentDropdown && currentDropdown.classList.contains("active")) {
        const contentContainer = document.querySelector(
          '#dropdown-modals .dropdown-content[data-dropdown="triggers"]'
        );
        if (contentContainer) {
          contentContainer.innerHTML = this.getDropdownContent();
          this.dropdownManager.attachContentEventListeners(contentContainer);
        }
      }

      this.dropdownManager.showActionFeedback(
        "TRIGGERS",
        `+${newTriggers.length} FROM CLOUD`
      );
      console.log(
        `☁️ Synced ${newTriggers.length} new triggers from BambiCloud (${cloudTriggers.length} available)`
      );
    } catch (error) {
      console.error("❌ Failed to sync triggers from cloud:", error);
      this.dropdownManager.showActionFeedback("TRIGGERS", "SYNC FAILED");
    }
  }

  handleTriggerSelection(detail) {
    const { trigger, active, category, safety } = detail;
    console.log(
      `🎯 Trigger ${
        active ? "activated" : "deactivated"
      }: ${trigger} (${category}, ${safety})`
    );

    // Show feedback
    this.dropdownManager.showActionFeedback(
      "TRIGGER",
      `${trigger}: ${active ? "ON" : "OFF"}`
    );
  }

  toggleState(btn) {
    const currentState = btn.getAttribute("data-state");
    const newState = currentState === "off" ? "on" : "off";
    const statusIndicator = document.getElementById("triggers-status");

    btn.setAttribute("data-state", newState);

    // Update status indicator like brainwave
    if (statusIndicator) {
      if (newState === "on") {
        statusIndicator.style.color = "#00ff00";
        statusIndicator.textContent = "●";
      } else {
        statusIndicator.style.color = "#666";
        statusIndicator.textContent = "●";
      }
    }

    // Enable/disable trigger system
    const triggerSystem = this.getTriggerSystem();
    if (triggerSystem) {
      // Check current state and toggle if needed
      const currentSystemState = triggerSystem.isEnabled;
      const targetState = newState === "on";

      if (currentSystemState !== targetState) {
        triggerSystem.toggle();
      }
    } else {
      console.warn(
        "⚠️ Trigger system not available, scheduling for later initialization"
      );
      setTimeout(() => {
        const delayedTriggerSystem = this.getTriggerSystem();
        if (delayedTriggerSystem) {
          const currentSystemState = delayedTriggerSystem.isEnabled;
          const targetState = newState === "on";

          if (currentSystemState !== targetState) {
            delayedTriggerSystem.toggle();
          }
        }
      }, 1000);
    }

    // Dispatch toggle event
    const event = new CustomEvent("triggerSystemToggle", {
      detail: {
        enabled: newState === "on",
      },
    });
    document.dispatchEvent(event);

    this.dropdownManager.showToggleFeedback("TRIGGERS", newState);
  }

  showFeedback(message) {
    // Create floating feedback notification (standardized like other dropdowns)
    const feedback = document.createElement("div");
    feedback.className = "triggers-feedback";
    feedback.textContent = message;
    feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--button-color);
            color: var(--primary-color);
            padding: 8px 16px;
            border-radius: 20px;
            font-family: "Audiowide", sans-serif;
            font-size: 0.7rem;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 0 20px var(--button-color);
            animation: slideInRight 0.3s ease-out, slideOutRight 0.3s ease-in 2.7s;
            pointer-events: none;
        `;

    document.body.appendChild(feedback);

    setTimeout(() => {
      if (feedback && feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 3000);
  }

  enableAllTriggers() {
    const buttons = document.querySelectorAll(".trigger-button");
    buttons.forEach((button) => {
      if (!button.classList.contains("active")) {
        button.click();
      }
    });
    this.dropdownManager.showActionFeedback("TRIGGERS", "ALL ENABLED");
  }

  disableAllTriggers() {
    const buttons = document.querySelectorAll(".trigger-button");
    buttons.forEach((button) => {
      if (button.classList.contains("active")) {
        button.click();
      }
    });
    this.dropdownManager.showActionFeedback("TRIGGERS", "ALL DISABLED");
  }

  toggleCategory(categoryName) {
    const categoryDiv = Array.from(
      document.querySelectorAll(".trigger-category")
    ).find(
      (div) =>
        div.querySelector(".category-header").textContent ===
        categoryName.toUpperCase()
    );

    if (categoryDiv) {
      const buttons = categoryDiv.querySelectorAll(".trigger-button");
      const firstButton = buttons[0];
      const shouldActivate = !firstButton.classList.contains("active");

      buttons.forEach((button) => {
        if (shouldActivate && !button.classList.contains("active")) {
          button.click();
        } else if (!shouldActivate && button.classList.contains("active")) {
          button.click();
        }
      });

      this.dropdownManager.showActionFeedback(
        "TRIGGERS",
        `${categoryName.toUpperCase()}: ${shouldActivate ? "ON" : "OFF"}`
      );
    }
  }

  // Get HTML content for the dropdown
  getDropdownContent() {
    // If there was an error loading
    if (this.loadError) {
      return `
                <div class="dropdown-header">
                    <h3>🎯 Trigger System</h3>
                    <p>Error loading triggers</p>
                </div>
                <div class="dropdown-body">
                    <div class="trigger-categories">
                        <div class="category-error">
                            <p>❌ Failed to load triggers: ${this.loadError}</p>
                            <button class="retry-button dropdown-item" data-action="retry-triggers">🔄 Retry</button>
                        </div>
                    </div>
                </div>
            `;
    }

    // If no data yet, return loading state
    if (!this.triggersData) {
      return `
                <div class="dropdown-header">
                    <h3>🎯 Trigger System</h3>
                    <p>Manage BambiSleep triggers</p>
                </div>
                <div class="dropdown-body">
                    <div class="trigger-categories">
                        <div class="category-placeholder">⚡ Loading triggers...</div>
                    </div>
                </div>
            `;
    }

    // Generate content with loaded data
    return this.generateTriggersContent();
  }

  generateTriggersContent() {
    if (!this.triggersData) return "";

    let content = `
            <div class="dropdown-header">
                <h3>🎯 Trigger System</h3>
                <p>Select active BambiSleep triggers</p>
            </div>
            <div class="dropdown-body">
                <div class="trigger-categories">
        `;

    // Group triggers by category
    const categories = {};
    this.triggersData.triggers.forEach((trigger) => {
      const category = trigger.category || "General";
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(trigger);
    });

    // Create category sections
    Object.keys(categories).forEach((categoryName) => {
      content += `
                <div class="trigger-category">
                    <div class="dropdown-section-header">${categoryName}</div>
            `;

      categories[categoryName].forEach((trigger) => {
        content += `
                    <button class="trigger-button dropdown-item"
                            data-category="${trigger.category || "default"}"
                            data-safety="${trigger.safetyLevel || "safe"}"
                            data-trigger-name="${trigger.name}">
                        ${trigger.name}
                    </button>
                `;
      });

      content += `</div>`;
    });

    content += `
                </div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-section">
                    <div class="dropdown-section-header">Bulk Actions</div>
                    <button class="dropdown-item" data-action="triggers-enable-all">✅ Enable All</button>
                    <button class="dropdown-item" data-action="triggers-disable-all">❌ Disable All</button>
                    <button class="dropdown-item" data-action="triggers-reload">🔄 Reload Triggers</button>
                    <button class="dropdown-item" data-action="triggers-sync-cloud">☁️ Sync from Cloud</button>
                </div>
            </div>
        `;

    return content;
  }

  handleTriggerClick(button, triggerName) {
    button.classList.toggle("active");
    const isActive = button.classList.contains("active");

    // When a trigger is activated, push its description into the collar as
    // live AI context (all trigger data here originates from BambiCloud).
    if (isActive && this.triggersData?.triggers) {
      const trigger = this.triggersData.triggers.find(
        (t) => t.name.toLowerCase() === triggerName.toLowerCase()
      );
      const collar = this.dropdownManager.getComponent
        ? this.dropdownManager.getComponent("collar")
        : this.dropdownManager.components?.collar;
      if (trigger && trigger.description && collar?.loadDescriptionFromCloud) {
        collar.loadDescriptionFromCloud(
          trigger.name,
          trigger.description,
          "https://bambicloud.com/triggers"
        );
      }
    }

    // Dispatch trigger selection event
    const event = new CustomEvent("triggerSelection", {
      detail: {
        trigger: triggerName,
        active: isActive,
        category: button.getAttribute("data-category"),
        safety: button.getAttribute("data-safety"),
      },
    });
    document.dispatchEvent(event);

    // Update active triggers in chatCore if available
    if (window.chatCore) {
      const triggerNameUpper = triggerName.toUpperCase();
      if (button.classList.contains("active")) {
        if (!window.chatCore.activeTriggers.includes(triggerNameUpper)) {
          window.chatCore.activeTriggers.push(triggerNameUpper);
        }
      } else {
        const index = window.chatCore.activeTriggers.indexOf(triggerNameUpper);
        if (index > -1) {
          window.chatCore.activeTriggers.splice(index, 1);
        }
      }
      window.chatCore.updateTriggers();
      console.log(
        "🎯 Updated active triggers:",
        window.chatCore.activeTriggers
      );
    }
  }
}
