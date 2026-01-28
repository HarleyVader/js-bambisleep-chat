// brainwave.js - Frontend Binaural Beat Generator
// Uses Web Audio API for precise, real-time brainwave entrainment

class BrainwaveGenerator {
  constructor() {
    this.audioContext = null;
    this.leftOsc = null;
    this.rightOsc = null;
    this.gainNode = null;
    this.isPlaying = false;
    this.currentPreset = null;
    this.volume = 0.1; // Start low for safety

    // Official brainwave frequency presets based on research
    this.presets = {
      "Deep Sleep": {
        carrier: 200,
        beat: 2,
        description: "Delta waves for deep sleep",
      },
      "Light Sleep": {
        carrier: 220,
        beat: 6,
        description: "Theta waves for drowsiness",
      },
      Meditation: {
        carrier: 250,
        beat: 10,
        description: "Alpha waves for relaxation",
      },
      Focus: {
        carrier: 300,
        beat: 18,
        description: "Beta waves for concentration",
      },
      Alert: {
        carrier: 350,
        beat: 25,
        description: "High beta for peak alertness",
      },
      "Lucid Dream": {
        carrier: 200,
        beat: 7,
        description: "Theta for lucid dreaming",
      },
      Study: {
        carrier: 280,
        beat: 12,
        description: "Alpha-beta bridge for learning",
      },
    };

    this.init();
  }

  async init() {
    try {
      // Initialize Web Audio API
      this.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    } catch (error) {
      console.error("❌ Failed to initialize Web Audio API:", error);
    }
  }

  async startBinaural(carrierFreq = 250, beatFreq = 10) {
    if (!this.audioContext) {
      console.error("❌ Audio context not available");
      return false;
    }

    // Resume audio context if suspended (browser security)
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    // Stop any existing oscillators
    this.stop();

    try {
      // Create oscillators for left and right channels
      this.leftOsc = this.audioContext.createOscillator();
      this.rightOsc = this.audioContext.createOscillator();

      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.setValueAtTime(
        this.volume,
        this.audioContext.currentTime,
      );

      // Set frequencies for binaural beat effect
      this.leftOsc.frequency.setValueAtTime(
        carrierFreq,
        this.audioContext.currentTime,
      );
      this.rightOsc.frequency.setValueAtTime(
        carrierFreq + beatFreq,
        this.audioContext.currentTime,
      );

      // Use sine waves for pure tones
      this.leftOsc.type = "sine";
      this.rightOsc.type = "sine";

      // Create stereo separation using channel merger
      const merger = this.audioContext.createChannelMerger(2);

      // Connect left oscillator to left channel (0)
      this.leftOsc.connect(this.gainNode);
      this.gainNode.connect(merger, 0, 0);

      // Connect right oscillator to right channel (1)
      this.rightOsc.connect(this.gainNode);
      this.gainNode.connect(merger, 0, 1);

      // Connect to destination (headphones/speakers)
      merger.connect(this.audioContext.destination);

      // Start oscillators
      this.leftOsc.start();
      this.rightOsc.start();

      this.isPlaying = true;
      console.log(
        `🧠 Binaural beat started: ${carrierFreq}Hz + ${beatFreq}Hz beat`,
      );

      // 🔥 Dispatch event for buttplug integration
      document.dispatchEvent(
        new CustomEvent("brainwave-started", {
          detail: { beatFreq, carrierFreq },
        }),
      );

      return true;
    } catch (error) {
      console.error("❌ Failed to start binaural beat:", error);
      return false;
    }
  }

  stop() {
    if (this.leftOsc) {
      this.leftOsc.stop();
      this.leftOsc.disconnect();
      this.leftOsc = null;
    }

    if (this.rightOsc) {
      this.rightOsc.stop();
      this.rightOsc.disconnect();
      this.rightOsc = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    this.isPlaying = false;
    this.currentPreset = null;
    console.log("🧠 Brainwave generator stopped");

    // 🔥 Dispatch event for buttplug integration
    document.dispatchEvent(new CustomEvent("brainwave-stopped"));
  }

  setVolume(level) {
    this.volume = Math.max(0, Math.min(1, level));
    this.gainNode?.gain?.setValueAtTime?.(
      this.volume,
      this.audioContext.currentTime,
    );
  }

  startPreset(presetName) {
    const preset = this.presets[presetName];
    if (!preset) {
      console.error(`❌ Unknown preset: ${presetName}`);
      return false;
    }

    this.currentPreset = presetName;
    console.log(`🧠 Starting preset: ${presetName} - ${preset.description}`);
    return this.startBinaural(preset.carrier, preset.beat);
  }

  getPresets() {
    return Object.keys(this.presets).map((name) => ({
      name,
      ...this.presets[name],
    }));
  }

  getCurrentState() {
    return {
      isPlaying: this.isPlaying,
      currentPreset: this.currentPreset,
      volume: this.volume,
      audioContextState: this.audioContext?.state,
    };
  }
}

// Create global instance
window.brainwaveGenerator = new BrainwaveGenerator();

// Export for module usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = BrainwaveGenerator;
}
