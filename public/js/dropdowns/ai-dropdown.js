/**
 * AI Dropdown Component for BambiSleep Chat (Refactored to extend BaseDropdown)
 * Handles AI mode and model selection dropdown functionality
 *
 * Integration with buttons.css red/green on/off system:
 * - Uses .dropdown-btn class for main toggle button cyber-electric styling
 * - Uses .ai-button class for dropdown content buttons
 * - CHAT mode: data-mode="chat", data-state="off" -> Red pulse (inactive/default state)
 * - AIGF mode: data-mode="ai", data-state="on" -> Special pink AIGF styling overrides green
 * - Dropdown buttons use standard button system with active states and hover effects
 *
 * Button States:
 * - Main Toggle: #toggle-ai[data-mode="chat"][data-state="off"] -> Red pulse, standard off styling
 * - Main Toggle: #toggle-ai[data-mode="ai"] -> Pink gradient, aigfPulse animation (overrides on state)
 * - Dropdown Buttons: .ai-button with .active class for selected options
 */

import { BaseDropdown } from "./base-dropdown.js";

export class AIDropdown extends BaseDropdown {
  constructor(dropdownManager) {
    super(dropdownManager, {
      componentName: "ai",
      buttonId: "toggle-ai",
      storageKey: "bambi-ai-state",
      defaultState: {
        isEnabled: false,
        currentModel: "balanced",
      },
    });
    this.init();
  }

  // State getters/setters for convenience
  get isEnabled() {
    return this.getState("isEnabled") || false;
  }

  set isEnabled(value) {
    this.setState("isEnabled", value);
  }

  get currentModel() {
    return this.getState("currentModel") || "balanced";
  }

  set currentModel(value) {
    this.setState("currentModel", value);
  }

  async init() {
    this.baseInit(); // Call parent initialization
    this.setupEventListeners();
    this.setupAIToggleHandling(); // AI-specific toggle logic
    this.ensureButtonStyling();
  }

  ensureButtonStyling() {
    const btn = this.getButton();
    if (btn) {
      btn.classList.add("dropdown-btn", "toggle-button");
      btn.classList.remove("active");
      btn.setAttribute("data-state", this.isEnabled ? "on" : "off");
    }
    this.updateStatusIndicator("ai-status", this.isEnabled);
  }

  setupEventListeners() {
    // Listen for dropdown actions specific to AI
    document.addEventListener("dropdownAction", (e) => {
      const { action, buttonId } = e.detail;
      if (buttonId === this.buttonId) {
        this.handleAction(action, e.detail);
      }
    });
  }

  setupAIToggleHandling() {
    // AI button has special dual behavior:
    // 1. Toggle AIGF on/off state
    // 2. Open/close dropdown (handled by DropdownManager)
    const aiButton = this.getButton();
    if (aiButton) {
      aiButton.addEventListener("click", () => {
        this.toggleAIGF();
      });
    }
  }

  syncUIWithState() {
    // Sync UI elements with current state
    this.updateButtonState();
    this.updateDropdownSelections();
  }

