// buttplug-dropdown.js - UI controls for Buttplug.io device integration
export function ButtplugDropdown() {
  const container = document.createElement("div");
  container.className = "buttplug-controls";
  container.innerHTML = `
    <div class="control-section">
      <h3>🔌 Device Integration</h3>
      <p class="info-text">Connect intimate hardware to BambiSleep triggers using Buttplug.io</p>
      
      <div class="connection-section">
        <div class="mode-selector">
          <h4>Connection Mode:</h4>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="connection-mode" value="browser" checked />
              <span>🌐 Browser (WebBluetooth) - Recommended</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="connection-mode" value="intiface" />
              <span>🖥️ Intiface Central (Advanced)</span>
            </label>
          </div>
        </div>

        <div id="intiface-config" class="intiface-config" style="display: none;">
          <div class="control-row">
            <label>Server URL:</label>
            <input 
              type="text" 
              id="buttplug-server-url" 
              class="url-input"
              value=""
              placeholder="ws://localhost:12345"
            />
          </div>
        </div>
        
        <div class="button-row">
          <button id="buttplug-connect-btn" class="control-button">
            🔌 Connect
          </button>
          <button id="buttplug-disconnect-btn" class="control-button" disabled>
            Disconnect
          </button>
        </div>
        
        <div class="status-row">
          <span id="buttplug-connection-status" class="status-text">
            ⚫ Not Connected
          </span>
        </div>
      </div>

      <div class="device-section">
        <h4>📱 Connected Devices</h4>
        <button id="buttplug-scan-btn" class="control-button" disabled>
          🔍 Scan for Devices
        </button>
        
        <div id="buttplug-device-list" class="device-list">
          <p class="empty-text">No devices connected</p>
        </div>
      </div>

      <div class="control-section">
        <h4>⚙️ Trigger Patterns</h4>
        
        <div class="pattern-config">
          <div class="pattern-row">
            <label>Primary Triggers (Bambi, Good Girl):</label>
            <div class="slider-group">
              <label>Intensity:</label>
              <input 
                type="range" 
                id="primary-intensity" 
                min="0" 
                max="100" 
                value="70"
                class="intensity-slider"
              />
              <span id="primary-intensity-value">70%</span>
            </div>
          </div>

          <div class="pattern-row">
            <label>Mental Triggers (Blonde Moment, etc):</label>
            <div class="slider-group">
              <label>Intensity:</label>
              <input 
                type="range" 
                id="mental-intensity" 
                min="0" 
                max="100" 
                value="50"
                class="intensity-slider"
              />
              <span id="mental-intensity-value">50%</span>
            </div>
          </div>

          <div class="pattern-row">
            <label>Physical Triggers (Drop, Freeze, etc):</label>
            <div class="slider-group">
              <label>Intensity:</label>
              <input 
                type="range" 
                id="physical-intensity" 
                min="0" 
                max="100" 
                value="90"
                class="intensity-slider"
              />
              <span id="physical-intensity-value">90%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="audio-sync-section">
        <h4>🎵 Audio Pattern Synchronization</h4>
        <label class="checkbox-label">
          <input type="checkbox" id="audio-sync-toggle" checked />
          Sync vibrations with speech patterns (emphasis, pitch, volume)
        </label>
        <p class="info-text">
          When enabled, device vibration intensity automatically adjusts based on
          real-time audio analysis. Stronger vibrations during emphasis and peaks.
        </p>
      </div>

      <div class="test-section">
        <button id="buttplug-test-btn" class="control-button" disabled>
          🎯 Test Vibration
        </button>
        <button id="buttplug-stop-btn" class="control-button danger-button" disabled>
          ⛔ Emergency Stop
        </button>
      </div>

      <div class="info-section">
        <h4>ℹ️ Browser Mode (Recommended)</h4>
        <ol class="instruction-list">
          <li>Select "Browser (WebBluetooth)" mode above</li>
          <li>Click "🔌 Connect" button</li>
          <li>Click "🔍 Scan for Devices"</li>
          <li>Select your device from browser's Bluetooth pairing dialog</li>
          <li>Enable triggers (🎯 Triggers button) to activate device responses</li>
        </ol>
        
        <h4>ℹ️ Intiface Mode (Advanced)</h4>
        <ol class="instruction-list">
          <li>Download <a href="https://intiface.com/central/" target="_blank">Intiface Central</a> and start server</li>
          <li>Select "Intiface Central" mode above</li>
          <li>Verify Server URL (default: ws://localhost:12345)</li>
          <li>Click "🔌 Connect" button</li>
          <li>Click "🔍 Scan for Devices" to find your hardware</li>
        </ol>
        
        <p class="info-text">
          💡 <strong>Browser mode</strong> works directly in Chrome/Edge without extra software!
        </p>
        <p class="warning-text">
          ⚠️ Browser mode requires Chrome, Edge, or Opera with Bluetooth enabled
        </p>
      </div>
    </div>
  `;

  const modeRadios = container.querySelectorAll(
    'input[name="connection-mode"]',
  );
  const intifaceConfig = container.querySelector("#intiface-config");

  // Intensity sliders
  const primaryIntensity = container.querySelector("#primary-intensity");
  const mentalIntensity = container.querySelector("#mental-intensity");
  const physicalIntensity = container.querySelector("#physical-intensity");

  // Load saved settings into UI
  function loadSavedSettings() {
    try {
      const saved = localStorage.getItem("buttplug-settings");
      if (saved) {
        const settings = JSON.parse(saved);

        // Set connection mode
        if (settings.connectionMode) {
          const modeRadio = container.querySelector(
            `input[name="connection-mode"][value="${settings.connectionMode}"]`,
          );
          if (modeRadio) {
            modeRadio.checked = true;
            if (settings.connectionMode === "intiface") {
              intifaceConfig.style.display = "block";
            }
          }
        }

        // Set server URL
        if (settings.serverUrl) {
          const urlInput = container.querySelector("#buttplug-server-url");
          if (urlInput) {
            urlInput.value = settings.serverUrl;
          }
        } else {
          // Set default if no saved URL
          const urlInput = container.querySelector("#buttplug-server-url");
          if (urlInput && !urlInput.value) {
            urlInput.value = "ws://localhost:12345";
          }
        }

        // Set trigger pattern intensities
        if (settings.triggerPatterns) {
          if (settings.triggerPatterns.primary !== undefined) {
            const value = Math.round(settings.triggerPatterns.primary * 100);
            if (primaryIntensity) {
              primaryIntensity.value = value;
              container.querySelector("#primary-intensity-value").textContent =
                `${value}%`;
            }
          }
          if (settings.triggerPatterns.mental !== undefined) {
            const value = Math.round(settings.triggerPatterns.mental * 100);
            if (mentalIntensity) {
              mentalIntensity.value = value;
              container.querySelector("#mental-intensity-value").textContent =
                `${value}%`;
            }
          }
          if (settings.triggerPatterns.physical !== undefined) {
            const value = Math.round(settings.triggerPatterns.physical * 100);
            if (physicalIntensity) {
              physicalIntensity.value = value;
              container.querySelector("#physical-intensity-value").textContent =
                `${value}%`;
            }
          }
        }

        // Restore audio sync toggle state
        if (settings.vibrationSyncEnabled !== undefined) {
          const audioSyncToggle = container.querySelector("#audio-sync-toggle");
          if (audioSyncToggle) {
            audioSyncToggle.checked = settings.vibrationSyncEnabled;
            if (window.ttsSystem) {
              window.ttsSystem.vibrationSyncEnabled =
                settings.vibrationSyncEnabled;
            }
          }
        }
      } else {
        // Set default URL if no saved settings
        const urlInput = container.querySelector("#buttplug-server-url");
        if (urlInput && !urlInput.value) {
          urlInput.value = "ws://localhost:12345";
        }
      }
    } catch (error) {
      console.warn("⚠️ Failed to load saved Buttplug UI settings:", error);
      // Set default URL on error
      const urlInput = container.querySelector("#buttplug-server-url");
      if (urlInput && !urlInput.value) {
        urlInput.value = "ws://localhost:12345";
      }
    }
  }

  // Load settings when dropdown is created
  loadSavedSettings();

  // Handle connection mode switch
  modeRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (e.target.value === "intiface") {
        intifaceConfig.style.display = "block";
      } else {
        intifaceConfig.style.display = "none";
      }

      // Save connection mode preference
      if (window.buttplugIntegration) {
        window.buttplugIntegration.connectionMode = e.target.value;
        window.buttplugIntegration.saveSettings();
      }
    });
  });
  const connectBtn = container.querySelector("#buttplug-connect-btn");
  const disconnectBtn = container.querySelector("#buttplug-disconnect-btn");
  const scanBtn = container.querySelector("#buttplug-scan-btn");
  const testBtn = container.querySelector("#buttplug-test-btn");
  const stopBtn = container.querySelector("#buttplug-stop-btn");
  const serverUrlInput = container.querySelector("#buttplug-server-url");
  const statusText = container.querySelector("#buttplug-connection-status");
  const deviceList = container.querySelector("#buttplug-device-list");
  const audioSyncToggle = container.querySelector("#audio-sync-toggle");

  // Audio sync toggle
  audioSyncToggle?.addEventListener("change", (e) => {
    if (window.ttsSystem) {
      window.ttsSystem.vibrationSyncEnabled = e.target.checked;
      console.log(
        `🎵 Audio pattern vibration sync ${e.target.checked ? "ENABLED" : "DISABLED"}`,
      );
      // Save setting
      if (window.buttplugIntegration) {
        window.buttplugIntegration.saveSettings();
      }
    }
  });

  // Update intensity displays
  // Save server URL when changed
  serverUrlInput?.addEventListener("blur", (e) => {
    if (window.buttplugIntegration) {
      window.buttplugIntegration.serverUrl = e.target.value.trim();
      window.buttplugIntegration.saveSettings();
    }
  });

  primaryIntensity?.addEventListener("input", (e) => {
    container.querySelector("#primary-intensity-value").textContent =
      `${e.target.value}%`;
    if (window.buttplugIntegration) {
      window.buttplugIntegration.triggerPatterns.primary.intensity =
        e.target.value / 100;
      window.buttplugIntegration.saveSettings();
    }
  });

  mentalIntensity?.addEventListener("input", (e) => {
    container.querySelector("#mental-intensity-value").textContent =
      `${e.target.value}%`;
    if (window.buttplugIntegration) {
      window.buttplugIntegration.triggerPatterns.mental.intensity =
        e.target.value / 100;
      window.buttplugIntegration.saveSettings();
    }
  });

  physicalIntensity?.addEventListener("input", (e) => {
    container.querySelector("#physical-intensity-value").textContent =
      `${e.target.value}%`;
    if (window.buttplugIntegration) {
      window.buttplugIntegration.triggerPatterns.physical.intensity =
        e.target.value / 100;
      window.buttplugIntegration.saveSettings();
    }
  });

  // Check if library loaded successfully
  function checkLibraryStatus() {
    if (!window.buttplugIntegration?.client) {
      statusText.textContent =
        "❌ Library failed to load - CDN blocked or offline";
      statusText.style.color = "var(--error-color)";
      connectBtn.disabled = true;
      return false;
    }
    return true;
  }

  // Initial check
  setTimeout(() => checkLibraryStatus(), 2000);

  // Connect button
  connectBtn?.addEventListener("click", async () => {
    if (!window.buttplugIntegration) {
      statusText.textContent = "❌ Buttplug integration not loaded";
      statusText.style.color = "var(--error-color)";
      return;
    }

    if (!checkLibraryStatus()) {
      return;
    }

    // Get selected connection mode
    const selectedMode =
      container.querySelector('input[name="connection-mode"]:checked')?.value ||
      "browser";
    const serverUrl = serverUrlInput.value.trim();

    connectBtn.disabled = true;
    statusText.textContent =
      selectedMode === "browser"
        ? "🔄 Connecting via WebBluetooth..."
        : "🔄 Connecting to Intiface...";
    statusText.style.color = "var(--warning-color)";

    const success = await window.buttplugIntegration.connect(
      selectedMode,
      serverUrl,
    );

    if (success) {
      statusText.textContent =
        selectedMode === "browser"
          ? "✅ Connected (Browser)"
          : "✅ Connected (Intiface)";
      statusText.style.color = "var(--success-color)";
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
      scanBtn.disabled = false;
      testBtn.disabled = false;
      stopBtn.disabled = false;

      // Update status indicator
      updateStatusIndicator(true);
    } else {
      statusText.textContent = "❌ Connection Failed";
      if (selectedMode === "browser") {
        statusText.textContent += " - Check browser Bluetooth support";
      } else {
        statusText.textContent += " - Is Intiface Central running?";
      }
      statusText.style.color = "var(--error-color)";
      connectBtn.disabled = false;
    }
  });

  // Disconnect button
  disconnectBtn?.addEventListener("click", async () => {
    if (!window.buttplugIntegration) return;

    await window.buttplugIntegration.disconnect();

    statusText.textContent = "⚫ Disconnected";
    statusText.style.color = "var(--text-color)";
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    scanBtn.disabled = true;
    testBtn.disabled = true;
    stopBtn.disabled = true;

    // Clear device list
    deviceList.innerHTML = '<p class="empty-text">No devices connected</p>';

    // Update status indicator
    updateStatusIndicator(false);
  });

  // Scan button
  scanBtn?.addEventListener("click", async () => {
    if (!window.buttplugIntegration) return;

    await window.buttplugIntegration.startScanning();
    statusText.textContent = "🔍 Scanning for devices...";
  });

  // Test button
  testBtn?.addEventListener("click", async () => {
    if (!window.buttplugIntegration) return;

    await window.buttplugIntegration.triggerDevice("TEST", "primary");
  });

  // Stop button
  stopBtn?.addEventListener("click", async () => {
    if (!window.buttplugIntegration) return;

    await window.buttplugIntegration.stopAllDevices();
  });

  // Listen for device updates
  document.addEventListener("buttplug-devices-updated", (event) => {
    const { devices } = event.detail;

    if (devices.length === 0) {
      deviceList.innerHTML = '<p class="empty-text">No devices connected</p>';
      return;
    }

    deviceList.innerHTML = devices
      .map(
        (device) => `
      <div class="device-item">
        <span class="device-icon">${device.hasVibrate ? "📳" : "🔌"}</span>
        <span class="device-name">${device.name}</span>
        <span class="device-status">✅ Connected</span>
      </div>
    `,
      )
      .join("");
  });

  return container;
}

function updateStatusIndicator(connected) {
  const statusIndicator = document.querySelector("#buttplug-status");
  if (statusIndicator) {
    statusIndicator.style.color = connected
      ? "var(--success-color)"
      : "var(--error-color)";
  }
}
