/**
 * Playlist Dropdown Component for BambiSleep Chat
 * Lists curated BambiCloud playlist/page links and loads their
 * description into the Collar as AI context when selected.
 */

export class PlaylistDropdown {
  constructor(dropdownManager) {
    this.dropdownManager = dropdownManager;
    this.buttonId = "toggle-playlist";
    this.playlistsData = null;
    this.loadError = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadPlaylists();
  }

  setupEventListeners() {
    document.addEventListener("dropdownAction", (e) => {
      const { action, buttonId } = e.detail;
      if (buttonId === this.buttonId) {
        this.handleAction(action);
      }
    });

    document.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("playlist-button") &&
        e.target.dataset.playlistId
      ) {
        e.preventDefault();
        this.handlePlaylistClick(e.target.dataset.playlistId);
      } else if (
        e.target.classList.contains("retry-button") &&
        e.target.dataset.action === "retry-playlists"
      ) {
        e.preventDefault();
        this.loadPlaylists();
      }
    });
  }

  async loadPlaylists() {
    try {
      const response = await fetch("/api/playlists/json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.playlistsData = await response.json();
      this.loadError = null;
    } catch (error) {
      console.error("❌ Failed to load BambiCloud playlists:", error);
      this.loadError = error.message;
    }
  }

  handleAction(action) {
    if (action === "playlist-reload") {
      this.playlistsData = null;
      this.loadError = null;
      this.loadPlaylists().then(() => this.refreshContent());
    }
  }

  refreshContent() {
    const currentDropdown = document
      .querySelector(`#${this.buttonId}`)
      .closest(".dropdown");
    if (currentDropdown && currentDropdown.classList.contains("active")) {
      const contentContainer = document.querySelector(
        '#dropdown-modals .dropdown-content[data-dropdown="playlist"]'
      );
      if (contentContainer) {
        contentContainer.innerHTML = this.getDropdownContent();
        this.dropdownManager.attachContentEventListeners(contentContainer);
      }
    }
  }

  // Opens the real BambiCloud page and loads its description into the
  // Collar as AI context (all playlist data here originates from BambiCloud).
  handlePlaylistClick(playlistId) {
    const playlist = this.playlistsData?.playlists?.find(
      (p) => p.id === playlistId
    );
    if (!playlist) return;

    window.open(playlist.url, "_blank", "noopener,noreferrer");

    const collar = this.dropdownManager.getComponent
      ? this.dropdownManager.getComponent("collar")
      : this.dropdownManager.components?.collar;
    if (collar?.loadDescriptionFromCloud) {
      collar.loadDescriptionFromCloud(
        playlist.title,
        playlist.description || `${playlist.level} ${playlist.category} playlist`,
        playlist.url
      );
    }

    this.dropdownManager.showActionFeedback("PLAYLIST", playlist.title.toUpperCase());
  }

  getDropdownContent() {
    if (this.loadError) {
      return `
                <div class="dropdown-header">
                    <h3>🎶 BambiCloud Playlists</h3>
                    <p>Error loading playlists</p>
                </div>
                <div class="dropdown-body">
                    <div class="category-error">
                        <p>❌ Failed to load playlists: ${this.loadError}</p>
                        <button class="retry-button dropdown-item" data-action="retry-playlists">🔄 Retry</button>
                    </div>
                </div>
            `;
    }

    if (!this.playlistsData) {
      return `
                <div class="dropdown-header">
                    <h3>🎶 BambiCloud Playlists</h3>
                    <p>Load a playlist from the cloud</p>
                </div>
                <div class="dropdown-body">
                    <div class="category-placeholder">☁️ Loading playlists...</div>
                </div>
            `;
    }

    const playlists = this.playlistsData.playlists || [];

    let content = `
            <div class="dropdown-header">
                <h3>🎶 BambiCloud Playlists</h3>
                <p>Open a playlist and load its description into the Collar</p>
            </div>
            <div class="dropdown-body">
                <div class="trigger-categories">
        `;

    playlists.forEach((playlist) => {
      content += `
                    <button class="playlist-button dropdown-item"
                            data-playlist-id="${playlist.id}"
                            title="${playlist.description || ""}">
                        ${playlist.title} <span class="dropdown-item-meta">(${playlist.level})</span>
                    </button>
                `;
    });

    content += `
                </div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-section">
                    <button class="dropdown-item" data-action="playlist-reload">🔄 Reload from Cloud</button>
                </div>
            </div>
        `;

    return content;
  }
}
