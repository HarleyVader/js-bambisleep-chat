// buttplug-integration.js - Buttplug.io device integration for BambiSleep triggers
// Connects intimate hardware to trigger word detection for enhanced experience

class ButtplugIntegration {
  constructor() {
    this.client = null;
    this.connector = null;
    this.devices = [];
    this.isConnected = false;
    this.isEnabled = false;
    this.connectionMode = "browser"; // "browser" or "intiface"
    this.serverUrl = "ws://localhost:12345"; // Default Intiface Central WebSocket URL (fallback)

    // Trigger intensity mappings (0.0 to 1.0 scale)
    this.triggerPatterns = {
      // Primary triggers - Medium to high intensity
      primary: {
        intensity: 0.7,
        duration: 2000,
        pattern: "pulse",
      },

      // Mental triggers - Low to medium intensity, longer duration
      mental: {
        intensity: 0.5,
        duration: 3000,
        pattern: "wave",
      },

      // Physical triggers - High intensity, short bursts
      physical: {
        intensity: 0.9,
        duration: 1500,
        pattern: "burst",
      },

      // Default pattern for uncategorized triggers
      default: {
        intensity: 0.6,
        duration: 2000,
        pattern: "steady",
      },
    };

    // Active patterns tracking
    this.activePatterns = new Map();

    // Load Buttplug.io library
    this.loadButtplugLibrary();
  }

  // Load the Buttplug.io library from CDN
  async loadButtplugLibrary() {
    try {
      // Check if buttplug is already loaded
      if (window.Buttplug) {
        console.log("🔌 Buttplug.io library already loaded");
        this.initializeButtplug();
        return;
      }

      // CDN sources with fallback
      const cdnSources = [
        "https://cdn.jsdelivr.net/npm/buttplug@3.2.4/dist/web/buttplug.min.js",
        "https://unpkg.com/buttplug@3.2.4/dist/web/buttplug.min.js",
      ];

      this.tryLoadFromCDN(cdnSources, 0);
    } catch (error) {
      console.error("❌ Error loading Buttplug.io library:", error);
      this.showError("Failed to initialize Buttplug library");
    }
  }

  // Try loading from CDN with fallback
  tryLoadFromCDN(sources, index) {
    if (index >= sources.length) {
      console.error("❌ All CDN sources failed for Buttplug.io library");
      this.showError(
        "Cannot load Buttplug library. Please check your internet connection.",
      );
      return;
    }

    const script = document.createElement("script");
    script.src = sources[index];
    script.async = true;

    script.onload = () => {
      console.log(`✅ Buttplug.io library loaded from: ${sources[index]}`);
      this.initializeButtplug();
    };

    script.onerror = () => {
      console.warn(
        `⚠️ Failed to load from ${sources[index]}, trying next source...`,
      );
      document.head.removeChild(script);
      this.tryLoadFromCDN(sources, index + 1);
    };

    document.head.appendChild(script);
  }

  // Initialize Buttplug client
  initializeButtplug() {
    try {
      if (!window.Buttplug) {
        console.error("❌ Buttplug.io library not available");
        return;
      }

      // Create client instance
      this.client = new window.Buttplug.ButtplugClient("BambiSleep Chat");

      // Set up event listeners
      this.setupEventListeners();

      console.log("✅ Buttplug client initialized");
    } catch (error) {
      console.error("❌ Failed to initialize Buttplug client:", error);
    }
  }

  // Set up event listeners for device connection/disconnection
  setupEventListeners() {
    if (!this.client) return;

    // Device added event
    this.client.addListener("deviceadded", (device) => {
      console.log(`🔌 Device connected: ${device.name}`);
      this.devices.push(device);
      this.updateDeviceList();
    });

    // Device removed event
    this.client.addListener("deviceremoved", (device) => {
      console.log(`🔌 Device disconnected: ${device.name}`);
      this.devices = this.devices.filter((d) => d.index !== device.index);
      this.updateDeviceList();
    });

    // Scanning finished event
    this.client.addListener("scanningfinished", () => {
      console.log("🔍 Device scanning finished");
    });
  }

