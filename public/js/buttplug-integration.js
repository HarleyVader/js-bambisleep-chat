// buttplug-integration.js - Buttplug.io device integration for BambiSleep triggers
// Rebuilt using official buttplug client + WASM server for WebBluetooth

class ButtplugIntegration {
  constructor() {
    this.client = null;
    this.server = null; // WASM server for browser mode
    this.connector = null;
    this.devices = [];
    this.isConnected = false;
    this.isEnabled = false;
    this.connectionMode = "browser"; // "browser" (WASM) or "intiface" (websocket)
    this.serverUrl = "ws://localhost:12345"; // Intiface Central WebSocket URL

    // Trigger intensity mappings (0.0 to 1.0 scale)
    this.triggerPatterns = {
      primary: { intensity: 0.7, duration: 2000 },
      mental: { intensity: 0.5, duration: 3000 },
      physical: { intensity: 0.9, duration: 1500 },
      default: { intensity: 0.6, duration: 2000 },
    };

    // Active patterns tracking
    this.activePatterns = new Map();
    this.brainwaveInterval = null; // Track brainwave pulse interval

    // Load saved settings from localStorage
    this.loadSettings();

    // Load libraries
    this.loadLibraries();
  }

  // Load settings from localStorage
  loadSettings() {
    try {
      const saved = localStorage.getItem("buttplug-settings");
      if (saved) {
        const settings = JSON.parse(saved);

        // Restore connection settings
        if (settings.serverUrl) {
          this.serverUrl = settings.serverUrl;
        }
        if (settings.connectionMode) {
          this.connectionMode = settings.connectionMode;
        }

        // Restore trigger pattern intensities
        if (settings.triggerPatterns) {
          if (settings.triggerPatterns.primary !== undefined) {
            this.triggerPatterns.primary.intensity =
              settings.triggerPatterns.primary;
          }
          if (settings.triggerPatterns.mental !== undefined) {
            this.triggerPatterns.mental.intensity =
              settings.triggerPatterns.mental;
          }
          if (settings.triggerPatterns.physical !== undefined) {
            this.triggerPatterns.physical.intensity =
              settings.triggerPatterns.physical;
          }
        }

        console.log("💾 Loaded Buttplug settings from localStorage:", settings);
      }
    } catch (error) {
      console.warn("⚠️ Failed to load Buttplug settings:", error);
    }
  }

  // Save settings to localStorage
  saveSettings() {
    try {
      const settings = {
        serverUrl: this.serverUrl,
        connectionMode: this.connectionMode,
        vibrationSyncEnabled: window.ttsSystem?.vibrationSyncEnabled ?? true,
        triggerPatterns: {
          primary: this.triggerPatterns.primary.intensity,
          mental: this.triggerPatterns.mental.intensity,
          physical: this.triggerPatterns.physical.intensity,
        },
      };

      localStorage.setItem("buttplug-settings", JSON.stringify(settings));
      console.log("💾 Saved Buttplug settings to localStorage");
    } catch (error) {
      console.warn("⚠️ Failed to save Buttplug settings:", error);
    }
  }

  // Load Buttplug client + WASM server from CDN
  async loadLibraries() {
    try {
      console.log("🔌 Loading Buttplug libraries...");

      // Load client library first (UMD build exposes window.buttplug namespace)
      await this.loadScript(
        "https://cdn.jsdelivr.net/npm/buttplug@3.2.2/dist/web/buttplug.js",
        "buttplug-client",
      );

      // Load WASM server for browser mode (ES module)
      await this.loadWASMServer();

      console.log("✅ Buttplug libraries loaded successfully");
      this.initializeButtplug();
    } catch (error) {
      console.error("❌ Failed to load Buttplug libraries:", error);
      this.showError(
        "Cannot load Buttplug library. CDN may be blocked or offline.",
      );
    }
  }

