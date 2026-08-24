/**
 * Spiral Dropdown Component for BambiSleep Chat
 * Handles spiral control dropdown with sliders and local storage
 */

export class SpiralDropdown {
  constructor(dropdownManager) {
    this.dropdownManager = dropdownManager;
    this.buttonId = "toggle-spiral";

    // Simplified slider set - complexity replaces the old separate
    // geometryA/geometryB/iterations knobs; animation mode + effects
    // replace the old subtleVariation/rotationSpeed/range sliders below
    this.sliderSettings = {
      speed: { min: 0.01, max: 5.0, default: 1.0, step: 0.01 },
      spiralA_color: { type: "color", default: "#c700c7" }, // Original p5.js purple: [199, 0, 199]
      spiralB_color: { type: "color", default: "#ff82ff" }, // Original p5.js light purple: [255, 130, 255]
      complexity: { min: 0.1, max: 3.0, default: 1.0, step: 0.01 },
      alpha: { min: 0.01, max: 1.0, default: 1.0, step: 0.001 },
      pulseIntensity: { min: 1, max: 200, default: 30, step: 1 },
    };

    this.animationModes = [
      { value: "classic", label: "🔄 Classic" },
      { value: "breathe", label: "🫁 Breathe" },
      { value: "drift", label: "🌊 Drift" },
    ];

    this.init();
  }

  // Helper function to safely access spiral controls
  getSpiralControls() {
    if (window.spiralControls && window.spiralAnimation) {
      return window.spiralControls;
    }
    console.warn("⚠️ Spiral controls not available yet");
    return null;
  }

  init() {
    const savedSettings = this.loadSettings();

    // If no saved settings or settings are incomplete, initialize with defaults
    if (Object.keys(savedSettings).length === 0) {
      this.initializeDefaults();
    }

    this.restoreModeAndEffects();
    this.setupEventListeners();
    this.setupToggleHandling();
  }

  restoreModeAndEffects() {
    setTimeout(() => {
      const spiralControls = this.getSpiralControls();
      if (!spiralControls) return;

      const mode = localStorage.getItem("spiralAnimationMode") || "classic";
      const select = document.getElementById("spiral-animation-mode");
      if (select) select.value = mode;
      spiralControls.setAnimationMode(mode);

      ["colorCycle", "strobe"].forEach((effectName) => {
        const enabled = localStorage.getItem(`spiralEffect_${effectName}`) === "true";
        const btn = document.getElementById(`spiral-effect-${effectName.toLowerCase()}`);
        if (btn) btn.setAttribute("data-state", enabled ? "on" : "off");
        if (btn) btn.classList.toggle("active", enabled);
        if (effectName === "colorCycle") spiralControls.setColorCycle(enabled);
        if (effectName === "strobe") spiralControls.setStrobe(enabled);
      });
    }, 100);
  }

  initializeDefaults() {
    // Initialize all sliders with default values
    setTimeout(() => {
      Object.keys(this.sliderSettings).forEach((key) => {
        const slider = document.getElementById(`spiral-${key}-slider`);
        const config = this.sliderSettings[key];

        if (slider && config && config.default !== undefined) {
          slider.value = config.default;
          this.updateSliderValue(key, config.default);
        }
      });
    }, 100);
  }