  // Connect using browser WebBluetooth or Intiface Central
  async connect(mode = "browser", serverUrl = null) {
    if (this.isConnected) {
      console.warn("⚠️ Already connected");
      return true;
    }

    if (!this.client) {
      const errorMsg = "Buttplug library failed to load. CDN may be blocked or offline.";
      console.error("❌", errorMsg);
      this.showError(errorMsg);
      return false;
    }

    try {
      this.connectionMode = mode;

      if (mode === "browser") {
        // Use browser's built-in WebBluetooth
        console.log("🔌 Connecting via WebBluetooth (browser-native)...");

        // Check if WebBluetooth is supported
        if (!navigator.bluetooth) {
          console.error("❌ WebBluetooth not supported in this browser");
          console.log("💡 Try Chrome, Edge, or Opera. Or use Intiface mode.");
          return false;
        }

        // Create embedded connector (uses browser's WebBluetooth)
        this.connector = new window.Buttplug.ButtplugEmbeddedConnectorOptions();

        await this.client.connect(this.connector);

        this.isConnected = true;
        console.log(
          "✅ Connected via WebBluetooth (direct browser connection)",
        );
        console.log("💡 Click 'Scan for Devices' to find Bluetooth devices");
      } else {
        // Use Intiface Central WebSocket connection
        const url = serverUrl || this.serverUrl;

        console.log(`🔌 Connecting to Intiface Central at ${url}...`);

        this.connector =
          new window.Buttplug.ButtplugBrowserWebsocketClientConnector(url);

        await this.client.connect(this.connector);

        this.isConnected = true;
        console.log("✅ Connected to Intiface Central successfully");
      }

      // Start scanning for devices
      await this.startScanning();

      return true;
    } catch (error) {
      console.error("❌ Failed to connect to Buttplug server:", error);
      this.isConnected = false;
      return false;
    }
  }

  // Disconnect from server
  async disconnect() {
    if (!this.isConnected) return;

    try {
      await this.stopAllDevices();
      await this.client.disconnect();

      this.isConnected = false;
      this.devices = [];

      console.log("✅ Disconnected from Buttplug server");
    } catch (error) {
      console.error("❌ Error disconnecting:", error);
    }
  }

  // Start scanning for devices
  async startScanning() {
    if (!this.isConnected) {
      console.warn("⚠️ Not connected to server");
      return;
    }

    try {
      console.log("🔍 Scanning for devices...");
      await this.client.startScanning();
    } catch (error) {
      console.error("❌ Error starting device scan:", error);
    }
  }

  // Stop scanning for devices
  async stopScanning() {
    try {
      await this.client.stopScanning();
      console.log("🔍 Device scanning stopped");
    } catch (error) {
      console.error("❌ Error stopping device scan:", error);
    }
  }

  // Trigger device response based on trigger word and category
  async triggerDevice(triggerName, category = "default") {
    if (!this.isEnabled || !this.isConnected || this.devices.length === 0) {
      return;
    }

    try {
      const pattern =
        this.triggerPatterns[category.toLowerCase()] ||
        this.triggerPatterns.default;

      console.log(
        `🎯 Trigger activated: ${triggerName} (${category}) - ${pattern.pattern} pattern`,
      );

      // Execute pattern on all connected devices
      for (const device of this.devices) {
        await this.executePattern(device, pattern, triggerName);
      }
    } catch (error) {
      console.error("❌ Error triggering device:", error);
    }
  }

  // Execute vibration pattern on a device
  async executePattern(device, pattern, triggerName) {
    const patternId = `${device.index}-${Date.now()}`;

    try {
      switch (pattern.pattern) {
        case "pulse":
          await this.pulsePattern(device, pattern, patternId);
          break;

        case "wave":
          await this.wavePattern(device, pattern, patternId);
          break;

        case "burst":
          await this.burstPattern(device, pattern, patternId);
          break;

        case "steady":
        default:
          await this.steadyPattern(device, pattern, patternId);
          break;
      }
    } catch (error) {
      console.error(`❌ Error executing pattern on ${device.name}:`, error);
    }
  }

  // Steady vibration pattern
  async steadyPattern(device, pattern, patternId) {
    const { intensity, duration } = pattern;

    // Start vibration
    await this.vibrateDevice(device, intensity);

    // Store pattern for cleanup
    this.activePatterns.set(patternId, {
      device,
      timeout: setTimeout(async () => {
        await this.vibrateDevice(device, 0);
        this.activePatterns.delete(patternId);
      }, duration),
    });
  }