  // Load script dynamically
  loadScript(url, id) {
    return new Promise((resolve, reject) => {
      if (document.getElementById(id)) {
        console.log(`✅ ${id} already loaded`);
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.id = id;
      script.src = url;
      script.async = true;
      script.onload = () => {
        console.log(`✅ Loaded: ${id}`);
        resolve();
      };
      script.onerror = () =>
        reject(new Error(`Failed to load ${id} from ${url}`));
      document.head.appendChild(script);
    });
  }

  // Load WASM server as ES module
  async loadWASMServer() {
    try {
      // The WASM server is ~5MB, so this may take a moment
      console.log("🔄 Loading WASM server (may take a few seconds, ~5MB)...");

      const module =
        await import("https://cdn.jsdelivr.net/npm/buttplug-wasm@2.0.1/dist/buttplug-wasm.mjs");
      window.ButtplugWASM = module;

      console.log("✅ WASM server loaded");
    } catch (error) {
      console.warn("⚠️ WASM server failed to load:", error);
      console.warn(
        "Browser mode will not be available. Intiface mode still works.",
      );
    }
  }

  // Initialize Buttplug client
  initializeButtplug() {
    try {
      // UMD build exposes window.buttplug (lowercase)
      if (!window.buttplug) {
        console.error("❌ Buttplug library not available");
        return;
      }

      // Create client (using lowercase buttplug namespace)
      this.client = new window.buttplug.ButtplugClient("BambiSleep Chat");

      // Set up event listeners
      this.client.addListener("deviceadded", (device) =>
        this.onDeviceAdded(device),
      );
      this.client.addListener("deviceremoved", (device) =>
        this.onDeviceRemoved(device),
      );
      this.client.addListener("scanningfinished", () =>
        this.onScanningFinished(),
      );

      console.log("✅ Buttplug client initialized");
    } catch (error) {
      console.error("❌ Failed to initialize Buttplug client:", error);
      this.showError("Failed to initialize Buttplug client");
    }
  }

  // Connect to server
  async connect(mode = "browser", serverUrl = null) {
    if (this.isConnected) {
      console.warn("⚠️ Already connected");
      return true;
    }

    if (!this.client) {
      const errorMsg =
        "Buttplug library failed to load. CDN may be blocked or offline.";
      console.error("❌", errorMsg);
      this.showError(errorMsg);
      return false;
    }

    try {
      this.connectionMode = mode;

      if (mode === "browser") {
        // Use WASM connector for direct WebBluetooth
        if (!window.ButtplugWASM || !window.ButtplugWASM.ButtplugWasmClientConnector) {
          throw new Error("WASM connector not loaded. Try Intiface mode instead.");
        }

        console.log("🔄 Connecting via WASM (WebBluetooth)...");

        // Create WASM connector (handles WebBluetooth internally)
        this.connector = new window.ButtplugWASM.ButtplugWasmClientConnector();
        
        // Connect the Buttplug client to the WASM connector
        await this.client.connect(this.connector);
        console.log("✅ Connected via WASM server");
      } else {
        // Use websocket to connect to Intiface Central
        this.serverUrl = serverUrl || this.serverUrl;
        console.log(
          `🔄 Connecting to Intiface Central at ${this.serverUrl}...`,
        );

        this.connector =
          new window.buttplug.ButtplugBrowserWebsocketClientConnector(
            this.serverUrl,
          );
        await this.client.connect(this.connector);
        console.log("✅ Connected to Intiface Central");
      }

      this.isConnected = true;
      this.saveSettings();
      return true;
    } catch (error) {
      console.error("❌ Connection failed:", error);
      this.isConnected = false;
      return false;
    }
  }

  // Disconnect from server
  async disconnect() {
    if (!this.isConnected) return;

    try {
      await this.stopAllDevices();
      if (this.client) {
        await this.client.disconnect();
      }
      this.isConnected = false;
      this.devices = [];
      console.log("⚫ Disconnected from Buttplug server");
    } catch (error) {
      console.error("❌ Error disconnecting:", error);
    }
  }

  // Start scanning for devices
  async startScanning() {
    if (!this.isConnected) {
      console.error("❌ Not connected to server");
      return;
    }

    try {
      console.log("🔍 Scanning for devices...");
      await this.client.startScanning();
    } catch (error) {
      console.error("❌ Scan failed:", error);
    }
  }

  // Stop scanning
  async stopScanning() {
    if (!this.isConnected) return;

    try {
      await this.client.stopScanning();
      console.log("⏹️ Stopped scanning");
    } catch (error) {
      console.error("❌ Error stopping scan:", error);
    }
  }

  // Device added event
  onDeviceAdded(device) {
    console.log(`📱 Device added: ${device.name}`);
    this.devices.push(device);
    this.broadcastDeviceUpdate();
  }

  // Device removed event
  onDeviceRemoved(device) {
    console.log(`📴 Device removed: ${device.name}`);
    this.devices = this.devices.filter((d) => d.index !== device.index);
    this.broadcastDeviceUpdate();
  }

  // Scanning finished event
  onScanningFinished() {
    console.log("✅ Device scan complete");
  }

  // Broadcast device list update
  broadcastDeviceUpdate() {
    const deviceInfo = this.devices.map((device) => ({
      name: device.name,
      index: device.index,
      hasVibrate: device.vibrateAttributes.length > 0,
      hasBattery: device.hasBattery,
    }));

    document.dispatchEvent(
      new CustomEvent("buttplug-devices-updated", {
        detail: { devices: deviceInfo },
      }),
    );
  }

  // Trigger device based on BambiSleep trigger
  async triggerDevice(triggerName, category) {
    if (!this.isConnected || !this.isEnabled || this.devices.length === 0) {
      return;
    }

    // Get pattern based on category
    const pattern =
      this.triggerPatterns[category] || this.triggerPatterns.default;

    console.log(`🎯 Triggering devices for: ${triggerName} (${category})`);

    // Activate all vibrating devices
    for (const device of this.devices) {
      if (device.vibrateAttributes.length > 0) {
        await this.activateDevice(device, pattern);
      }
    }
  }

  // Activate a specific device with pattern
  async activateDevice(device, pattern) {
    try {
      // Send vibration command
      await device.vibrate(pattern.intensity);

      // Store timeout for auto-stop
      const timeoutId = setTimeout(async () => {
        await device.stop();
        this.activePatterns.delete(device.index);
      }, pattern.duration);

      this.activePatterns.set(device.index, timeoutId);
    } catch (error) {
      console.error(`❌ Error activating device ${device.name}:`, error);
    }
  }

  // Vibrate all devices during TTS playback
  async vibrateDuringTTS(text, duration) {
    if (!this.isConnected || !this.isEnabled || this.devices.length === 0) {
      return;
    }

    console.log(`🔊 TTS vibration starting for ${duration}ms`);

    // Default gentle vibration for speech
    const intensity = 0.4;

    // Activate all vibrating devices with gentle continuous vibration
    for (const device of this.devices) {
      if (device.vibrateAttributes && device.vibrateAttributes.length > 0) {
        try {
          await device.vibrate(intensity);

          // Store timeout for auto-stop
          const timeoutId = setTimeout(async () => {
            try {
              await device.stop();
              this.activePatterns.delete(device.index);
            } catch (error) {
              console.error(`❌ Error auto-stopping device:`, error);
            }
          }, duration);

          this.activePatterns.set(device.index, timeoutId);
        } catch (error) {
          console.error(`❌ Error vibrating device ${device.name}:`, error);
        }
      }
    }
  }

  // Stop all device vibrations
  async stopAllDevices() {
    // Clear all active pattern timeouts
    for (const timeoutId of this.activePatterns.values()) {
      clearTimeout(timeoutId);
    }
    this.activePatterns.clear();

    // Stop all devices
    for (const device of this.devices) {
      try {
        await device.stop();
      } catch (error) {
        console.error(`❌ Error stopping device ${device.name}:`, error);
      }
    }
  }

  // Vibrate in sync with brainwave binaural beats
  async vibrateWithBrainwave(beatFreq) {
    if (!this.isConnected || !this.isEnabled || this.devices.length === 0) {
      return;
    }

    console.log(`🧠 Brainwave sync vibration: ${beatFreq}Hz`);

    // Map brainwave frequency to vibration pattern
    // Lower frequencies = slower pulses, higher = faster
    const pulseInterval = Math.max(100, 1000 / beatFreq); // Convert Hz to ms interval
    const intensity = 0.3; // Gentle for continuous brainwave sync

    // Stop any existing brainwave pattern
    this.stopBrainwaveVibration();

    // Create pulsing pattern synced to brainwave frequency
    this.brainwaveInterval = setInterval(async () => {
      for (const device of this.devices) {
        if (device.vibrateAttributes && device.vibrateAttributes.length > 0) {
          try {
            // Pulse on
            await device.vibrate(intensity);
            // Pulse off after half interval
            setTimeout(async () => {
              try {
                await device.vibrate(0);
              } catch (error) {
                // Ignore errors during pulse off
              }
            }, pulseInterval / 2);
          } catch (error) {
            console.error(`❌ Error pulsing device:`, error);
          }
        }
      }
    }, pulseInterval);
  }

  // Stop brainwave vibration
  stopBrainwaveVibration() {
    if (this.brainwaveInterval) {
      clearInterval(this.brainwaveInterval);
      this.brainwaveInterval = null;
      this.stopAllDevices();
    }
  }

  // Enable/disable the integration
  toggle() {
    this.isEnabled = !this.isEnabled;

    if (!this.isEnabled) {
      this.stopAllDevices();
      this.stopBrainwaveVibration();
    }

    console.log(
      `🔌 Buttplug integration ${this.isEnabled ? "ENABLED" : "DISABLED"}`,
    );
    return this.isEnabled;
  }

  // Get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      isEnabled: this.isEnabled,
      deviceCount: this.devices.length,
      devices: this.devices.map((d) => d.name),
      mode: this.connectionMode,
    };
  }

  // Show error message to user
  showError(message) {
    console.error(`🔌 Buttplug Error: ${message}`);

    // Update UI if status element exists
    const statusDiv = document.getElementById("buttplug-status-text");
    if (statusDiv) {
      statusDiv.textContent = `Error: ${message}`;
      statusDiv.style.color = "#ff0000";
    }

    // Dispatch error event
    const event = new CustomEvent("buttplug-error", {
      detail: { message },
    });
    document.dispatchEvent(event);
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.buttplugIntegration = new ButtplugIntegration();

  // Listen for trigger events from the trigger system
  document.addEventListener("trigger-detected", async (event) => {
    const { triggerName, category } = event.detail;

    if (window.buttplugIntegration) {
      await window.buttplugIntegration.triggerDevice(triggerName, category);
    }
  });

  // Listen for brainwave events
  document.addEventListener("brainwave-started", async (event) => {
    const { beatFreq } = event.detail;
    console.log(`🧠 Brainwave started, syncing buttplug to ${beatFreq}Hz`);

    if (window.buttplugIntegration) {
      await window.buttplugIntegration.vibrateWithBrainwave(beatFreq);
    }
  });

  document.addEventListener("brainwave-stopped", async () => {
    console.log("🧠 Brainwave stopped, stopping buttplug vibration");

    if (window.buttplugIntegration) {
      window.buttplugIntegration.stopBrainwaveVibration();
    }
  });
});