  // Local Storage Functions
  saveSettings() {
    const settings = {};
    Object.keys(this.sliderSettings).forEach((key) => {
      const slider = document.getElementById(`spiral-${key}-slider`);
      if (slider) {
        const config = this.sliderSettings[key];
        if (config && config.type === "color") {
          // Validate and store color as hex string
          const colorValue = slider.value;
          if (colorValue && colorValue.match(/^#[0-9A-F]{6}$/i)) {
            settings[key] = colorValue; // Valid hex color
          } else {
            settings[key] = config.default; // Fallback to default if invalid
          }
        } else {
          // Validate and store numeric values
          const numericValue = parseFloat(slider.value);
          if (!isNaN(numericValue)) {
            settings[key] = numericValue; // Valid number
          } else {
            settings[key] = config.default; // Fallback to default if invalid
          }
        }
      }
    });

    localStorage.setItem("spiralSettings", JSON.stringify(settings));
  }

  loadSettings() {
    const saved = localStorage.getItem("spiralSettings");
    if (saved) {
      try {
        const settings = JSON.parse(saved);

        // Apply settings after DOM is ready
        setTimeout(() => {
          this.applyLoadedSettings(settings);
        }, 100);

        return settings;
      } catch (e) {
        console.warn("⚠️ Failed to load spiral settings:", e);
      }
    }
    return {};
  }

  applyLoadedSettings(settings) {
    // Process all expected slider settings, applying saved values or defaults
    Object.keys(this.sliderSettings).forEach((key) => {
      const slider = document.getElementById(`spiral-${key}-slider`);
      const sliderConfig = this.sliderSettings[key];

      if (slider && sliderConfig) {
        let value = settings[key];

        // Use saved value if it exists and is valid, otherwise use default
        if (
          value === null ||
          value === undefined ||
          (sliderConfig.type === "color" &&
            (!value || value === "" || !value.match(/^#[0-9A-F]{6}$/i)))
        ) {
          value = sliderConfig.default;
        }

        slider.value = value;
        this.updateSliderValue(key, value);
      }
    });
  }

  setupEventListeners() {
    // Listen for dropdown actions specific to spiral
    document.addEventListener("dropdownAction", (e) => {
      const { action, buttonId } = e.detail;
      if (buttonId === this.buttonId) {
        this.handleAction(action, e.detail);
      }
    });

    // Auto-save on slider changes with debouncing for ultra-responsive feedback
    document.addEventListener("input", (e) => {
      if (
        e.target.classList.contains("spiral-slider") ||
        e.target.classList.contains("spiral-color-picker")
      ) {
        this.handleSliderChange(e.target);
        // Debounced saving - immediate visual update, delayed storage save
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
          this.saveSettings();
        }, 100); // Save 100ms after last change
      }
    });

    // Real-time feedback on slider movement (before releasing)
    document.addEventListener("input", (e) => {
      if (
        e.target.classList.contains("spiral-slider") ||
        e.target.classList.contains("spiral-color-picker")
      ) {
        // Immediate visual feedback
        const key = e.target.id.replace("spiral-", "").replace("-slider", "");
        const settings = this.sliderSettings[key];

        let value;
        if (settings && settings.type === "color") {
          value = e.target.value;
        } else {
          value = parseFloat(e.target.value);
        }

        this.updateSliderValue(key, value);
      }
    });
  }

  setupToggleHandling() {
    // Dropdown open/close is handled by DropdownManager
    // This method kept for potential future toggle-specific logic
  }

  handleSliderChange(slider) {
    const key = slider.id.replace("spiral-", "").replace("-slider", "");
    const settings = this.sliderSettings[key];

    let value;
    if (settings && settings.type === "color") {
      value = slider.value;
    } else {
      value = parseFloat(slider.value);
    }

    this.updateSliderValue(key, value);
    this.applySliderChange(key, value);
  }

  updateSliderValue(key, value) {
    const valueDisplay = document.getElementById(`spiral-${key}-value`);
    if (valueDisplay) {
      const settings = this.sliderSettings[key];
      if (settings && settings.type === "color") {
        // Handle null/undefined color values by using default
        const colorValue =
          value && typeof value === "string" && value.length > 0
            ? value
            : settings.default;
        valueDisplay.textContent = colorValue.toUpperCase();
        valueDisplay.style.color = colorValue;
      } else if (key === "alpha") {
        valueDisplay.textContent = `${(value * 100).toFixed(0)}%`;
      } else {
        valueDisplay.textContent = value.toFixed(1);
      }
    }
  }

  adjustSlider(key, direction) {
    const slider = document.getElementById(`spiral-${key}-slider`);
    const settings = this.sliderSettings[key];

    if (!slider || !settings) return;

    const currentValue = parseFloat(slider.value);
    const step = settings.step || 0.01;
    const adjustment = step * direction;
    let newValue = currentValue + adjustment;

    // Clamp to min/max bounds
    if (settings.min !== undefined) {
      newValue = Math.max(settings.min, newValue);
    }
    if (settings.max !== undefined) {
      newValue = Math.min(settings.max, newValue);
    }

    // Round to avoid floating point precision issues
    newValue = Math.round(newValue / step) * step;

    slider.value = newValue;
    this.updateSliderValue(key, newValue);
    this.applySliderChange(key, newValue);
  }

  applySliderChange(key, value) {
    const spiralControls = this.getSpiralControls();
    if (!spiralControls) return;

    // ULTRA-RESPONSIVE direct control updates
    switch (key) {
      case "speed":
        spiralControls.setSpeed(value);
        break;

      case "spiralA_color":
        const rgbA = this.hexToRgb(value);
        spiralControls.setSpiralAColor(rgbA.r, rgbA.g, rgbA.b);
        break;

      case "spiralB_color":
        const rgbB = this.hexToRgb(value);
        spiralControls.setSpiralBColor(rgbB.r, rgbB.g, rgbB.b);
        break;

      case "complexity":
        spiralControls.setComplexity(value);
        break;

      case "alpha":
        spiralControls.setAlpha(value);
        break;

      case "pulseIntensity":
        spiralControls.setPulseIntensity(value);
        break;
    }

    // Dispatch real-time change event for other components
    const event = new CustomEvent("spiralRealtimeChange", {
      detail: { key, value, timestamp: Date.now() },
    });
    document.dispatchEvent(event);
  }

  handleModeChange(mode) {
    const spiralControls = this.getSpiralControls();
    if (!spiralControls) return;

    spiralControls.setAnimationMode(mode);
    localStorage.setItem("spiralAnimationMode", mode);
    this.dropdownManager.showActionFeedback("SPIRAL", `${mode.toUpperCase()} MODE`);
  }

  toggleEffect(effectName, btn) {
    const spiralControls = this.getSpiralControls();
    if (!spiralControls) return;

    const enabled = btn.getAttribute("data-state") !== "on";
    btn.setAttribute("data-state", enabled ? "on" : "off");
    btn.classList.toggle("active", enabled);

    if (effectName === "colorCycle") spiralControls.setColorCycle(enabled);
    if (effectName === "strobe") spiralControls.setStrobe(enabled);

    localStorage.setItem(`spiralEffect_${effectName}`, String(enabled));
    this.dropdownManager.showActionFeedback(
      "SPIRAL",
      `${effectName === "colorCycle" ? "COLOR CYCLE" : "STROBE"} ${enabled ? "ON" : "OFF"}`
    );
  }

  handleAction(action, detail) {
    const spiralControls = this.getSpiralControls();
    if (!spiralControls) {
      console.warn("⚠️ Spiral controls not available");
      this.dropdownManager.showActionFeedback("SPIRAL", "SYSTEM NOT AVAILABLE");
      return;
    }

    console.log(`🌀 Spiral action: ${action}`);

    switch (action) {
      // Preset Controls (still using buttons)
      case "spiral-preset-original":
        this.resetToOriginal();
        this.dropdownManager.showActionFeedback("SPIRAL", "ORIGINAL RESTORED");
        break;
      case "spiral-preset-hypnotic":
        this.applyPreset("hypnotic");
        this.dropdownManager.showActionFeedback("SPIRAL", "HYPNOTIC PRESET");
        break;
      case "spiral-preset-intense":
        this.applyPreset("intense");
        this.dropdownManager.showActionFeedback("SPIRAL", "INTENSE PRESET");
        break;
      case "spiral-preset-peaceful":
        this.applyPreset("peaceful");
        this.dropdownManager.showActionFeedback("SPIRAL", "PEACEFUL PRESET");
        break;

      default:
        console.warn(`Unknown spiral action: ${action}`);
    }

    // Save settings after any preset change
    this.saveSettings();
  }

  // Preset methods using the simplified control set
  resetToOriginal() {
    this.applyPresetValues({
      speed: 1.0,
      complexity: 1.0,
      alpha: 1.0,
      pulseIntensity: 30,
      animationMode: "classic",
      effects: { colorCycle: false, strobe: false },
    });
  }

  applyPreset(presetName) {
    const presets = {
      hypnotic: {
        speed: 0.35,
        complexity: 1.6,
        alpha: 0.88,
        pulseIntensity: 42,
        animationMode: "breathe",
        effects: { colorCycle: false, strobe: false },
      },
      intense: {
        speed: 2.25,
        complexity: 2.2,
        alpha: 1.0,
        pulseIntensity: 75,
        animationMode: "drift",
        effects: { colorCycle: true, strobe: false },
      },
      peaceful: {
        speed: 0.55,
        complexity: 0.8,
        alpha: 0.72,
        pulseIntensity: 18,
        animationMode: "breathe",
        effects: { colorCycle: false, strobe: false },
      },
    };

    if (presets[presetName]) {
      this.applyPresetValues(presets[presetName]);
    }
  }

  applyPresetValues(values) {
    Object.keys(values).forEach((key) => {
      if (key === "animationMode") {
        const select = document.getElementById("spiral-animation-mode");
        if (select) select.value = values[key];
        const spiralControls = this.getSpiralControls();
        if (spiralControls) spiralControls.setAnimationMode(values[key]);
        localStorage.setItem("spiralAnimationMode", values[key]);
        return;
      }

      if (key === "effects") {
        Object.keys(values.effects).forEach((effectName) => {
          const btn = document.getElementById(`spiral-effect-${effectName.toLowerCase()}`);
          if (btn) {
            btn.setAttribute("data-state", values.effects[effectName] ? "on" : "off");
            btn.classList.toggle("active", values.effects[effectName]);
          }
          const spiralControls = this.getSpiralControls();
          if (spiralControls) {
            if (effectName === "colorCycle") spiralControls.setColorCycle(values.effects[effectName]);
            if (effectName === "strobe") spiralControls.setStrobe(values.effects[effectName]);
          }
          localStorage.setItem(`spiralEffect_${effectName}`, String(values.effects[effectName]));
        });
        return;
      }

      const slider = document.getElementById(`spiral-${key}-slider`);
      if (slider) {
        slider.value = values[key];
        this.updateSliderValue(key, values[key]);
        this.applySliderChange(key, values[key]);
      }
    });
  }

  toggleState(btn) {
    const currentState = btn.getAttribute("data-state");
    const newState = currentState === "off" ? "on" : "off";
    const statusIndicator = document.getElementById("spiral-status");

    btn.setAttribute("data-state", newState);

    // Update status indicator like brainwave
    if (statusIndicator) {
      if (newState === "on") {
        statusIndicator.style.color = "#00ff00";
        statusIndicator.textContent = "●";
      } else {
        statusIndicator.style.color = "#666";
        statusIndicator.textContent = "●";
      }
    }

    // Enable/disable spiral animation
    if (window.spiralAnimation) {
      const isEnabled = window.spiralAnimation.toggle();
      // Update button state to match actual spiral state
      const actualState = isEnabled ? "on" : "off";
      btn.setAttribute("data-state", actualState);

      // Update status indicator to match actual state
      if (statusIndicator) {
        if (actualState === "on") {
          statusIndicator.style.color = "#00ff00";
          statusIndicator.textContent = "●";
        } else {
          statusIndicator.style.color = "#666";
          statusIndicator.textContent = "●";
        }
      }

      // Load settings if turning on
      if (isEnabled) {
        setTimeout(() => {
          const savedSettings = this.loadSettings();
          if (Object.keys(savedSettings).length > 0) {
            this.applyLoadedSettings(savedSettings);
          }
        }, 100);
      }
    } else {
      console.warn("⚠️ Spiral animation not available");
    }

    // Dispatch toggle event
    const event = new CustomEvent("toggleStateChange", {
      detail: {
        buttonId: this.buttonId,
        state: newState,
        buttonName: "SPIRAL",
      },
    });
    document.dispatchEvent(event);

    this.dropdownManager.showToggleFeedback("SPIRAL", newState);
  }

  createSlider(key, label, emoji) {
    const settings = this.sliderSettings[key];

    // Handle color inputs differently
    if (settings && settings.type === "color") {
      return this.createColorPicker(key, label, emoji, settings);
    }

    // Regular slider code
    const currentValue = settings.default;

    return `
            <div class="slider-control">
                <label class="slider-label">
                    ${emoji} ${label}
                    <span class="slider-value" id="spiral-${key}-value">${this.formatSliderValue(
      key,
      currentValue
    )}</span>
                </label>
                <div class="slider-with-buttons">
                    <button class="slider-adjust-btn" onclick="window.dropdownManager.getComponent('spiral').adjustSlider('${key}', -1)">−</button>
                    <input
                        type="range"
                        id="spiral-${key}-slider"
                        class="spiral-slider"
                        min="${settings.min}"
                        max="${settings.max}"
                        step="${settings.step}"
                        value="${currentValue}"
                    />
                    <button class="slider-adjust-btn" onclick="window.dropdownManager.getComponent('spiral').adjustSlider('${key}', 1)">+</button>
                </div>
            </div>
        `;
  }

  createColorPicker(key, label, emoji, settings) {
    const currentValue = settings.default;

    return `
            <div class="slider-control color-control">
                <label class="slider-label">
                    ${emoji} ${label}
                    <span class="slider-value color-value" id="spiral-${key}-value" style="color: ${currentValue}">${currentValue.toUpperCase()}</span>
                </label>
                <div class="color-picker-container">
                    <input
                        type="color"
                        id="spiral-${key}-slider"
                        class="spiral-color-picker"
                        value="${currentValue}"
                        onchange="window.dropdownManager.getComponent('spiral').handleSliderChange(this)"
                    />
                </div>
            </div>
        `;
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 223, g: 4, b: 113 }; // Default hot pink
  }

  formatSliderValue(key, value) {
    const settings = this.sliderSettings[key];
    if (settings && settings.type === "color") {
      return value.toUpperCase();
    }

    // HIGH-PRECISION value formatting for fine-grain feedback
    switch (key) {
      case "alpha":
        return `${(value * 100).toFixed(1)}%`;
      case "speed":
        if (value < 0.1) return `${(value * 1000).toFixed(0)}ms`;
        return `${value.toFixed(2)}x`;
      case "complexity":
        return `${value.toFixed(2)}x`;
      case "pulseIntensity":
        return `${Math.floor(value)}`;
      default:
        return value.toFixed(2);
    }
  }

  // Get HTML content for the dropdown
  getDropdownContent() {
    return `
            <div class="dropdown-header">
                <h3>🌀 Spiral Controls</h3>
                <p>Customize psychedelic spiral effects</p>
            </div>
            <div class="dropdown-body">
                <div class="dropdown-section">
                    <div class="dropdown-section-header">Spiral Parameters</div>
                    <div class="sliders-container">
                        ${this.createSlider("speed", "Animation Speed", "⚡")}
                        ${this.createSlider(
                          "spiralA_color",
                          "Main Spiral Color",
                          "🎨"
                        )}
                        ${this.createSlider(
                          "spiralB_color",
                          "Inner Spiral Color",
                          "🌈"
                        )}
                        ${this.createSlider(
                          "complexity",
                          "Complexity",
                          "🌀"
                        )}
                        ${this.createSlider("alpha", "Transparency", "👻")}
                        ${this.createSlider(
                          "pulseIntensity",
                          "Trigger Pulse",
                          "💥"
                        )}
                    </div>
                </div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-section">
                    <div class="dropdown-section-header">Animation Mode</div>
                    <select id="spiral-animation-mode" onchange="window.dropdownManager.getComponent('spiral').handleModeChange(this.value)">
                        ${this.animationModes
                          .map(
                            (mode) =>
                              `<option value="${mode.value}">${mode.label}</option>`
                          )
                          .join("")}
                    </select>
                </div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-section">
                    <div class="dropdown-section-header">Effects</div>
                    <button class="preset-button dropdown-item" id="spiral-effect-colorcycle" data-state="off" onclick="window.dropdownManager.getComponent('spiral').toggleEffect('colorCycle', this)">
                        🌈 Color Cycle
                    </button>
                    <button class="preset-button dropdown-item" id="spiral-effect-strobe" data-state="off" onclick="window.dropdownManager.getComponent('spiral').toggleEffect('strobe', this)">
                        ⚡ Strobe Pulse
                    </button>
                </div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-section">
                    <div class="dropdown-section-header">Quick Presets</div>
                    <button class="preset-button dropdown-item" data-action="spiral-preset-original" onclick="window.dropdownManager.getComponent('spiral').handleAction('spiral-preset-original', {})">
                        🔄 Original
                    </button>
                    <button class="preset-button dropdown-item" data-action="spiral-preset-hypnotic" onclick="window.dropdownManager.getComponent('spiral').handleAction('spiral-preset-hypnotic', {})">
                        😴 Hypnotic
                    </button>
                    <button class="preset-button dropdown-item" data-action="spiral-preset-intense" onclick="window.dropdownManager.getComponent('spiral').handleAction('spiral-preset-intense', {})">
                        🔥 Intense
                    </button>
                    <button class="preset-button dropdown-item" data-action="spiral-preset-peaceful" onclick="window.dropdownManager.getComponent('spiral').handleAction('spiral-preset-peaceful', {})">
                        ☮️ Peaceful
                    </button>
                </div>
                <div class="dropdown-footer">
                    <small>💾 Settings auto-save to device storage</small>
                </div>
            </div>
        `;
  }
}
