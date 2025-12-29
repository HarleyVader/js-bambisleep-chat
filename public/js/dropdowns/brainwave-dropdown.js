export function createBrainwaveDropdown() {
  const dropdown = document.createElement("div");
  dropdown.className = "dropdown brainwave-dropdown";
  dropdown.innerHTML = `
        <button class="dropdown-btn toggle-button" id="brainwave-btn" data-state="off">
            🧠 Brainwaves
            <span class="status-indicator" id="brainwave-status">●</span>
        </button>
        <div class="dropdown-content" id="brainwave-content">
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
        </div>
    `;

  // Get elements for interaction
  const btn = dropdown.querySelector("#brainwave-btn");
  const content = dropdown.querySelector("#brainwave-content");
  const presetSelect = dropdown.querySelector("#brainwave-preset");
  const volumeSlider = dropdown.querySelector("#brainwave-volume");
  const volumeDisplay = dropdown.querySelector("#volume-display");
  const playBtn = dropdown.querySelector("#brainwave-play");
  const stopBtn = dropdown.querySelector("#brainwave-stop");
  const statusIndicator = dropdown.querySelector("#brainwave-status");
  const infoDisplay = dropdown.querySelector("#brainwave-info");

  // Initialize preset options
  function initializePresets() {
    if (!window.brainwaveGenerator) {
      setTimeout(initializePresets, 100);
      return;
    }

    const presets = window.brainwaveGenerator.getPresets();
    presets.forEach((preset) => {
      const option = document.createElement("option");
      option.value = preset.name;
      option.textContent = `${preset.name} (${preset.beat}Hz)`;
      option.title = preset.description;
      presetSelect.appendChild(option);
    });

    playBtn.disabled = false;
    updateStatus();
  }

  // Update UI status using standard button states from buttons.css
  function updateStatus() {
    if (!window.brainwaveGenerator) return;

    const state = window.brainwaveGenerator.getCurrentState();

    if (state.isPlaying) {
      // Use standard "on" state from buttons.css
      btn.setAttribute("data-state", "on");
      statusIndicator.style.color = "#00ff00";
      statusIndicator.textContent = "●";
      playBtn.disabled = true;
      stopBtn.disabled = false;
      infoDisplay.textContent = `Playing: ${state.currentPreset || "Custom"}`;
    } else {
      // Use standard "off" state from buttons.css
      btn.setAttribute("data-state", "off");
      statusIndicator.style.color = "#666";
      statusIndicator.textContent = "●";
      playBtn.disabled = false;
      stopBtn.disabled = true;
      infoDisplay.textContent = "Ready to start...";
    }
  }

  // Toggle dropdown visibility
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    content.style.display =
      content.style.display === "block" ? "none" : "block";
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) {
      content.style.display = "none";
    }
  });

  // Volume control
  volumeSlider.addEventListener("input", (e) => {
    const volume = parseInt(e.target.value);
    volumeDisplay.textContent = `${volume}%`;

    if (window.brainwaveGenerator) {
      window.brainwaveGenerator.setVolume(volume / 100);
    }
  });

  // Play button
  playBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    if (!window.brainwaveGenerator) {
      infoDisplay.textContent = "Error: Generator not available";
      return;
    }

    const selectedPreset = presetSelect.value;

    if (!selectedPreset) {
      infoDisplay.textContent = "Please select a preset first";
      return;
    }

    infoDisplay.textContent = "Starting...";

    const success = await window.brainwaveGenerator.startPreset(selectedPreset);

    if (success) {
      updateStatus();
      // Send chat notification
      if (window.chatCore) {
        window.chatCore.addMessage(
          "system",
          `🧠 Brainwave session started: ${selectedPreset}`
        );
      }
    } else {
      infoDisplay.textContent = "Failed to start. Check console for details.";
    }
  });

  // Stop button
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

  // Initialize after DOM load
  setTimeout(initializePresets, 100);

  return dropdown;
}
