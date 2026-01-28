export function createBrainwaveDropdown() {
  // Find the existing content placeholder in #dropdown-modals
  const modalsContainer = document.getElementById("dropdown-modals");
  const content = modalsContainer?.querySelector(
    '.dropdown-content[data-dropdown="brainwave"]',
  );

  if (!content) {
    console.error("❌ Brainwave dropdown content container not found");
    return null;
  }

  // Populate the content
  content.id = "brainwave-content";
  content.innerHTML = `
    <div class="dropdown-header">
      <h3>🧠 Brainwave Generator</h3>
      <p>Binaural beats for meditation, focus, and relaxation</p>
    </div>

    <div class="dropdown-body">
      <div class="dropdown-section">
        <div class="dropdown-section-header">Preset Selection</div>
        <select id="brainwave-preset" class="dropdown-item">
          <option value="">Select a preset...</option>
        </select>
      </div>

      <div class="dropdown-divider"></div>

      <div class="dropdown-section">
        <div class="dropdown-section-header">Volume Control</div>
        <input type="range" id="brainwave-volume" min="0" max="100" value="10">
        <span id="volume-display">10%</span>
      </div>

      <div class="dropdown-divider"></div>

      <div class="dropdown-section">
        <div class="dropdown-section-header">Controls</div>
        <div class="control-buttons">
          <button id="brainwave-play" class="dropdown-item control-button play-btn" disabled>▶ Start</button>
          <button id="brainwave-stop" class="dropdown-item control-button stop-btn" disabled>⏹ Stop</button>
        </div>
      </div>

      <div class="dropdown-divider"></div>

      <div class="dropdown-section">
        <div class="dropdown-section-header">Status</div>
        <div id="brainwave-info" class="info-display">Ready to start...</div>
      </div>

      <div class="dropdown-footer">
        <small>⚠️ Use headphones for binaural effect. Start with low volume.</small>
      </div>
    </div>
  `;

  // Get elements for interaction - button is now in #dropdowns-menu
  const dropdown = document.querySelector(
    '.dropdown[data-dropdown="brainwave"]',
  );
  const btn = document.getElementById("toggle-brainwave");
  const statusIndicator = document.getElementById("brainwave-status");

  // Get elements from the separate content
  const presetSelect = content.querySelector("#brainwave-preset");
  const volumeSlider = content.querySelector("#brainwave-volume");
  const volumeDisplay = content.querySelector("#volume-display");
  const playBtn = content.querySelector("#brainwave-play");
  const stopBtn = content.querySelector("#brainwave-stop");
  const infoDisplay = content.querySelector("#brainwave-info");

  // Initialize preset options
  function initializePresets() {
    if (!window.brainwaveGenerator) {
      setTimeout(initializePresets, 100);
      return;
    }

    if (!presetSelect) return;

    const presets = window.brainwaveGenerator.getPresets();
    presets.forEach((preset) => {
      const option = document.createElement("option");
      option.value = preset.name;
      option.textContent = `${preset.name} (${preset.beat}Hz)`;
      option.title = preset.description;
      presetSelect.appendChild(option);
    });

    if (playBtn) playBtn.disabled = false;
    updateStatus();
  }

  // Update UI status using standard button states from buttons.css
  function updateStatus() {
    if (!window.brainwaveGenerator) return;

    const state = window.brainwaveGenerator.getCurrentState();

    if (state.isPlaying) {
      // Use standard "on" state from buttons.css
      if (btn) btn.setAttribute("data-state", "on");
      if (statusIndicator) {
        statusIndicator.style.color = "#00ff00";
        statusIndicator.textContent = "●";
      }
      if (playBtn) playBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;
      if (infoDisplay)
        infoDisplay.textContent = `Playing: ${state.currentPreset || "Custom"}`;
    } else {
      // Use standard "off" state from buttons.css
      if (btn) btn.setAttribute("data-state", "off");
      if (statusIndicator) {
        statusIndicator.style.color = "#666";
        statusIndicator.textContent = "●";
      }
      if (playBtn) playBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
      if (infoDisplay) infoDisplay.textContent = "Ready to start...";
    }
  }

  // Load saved settings from localStorage
  function loadSavedSettings() {
    try {
      const saved = localStorage.getItem("brainwave-settings");
      if (saved) {
        const settings = JSON.parse(saved);

        // Restore volume
        if (settings.volume !== undefined && volumeSlider && volumeDisplay) {
          volumeSlider.value = settings.volume;
          volumeDisplay.textContent = `${settings.volume}%`;
          if (window.brainwaveGenerator) {
            window.brainwaveGenerator.setVolume(settings.volume / 100);
          }
        }

        console.log("💾 Loaded brainwave settings from localStorage");
      }
    } catch (error) {
      console.warn("⚠️ Failed to load brainwave settings:", error);
    }
  }

  // Save settings to localStorage
  function saveSettings() {
    try {
      const settings = {
        volume: volumeSlider ? parseInt(volumeSlider.value) : 10,
      };
      localStorage.setItem("brainwave-settings", JSON.stringify(settings));
    } catch (error) {
      console.warn("⚠️ Failed to save brainwave settings:", error);
    }
  }

  // Load saved settings on initialization
  loadSavedSettings();

  // Note: Toggle dropdown visibility is handled by the DropdownManager
  // The button click is managed by dropdowns.js initializeDropdowns()

  // Volume control
  if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
      const volume = parseInt(e.target.value);
      if (volumeDisplay) volumeDisplay.textContent = `${volume}%`;

      if (window.brainwaveGenerator) {
        window.brainwaveGenerator.setVolume(volume / 100);
      }

      // Save volume setting
      saveSettings();
    });
  }

  // Play button
  if (playBtn) {
    playBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      if (!window.brainwaveGenerator) {
        if (infoDisplay)
          infoDisplay.textContent = "Error: Generator not available";
        return;
      }

      const selectedPreset = presetSelect?.value;

      if (!selectedPreset) {
        if (infoDisplay)
          infoDisplay.textContent = "Please select a preset first";
        return;
      }

      if (infoDisplay) infoDisplay.textContent = "Starting...";

      const success =
        await window.brainwaveGenerator.startPreset(selectedPreset);

      if (success) {
        updateStatus();
        // Send chat notification
        if (window.chatCore) {
          window.chatCore.addMessage(
            "system",
            `🧠 Brainwave session started: ${selectedPreset}`,
          );
        }
      } else {
        if (infoDisplay)
          infoDisplay.textContent =
            "Failed to start. Check console for details.";
      }
    });
  }

  // Stop button
  if (stopBtn) {
    stopBtn.addEventListener("click", (e) => {
      e.preventDefault();

      if (window.brainwaveGenerator) {
        window.brainwaveGenerator.stop();
        updateStatus();

        // Send chat notification
        if (window.chatCore) {
          window.chatCore.addMessage("system", "🧠 Brainwave session stopped");
        }
      }
    });
  }

  // Initialize after DOM load
  setTimeout(initializePresets, 100);

  return content;
}
