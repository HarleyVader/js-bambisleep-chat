/**
 * BaseDropdown - Shared functionality for all dropdown components
 * Consolidates common patterns: init, state management, storage, event handling
 *
 * All dropdowns extend this to eliminate ~70% code duplication
 */

import { StorageUtils } from "../storage-utils.js";

export class BaseDropdown {
  constructor(dropdownManager, config = {}) {
    this.dropdownManager = dropdownManager;
    this.componentName = config.componentName || "base";
    this.buttonId = config.buttonId || `toggle-${this.componentName}`;
    this.storageKey = config.storageKey || `bambi-${this.componentName}-state`;

    // Default state shape - override in subclass constructor
    this.defaultState = config.defaultState || {};
  }

  // Centralized state getters/setters using dropdownManager
  getState(key) {
    return this.dropdownManager.getComponentState(this.componentName, key);
  }

  setState(key, value) {
    this.dropdownManager.setComponentState(this.componentName, key, value);
  }

  getAllState() {
    return this.dropdownManager.componentStates[this.componentName] || {};
  }

  setAllState(state) {
    this.dropdownManager.componentStates[this.componentName] = { ...state };
  }

  // Base initialization - call from subclass init()
  baseInit() {
    this.setupToggleHandling();
    this.loadSavedState();
  }

  // Common toggle handling pattern
  setupToggleHandling() {
    const btn = document.getElementById(this.buttonId);
    if (!btn) {
      console.warn(
        `⚠️ Button #${this.buttonId} not found for ${this.componentName} dropdown`
      );
      return;
    }

    // Ensure proper CSS classes
    btn.classList.add("dropdown-btn", "toggle-button");

    // Toggle button click is handled by central dropdownManager
    // Individual dropdown logic goes in setupEventListeners()
  }

  // Common state loading pattern
  loadSavedState() {
    const savedState = StorageUtils.getItem(this.storageKey);
    if (savedState) {
      try {
        this.setAllState({ ...this.defaultState, ...savedState });
        this.syncUIWithState();
      } catch (e) {
        console.warn(`⚠️ Failed to load ${this.componentName} state:`, e);
        this.setAllState(this.defaultState);
      }
    } else {
      this.setAllState(this.defaultState);
    }
  }

  // Common state saving pattern
  saveState() {
    const state = this.getAllState();
    StorageUtils.setItem(this.storageKey, state);
  }

  // Update UI elements to match current state - override in subclass
  syncUIWithState() {
    console.warn(
      `syncUIWithState() not implemented in ${this.componentName} dropdown`
    );
  }

  // Common event listener setup - override in subclass
  setupEventListeners() {
    console.warn(
      `setupEventListeners() not implemented in ${this.componentName} dropdown`
    );
  }

  // Common button state update pattern
  updateButtonState(isActive, additionalClasses = []) {
    const btn = document.getElementById(this.buttonId);
    if (!btn) return;

    btn.setAttribute("data-state", isActive ? "on" : "off");
    additionalClasses.forEach((cls) => btn.classList.add(cls));
  }

  // Common status indicator update pattern
  updateStatusIndicator(statusId, isActive) {
    const statusIndicator = document.getElementById(statusId);
    if (!statusIndicator) return;

    if (isActive) {
      statusIndicator.className = "status-active";
      statusIndicator.textContent = "●";
    } else {
      statusIndicator.className = "status-inactive";
      statusIndicator.textContent = "●";
    }
  }

  // Common feedback notification pattern
  showFeedback(message, duration = 2000) {
    const container = document
      .getElementById(this.buttonId)
      ?.closest(".dropdown");
    if (!container) return;

    // Remove any existing notifications
    const existing = container.querySelector(".dropdown-notification");
    if (existing) existing.remove();

    const feedback = document.createElement("div");
    feedback.className = "dropdown-notification z-notification";
    feedback.textContent = message;
    container.appendChild(feedback);

    setTimeout(() => feedback.classList.add("show"), 10);
    setTimeout(() => {
      feedback.classList.remove("show");
      setTimeout(() => feedback.remove(), 300);
    }, duration);
  }

  // Handle action buttons in dropdown content
  handleAction(action, data = {}) {
    console.warn(
      `handleAction('${action}') not implemented in ${this.componentName} dropdown`
    );
  }

  // Utility: get button element
  getButton() {
    return document.getElementById(this.buttonId);
  }

  // Utility: get dropdown content element
  getDropdownContent() {
    const btn = this.getButton();
    return btn?.nextElementSibling?.classList.contains("dropdown-content")
      ? btn.nextElementSibling
      : null;
  }

  // Template method pattern - subclasses override this
  async init() {
    this.baseInit();
    this.setupEventListeners();
    // Subclass-specific initialization here
  }
}

export default BaseDropdown;