  updateDropdownSelections() {
    // Update active states for model buttons
    const content = this.getDropdownContent();
    if (!content) return;

    const modelButtons = content.querySelectorAll('[data-action^="ai-model-"]');
    modelButtons.forEach((btn) => {
      const modelName = btn.dataset.action.replace("ai-model-", "");
      if (modelName === this.currentModel) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  handleAction(action, detail) {
    console.log(`🤖 AI action: ${action}`);

    switch (action) {
      case "ai-model-creative":
        this.setModel("creative");
        break;
      case "ai-model-balanced":
        this.setModel("balanced");
        break;
      case "ai-model-precise":
        this.setModel("precise");
        break;
      default:
        console.warn(`Unknown AI action: ${action}`);
    }
  }

  toggleAIGF() {
    this.isEnabled = !this.isEnabled;
    this.updateButtonState();
    this.saveState();

    // Dispatch custom event
    document.dispatchEvent(
      new CustomEvent("aiModeChange", {
        detail: {
          enabled: this.isEnabled,
          mode: "aigf",
        },
      })
    );

    this.showFeedback("AIGF: " + (this.isEnabled ? "ENABLED" : "DISABLED"));
  }

  updateButtonState() {
    const btn = this.getButton();
    if (!btn) return;

    // Set proper data attributes for buttons.css red/green on/off styling system
    btn.setAttribute("data-state", this.isEnabled ? "on" : "off");
    btn.classList.add("dropdown-btn", "toggle-button");
    btn.classList.remove("active");

    // Clear any inline styles to let buttons.css handle all button styling
    btn.style.background = "";
    btn.style.animation = "";
    btn.style.minWidth = "";
    btn.style.boxShadow = "";
    btn.style.textShadow = "";
    btn.style.border = "";

    // Update status indicator
    this.updateStatusIndicator("ai-status", this.isEnabled);
  }

  setModel(model) {
    this.currentModel = model;
    this.saveState();
    this.updateDropdownSelections();

    // Update chatCore model if available
    if (window.chatCore && window.chatCore.setModel) {
      window.chatCore.setModel(model);
    }

    // Dispatch model change event
    document.dispatchEvent(
      new CustomEvent("aiModelChange", {
        detail: {
          model: model,
          description: this.getModelDescription(model),
        },
      })
    );

    this.showFeedback("AI MODEL: " + model.toUpperCase());
  }

  handleAIClick(button, action) {
    // For single-selection categories, remove active from siblings first
    const category = this.getAICategory(action);
    if (this.isSingleSelectionCategory(category)) {
      const siblings = button.parentElement.querySelectorAll(".ai-button");
      siblings.forEach((sibling) => sibling.classList.remove("active"));
    }

    // Add active state to clicked button
    button.classList.add("active");

    // Execute the AI action
    this.handleAction(action, {
      selectedText: button.textContent,
      element: button,
    });
  }

  getAICategory(action) {
    if (action.includes("mode")) return "mode";
    if (action.includes("model")) return "model";
    return "other";
  }

  isSingleSelectionCategory(category) {
    // These categories should only have one active selection at a time
    return ["mode", "model"].includes(category);
  }

  getModelDescription(model) {
    const descriptions = {
      creative: "High creativity, more experimental responses",
      balanced: "Balanced creativity and accuracy",
      precise: "High accuracy, more factual responses",
    };
    return descriptions[model] || "Unknown model";
  }

  addSystemMessage(message) {
    // Use chatCore's system message if available, otherwise create own
    if (window.chatCore && window.chatCore.addSystemMessagePublic) {
      window.chatCore.addSystemMessagePublic(message);
    } else {
      // Fallback: add message to chat directly
      const chatMessages = document.getElementById("chat-messages");
      if (chatMessages) {
        const messageDiv = document.createElement("div");
        messageDiv.className = "system-message ai-system-message";
        messageDiv.textContent = message;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
  }

  // Get HTML content for the dropdown
  getDropdownContent() {
    return `
            <div class="ai-config">
                <!-- AIGF Status -->
                <div class="control-section">
                    <p class="config-label">🧠 AIGF Status:</p>
                    <div class="aigf-status">
                        ${
                          this.isEnabled
                            ? "✅ BRAINWASH MODE ACTIVE"
                            : "❌ BRAINWASH MODE DISABLED"
                        }
                    </div>
                </div>

                <!-- Model Selection -->
                <div class="control-section">
                    <p class="config-label">🎭 Model Selection:</p>
                    <div class="ai-buttons">
                        <button class="ai-button ${
                          this.currentModel === "creative" ? "active" : ""
                        }" data-action="ai-model-creative" onclick="window.dropdownManager.getComponent('ai').handleAIClick(this, 'ai-model-creative')">🎨 Creative Model</button>
                        <button class="ai-button ${
                          this.currentModel === "balanced" ? "active" : ""
                        }" data-action="ai-model-balanced" onclick="window.dropdownManager.getComponent('ai').handleAIClick(this, 'ai-model-balanced')">⚖️ Balanced Model</button>
                        <button class="ai-button ${
                          this.currentModel === "precise" ? "active" : ""
                        }" data-action="ai-model-precise" onclick="window.dropdownManager.getComponent('ai').handleAIClick(this, 'ai-model-precise')">🎯 Precise Model</button>
                    </div>
                </div>

                <!-- Model Information -->
                <div class="control-section">
                    <p class="config-label">ℹ️ Model Info:</p>
                    <div class="model-description">
                        ${this.getModelDescription(this.currentModel)}
                    </div>
                </div>
            </div>
        `;
  }
}
