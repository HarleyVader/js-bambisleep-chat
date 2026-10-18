/**
 * Video Background Dropdown Component for BambiSleep Chat
 * Plays a looping playlist of externally-provided embed URLs (iframes)
 * behind the spiral, with spiral/TTS text rendered on top.
 *
 * NOTE: This does not scrape or hotlink any specific video host - users
 * must supply their own authorized embed URLs (e.g. an official "share/embed"
 * iframe src copied from a video site's own UI).
 */

import { StorageUtils } from "../storage-utils.js";

const STORAGE_KEY = "bambi-video-playlist";

export class VideoBackgroundDropdown {
  constructor(dropdownManager) {
    this.dropdownManager = dropdownManager;
    this.buttonId = "toggle-video-bg";
    this.playlist = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.advanceSeconds = 300;
    this.advanceTimer = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadSavedSettings();
  }

  setupEventListeners() {
    document.addEventListener("dropdownAction", (e) => {
      const { action, buttonId } = e.detail;
      if (buttonId === this.buttonId) {
        this.handleAction(action, e.detail);
      }
    });
  }

  handleAction(action) {
    switch (action) {
      case "video-bg-save":
        this.savePlaylist();
        break;
      case "video-bg-play":
        this.play();
        break;
      case "video-bg-pause":
        this.pause();
        break;
      case "video-bg-next":
        this.next();
        break;
      case "video-bg-prev":
        this.prev();
        break;
      case "video-bg-clear":
        this.clearPlaylist();
        break;
      default:
        console.warn(`Unknown video-bg action: ${action}`);
    }
  }

  savePlaylist() {
    const textarea = document.getElementById("video-bg-urls");
    const intervalInput = document.getElementById("video-bg-interval");

    const urls = (textarea?.value || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && /^https?:\/\//i.test(line));

    if (urls.length === 0) {
      this.showFeedback("NO VALID URLS");
      return;
    }

    this.playlist = urls;
    this.currentIndex = 0;
    this.advanceSeconds = Math.max(
      10,
      parseInt(intervalInput?.value, 10) || 300
    );

    StorageUtils.setItem(STORAGE_KEY, {
      playlist: this.playlist,
      advanceSeconds: this.advanceSeconds,
    });

    this.showFeedback(`PLAYLIST SAVED (${this.playlist.length})`);
    this.updateToggleButton(true);
  }

  loadSavedSettings() {
    const saved = StorageUtils.getItem(STORAGE_KEY);
    if (saved && Array.isArray(saved.playlist) && saved.playlist.length > 0) {
      this.playlist = saved.playlist;
      this.advanceSeconds = saved.advanceSeconds || 300;
      this.updateToggleButton(true);
    }
  }

  getContainer() {
    return document.getElementById("spiral-video-background");
  }

  renderCurrentVideo() {
    const container = this.getContainer();
    if (!container || this.playlist.length === 0) return;

    const url = this.playlist[this.currentIndex];
    container.innerHTML = `<iframe src="${this.escapeAttr(
      url
    )}" allow="autoplay; fullscreen" frameborder="0" scrolling="no" loading="lazy"></iframe>`;
  }

  play() {
    if (this.playlist.length === 0) {
      this.showFeedback("NO PLAYLIST - SAVE URLS FIRST");
      return;
    }

    this.isPlaying = true;
    this.renderCurrentVideo();
    this.startAutoAdvance();
    this.updateToggleButton(true);
    this.showFeedback("PLAYING");
  }

  pause() {
    this.isPlaying = false;
    this.stopAutoAdvance();
    const container = this.getContainer();
    if (container) container.innerHTML = "";
    this.updateToggleButton(false);
    this.showFeedback("PAUSED");
  }

  next() {
    if (this.playlist.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    if (this.isPlaying) this.renderCurrentVideo();
  }

  prev() {
    if (this.playlist.length === 0) return;
    this.currentIndex =
      (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
    if (this.isPlaying) this.renderCurrentVideo();
  }

  startAutoAdvance() {
    this.stopAutoAdvance();
    this.advanceTimer = setInterval(() => {
      this.next();
    }, this.advanceSeconds * 1000);
  }

  stopAutoAdvance() {
    if (this.advanceTimer) {
      clearInterval(this.advanceTimer);
      this.advanceTimer = null;
    }
  }

  clearPlaylist() {
    this.pause();
    this.playlist = [];
    this.currentIndex = 0;
    StorageUtils.removeItem(STORAGE_KEY);
    const textarea = document.getElementById("video-bg-urls");
    if (textarea) textarea.value = "";
    this.updateToggleButton(false);
    this.showFeedback("PLAYLIST CLEARED");
  }

  updateToggleButton(hasPlaylist) {
    const btn = document.getElementById(this.buttonId);
    const statusIndicator = document.getElementById("video-bg-status");

    if (btn) {
      btn.setAttribute("data-state", this.isPlaying ? "on" : "off");
    }
    if (statusIndicator) {
      statusIndicator.style.color = this.isPlaying
        ? "#00ff00"
        : hasPlaylist
          ? "#ffaa00"
          : "#666";
      statusIndicator.textContent = "●";
    }
  }

  toggleState(btn) {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  escapeAttr(text) {
    return text.replace(/"/g, "&quot;");
  }

  escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  showFeedback(message) {
    const feedback = document.createElement("div");
    feedback.className = "collar-feedback";
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

  getDropdownContent() {
    const urlsText = this.escapeHtml(this.playlist.join("\n"));
    return `
            <div class="dropdown-header">
                <h3>🎬 Video Background</h3>
                <p>Plays a looping playlist of your own embed URLs behind the spiral</p>
            </div>
            <div class="dropdown-body">
                <div class="dropdown-section">
                    <textarea id="video-bg-urls" class="collar-textarea" placeholder="One embed URL per line (e.g. an official share/embed iframe src)...">${urlsText}</textarea>
                </div>
                <div class="dropdown-section">
                    <label for="video-bg-interval" style="display:block; font-size:0.7rem; margin-bottom:4px;">Auto-advance (seconds)</label>
                    <input type="number" id="video-bg-interval" min="10" value="${this.advanceSeconds}" style="width:100%;" />
                </div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-section">
                    <div class="dropdown-section-header">Playback</div>
                    <div class="collar-buttons">
                        <button class="collar-btn dropdown-item" data-action="video-bg-save">💾 Save</button>
                        <button class="collar-btn dropdown-item" data-action="video-bg-play">▶️ Play</button>
                        <button class="collar-btn dropdown-item" data-action="video-bg-pause">⏸️ Pause</button>
                    </div>
                    <div class="collar-buttons">
                        <button class="collar-btn dropdown-item" data-action="video-bg-prev">⏮️ Prev</button>
                        <button class="collar-btn dropdown-item" data-action="video-bg-next">⏭️ Next</button>
                    </div>
                </div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-section">
                    <div class="dropdown-section-header">Advanced</div>
                    <button class="dropdown-item" data-action="video-bg-clear">🗑️ Clear Playlist</button>
                </div>
            </div>
        `;
  }
}