  // Pulsing vibration pattern
  async pulsePattern(device, pattern, patternId) {
    const { intensity, duration } = pattern;
    const pulseInterval = 500; // ms between pulses
    const pulses = Math.floor(duration / pulseInterval);

    let currentPulse = 0;

    const pulseIntervalId = setInterval(async () => {
      if (currentPulse >= pulses) {
        clearInterval(pulseIntervalId);
        await this.vibrateDevice(device, 0);
        this.activePatterns.delete(patternId);
        return;
      }

      // Alternate between on and off
      const vibeIntensity = currentPulse % 2 === 0 ? intensity : 0;
      await this.vibrateDevice(device, vibeIntensity);

      currentPulse++;
    }, pulseInterval);

    this.activePatterns.set(patternId, {
      device,
      interval: pulseIntervalId,
    });
  }

  // Wave vibration pattern (gradual increase and decrease)
  async wavePattern(device, pattern, patternId) {
    const { intensity, duration } = pattern;
    const steps = 20; // Number of steps in the wave
    const stepDuration = duration / steps;

    let currentStep = 0;

    const waveIntervalId = setInterval(async () => {
      if (currentStep >= steps) {
        clearInterval(waveIntervalId);
        await this.vibrateDevice(device, 0);
        this.activePatterns.delete(patternId);
        return;
      }

      // Calculate sine wave intensity
      const progress = currentStep / steps;
      const waveIntensity = intensity * Math.sin(progress * Math.PI);

      await this.vibrateDevice(device, waveIntensity);

      currentStep++;
    }, stepDuration);

    this.activePatterns.set(patternId, {
      device,
      interval: waveIntervalId,
    });
  }

  // Burst vibration pattern (quick intense bursts)
  async burstPattern(device, pattern, patternId) {
    const { intensity, duration } = pattern;
    const burstDuration = 200; // ms per burst
    const pauseDuration = 300; // ms between bursts
    const totalBurstTime = burstDuration + pauseDuration;
    const bursts = Math.floor(duration / totalBurstTime);

    let currentBurst = 0;

    const executeBurst = async () => {
      if (currentBurst >= bursts) {
        await this.vibrateDevice(device, 0);
        this.activePatterns.delete(patternId);
        return;
      }

      // Burst on
      await this.vibrateDevice(device, intensity);

      // Wait for burst duration
      setTimeout(async () => {
        // Burst off
        await this.vibrateDevice(device, 0);

        // Wait for pause duration before next burst
        setTimeout(() => {
          currentBurst++;
          executeBurst();
        }, pauseDuration);
      }, burstDuration);
    };

    executeBurst();

    this.activePatterns.set(patternId, {
      device,
      executing: true,
    });
  }

  // Send vibration command to device
  async vibrateDevice(device, intensity) {
    try {
      // Check if device supports vibration
      if (!device.vibrateAttributes || device.vibrateAttributes.length === 0) {
        return;
      }

      // Clamp intensity between 0 and 1
      const clampedIntensity = Math.max(0, Math.min(1, intensity));

      // Send vibrate command to all vibration motors
      await device.vibrate(clampedIntensity);
    } catch (error) {
      console.error(`❌ Error vibrating device ${device.name}:`, error);
    }
  }

  // Stop all active patterns and devices
  async stopAllDevices() {
    try {
      // Clear all active patterns
      for (const [patternId, pattern] of this.activePatterns.entries()) {
        if (pattern.timeout) {
          clearTimeout(pattern.timeout);
        }
        if (pattern.interval) {
          clearInterval(pattern.interval);
        }

        if (pattern.device) {
          await this.vibrateDevice(pattern.device, 0);
        }
      }

      this.activePatterns.clear();

      // Stop all devices
      for (const device of this.devices) {
        await device.stop();
      }

      console.log("✅ All devices stopped");
    } catch (error) {
      console.error("❌ Error stopping devices:", error);
    }
  }

  // Update device list in UI
  updateDeviceList() {
    // Dispatch event for UI to update
    const event = new CustomEvent("buttplug-devices-updated", {
      detail: {
        devices: this.devices.map((d) => ({
          index: d.index,
          name: d.name,
          hasVibrate: d.vibrateAttributes && d.vibrateAttributes.length > 0,
        })),
      },
    });

    document.dispatchEvent(event);
  }

  // Enable/disable the integration
  toggle() {
    this.isEnabled = !this.isEnabled;

    if (!this.isEnabled) {
      this.stopAllDevices();
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
});
