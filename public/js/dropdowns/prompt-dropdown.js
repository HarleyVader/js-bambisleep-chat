/**
 * Prompt Dropdown Component for BambiSleep Chat
 * Lets users switch the AI system prompt/persona without typing chat commands
 */

import { StorageUtils } from "../storage-utils.js";

export class PromptDropdown {
  constructor(dropdownManager) {
    this.dropdownManager = dropdownManager;
    this.buttonId = "toggle-prompt";
    this.prompts = [];
    this.activePromptId = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadPrompts();
  }

  setupEventListeners() {
    document.addEventListener("dropdownAction", (e) => {
      const { action, buttonId } = e.detail;
      if (buttonId === this.buttonId) {
        this.handleAction(action, e.detail);
      }
    });

    // Delegate clicks inside the modal
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("prompt-select-btn")) {
        e.preventDefault();
        this.selectPrompt(e.target.dataset.promptId);
      } else if (e.target.id === "prompt-reload-btn") {
        e.preventDefault();
        this.loadPrompts();
      }
    });
  }

  async loadPrompts() {
    const content = document.querySelector(
      '.dropdown-content[data-dropdown="prompt"]',
    );
    if (content) content.innerHTML = "<p class='prompt-loading'>Loading prompts…</p>";

    try {
      const res = await fetch("/api/prompts");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.prompts = data.prompts || [];

      // Restore saved active prompt
      const saved = StorageUtils.getItem("bambi-active-prompt");
      if (saved && this.prompts.find((p) => p.id === saved)) {
        this.activePromptId = saved;
      } else if (this.prompts.length > 0) {
        this.activePromptId = this.prompts[0].id;
      }

      this.renderContent();
      this.updateButtonLabel();
    } catch (err) {
      console.error("❌ Failed to load prompts:", err);
      if (content) {
        content.innerHTML =
          "<p class='prompt-error'>Failed to load prompts. <button id='prompt-reload-btn' class='retry-button'>Retry</button></p>";
      }
    }
  }

  renderContent() {
    const content = document.querySelector(
      '.dropdown-content[data-dropdown="prompt"]',
    );
    if (!content) return;

    if (this.prompts.length === 0) {
      content.innerHTML =
        "<p class='prompt-error'>No prompt files found in workers/prompts/.</p>";
      return;
    }

    const items = this.prompts
      .map(
        (p) => `
        <div class="prompt-item ${p.id === this.activePromptId ? "prompt-active" : ""}">
          <button class="prompt-select-btn" data-prompt-id="${p.id}">
            ${p.id === this.activePromptId ? "▶ " : ""}${p.name}
          </button>
          <p class="prompt-description">${p.description}</p>
        </div>`,
      )
      .join("");

    content.innerHTML = `
      <div class="prompt-dropdown-header">
        <span>🧠 AI Persona</span>
        <button id="prompt-reload-btn" class="prompt-reload-btn" title="Reload from disk">↺</button>
      </div>
      <div class="prompt-list">${items}</div>`;
  }

  selectPrompt(promptId) {
    if (!promptId || promptId === this.activePromptId) return;

    this.activePromptId = promptId;
    StorageUtils.setItem("bambi-active-prompt", promptId);
    this.renderContent();
    this.updateButtonLabel();

    // Send the switch command via the chat core (same as typing /prompt use <id>)
    if (window.chatCore && typeof window.chatCore.sendAIMessage === "function") {
      window.chatCore.sendAIMessage(`/prompt use ${promptId}`);
    } else {
      console.warn("⚠️ chatCore not available yet, prompt switch queued");
      // Retry once chatCore is ready
      const retry = setInterval(() => {
        if (
          window.chatCore &&
          typeof window.chatCore.sendAIMessage === "function"
        ) {
          window.chatCore.sendAIMessage(`/prompt use ${promptId}`);
          clearInterval(retry);
        }
      }, 500);
      setTimeout(() => clearInterval(retry), 10000);
    }

    console.log(`📝 Switched AI persona to: ${promptId}`);
  }

  updateButtonLabel() {
    const btn = document.getElementById(this.buttonId);
    if (!btn) return;

    const active = this.prompts.find((p) => p.id === this.activePromptId);
    const label = active ? active.name : "Persona";
    const textNode = btn.childNodes[0];
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      textNode.textContent = `🧠 ${label} `;
    }
  }

  handleAction(action) {
    if (action === "open") {
      this.renderContent();
    }
  }
}
