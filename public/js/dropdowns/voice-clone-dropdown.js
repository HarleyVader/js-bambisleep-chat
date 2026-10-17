/**
 * Voice Clone Dropdown Component for BambiSleep Chat
 * Lets a user record or upload a short audio sample and clone it into a
 * new TTS voice via the external voice-cloning service (/v1/audio/clone)
 */

import { StorageUtils } from "../storage-utils.js";

export class VoiceCloneDropdown {
  constructor(dropdownManager) {
    this.dropdownManager = dropdownManager;
    this.buttonId = "toggle-voiceclone";
    this.clonedVoices = [];
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.selectedSample = null; // { base64, mimeType, fileName }
    this.init();
  }

  init() {
    this.loadClonedVoices();
    this.attachSocketListeners();
  }

  getSocket() {
    return window.globalSocket || null;
  }

  attachSocketListeners() {
    const socket = this.getSocket();
    if (!socket) {
      // Socket may not be connected yet - retry shortly
      setTimeout(() => this.attachSocketListeners(), 500);
      return;
    }
    if (socket.__voiceCloneListenersAttached) return;
    socket.__voiceCloneListenersAttached = true;

    socket.on("voice-clone-response", (data) => this.handleCloneSuccess(data));
    socket.on("voice-clone-error", (data) => this.handleCloneError(data));
  }

  loadClonedVoices() {
    const saved = StorageUtils.getItem("bambi-cloned-voices");
    this.clonedVoices = Array.isArray(saved) ? saved : [];

    // Re-register previously cloned voices so they pass TTS voice validation after a refresh
    this.clonedVoices.forEach((v) => {
      if (window.ttsControls?.registerClonedVoice) {
        window.ttsControls.registerClonedVoice(v.voice);
      }
    });
  }

  saveClonedVoices() {
    StorageUtils.setItem("bambi-cloned-voices", this.clonedVoices);
  }

  async handleFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await this.blobToBase64(file);
      this.selectedSample = {
        base64,
        mimeType: file.type || "audio/wav",
        fileName: file.name,
      };
      this.updateSampleStatus(`Selected file: ${file.name}`);
    } catch (error) {
      console.error("❌ Failed to read audio file:", error);
      this.showFeedback("FILE READ FAILED");
    }
  }

  async toggleRecording() {
    if (this.isRecording) {
      this.mediaRecorder?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordedChunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        this.isRecording = false;
        this.updateRecordButton(false);

        const blob = new Blob(this.recordedChunks, { type: "audio/webm" });
        try {
          const base64 = await this.blobToBase64(blob);
          this.selectedSample = {
            base64,
            mimeType: "audio/webm",
            fileName: "recording.webm",
          };
          this.updateSampleStatus("Recorded sample ready");
        } catch (error) {
          console.error("❌ Failed to encode recording:", error);
          this.showFeedback("RECORDING ENCODE FAILED");
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.updateRecordButton(true);
      this.updateSampleStatus("Recording... click again to stop");
    } catch (error) {
      console.error("❌ Microphone access failed:", error);
      this.showFeedback("MICROPHONE ACCESS DENIED");
    }
  }

  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  updateRecordButton(recording) {
    const btn = document.getElementById("voiceclone-record-btn");
    if (btn) {
      btn.textContent = recording ? "⏹️ Stop Recording" : "🎙️ Record Sample";
    }
  }

  updateSampleStatus(text) {
    const el = document.getElementById("voiceclone-sample-status");
    if (el) el.textContent = text;
  }

  submitClone() {
    const nameInput = document.getElementById("voiceclone-name-input");
    const name = nameInput?.value?.trim();

    if (!name) {
      this.showFeedback("ENTER A VOICE NAME");
      return;
    }

    if (!this.selectedSample) {
      this.showFeedback("RECORD OR UPLOAD A SAMPLE FIRST");
      return;
    }

    const socket = this.getSocket();
    if (!socket || !socket.connected) {
      this.showFeedback("NOT CONNECTED");
      return;
    }

    this.updateSampleStatus("Cloning voice...");
    socket.emit("voice-clone-request", {
      audioData: this.selectedSample.base64,
      mimeType: this.selectedSample.mimeType,
      fileName: this.selectedSample.fileName,
      voiceName: name,
    });
  }

  handleCloneSuccess(data) {
    const voiceEntry = {
      name: data.requestedName || data.voice,
      voice: data.voice,
    };

    // Replace any existing entry for the same cloned voice id
    this.clonedVoices = this.clonedVoices.filter((v) => v.voice !== voiceEntry.voice);
    this.clonedVoices.push(voiceEntry);
    this.saveClonedVoices();

    if (window.ttsControls?.registerClonedVoice) {
      window.ttsControls.registerClonedVoice(data.voice);
    }

    this.updateSampleStatus(`✅ Voice "${voiceEntry.name}" cloned!`);
    this.showFeedback("VOICE CLONED");
    this.renderClonedVoicesList();
  }

  handleCloneError(data) {
    this.updateSampleStatus(`❌ ${data.error}`);
    this.showFeedback("CLONE FAILED");
  }

  useVoice(voiceId) {
    if (window.ttsControls?.setVoice) {
      window.ttsControls.setVoice(voiceId);
      this.showFeedback(`VOICE: ${voiceId.toUpperCase()}`);
    }
  }

  deleteClonedVoice(voiceId) {
    this.clonedVoices = this.clonedVoices.filter((v) => v.voice !== voiceId);
    this.saveClonedVoices();
    this.renderClonedVoicesList();
  }

  renderClonedVoicesList() {
    const container = document.getElementById("voiceclone-list");
    if (container) container.innerHTML = this.getClonedVoicesListHtml();
  }

  getClonedVoicesListHtml() {
    if (this.clonedVoices.length === 0) {
      return '<p class="empty-text">No cloned voices yet</p>';
    }

    return this.clonedVoices
      .map(
        (v) => `
          <div class="cloned-voice-item">
            <span>${this.escapeHtml(v.name)}</span>
            <button class="dropdown-item" onclick="window.dropdownManager.getComponent('voiceclone').useVoice('${this.escapeAttr(v.voice)}')">Use</button>
            <button class="dropdown-item" onclick="window.dropdownManager.getComponent('voiceclone').deleteClonedVoice('${this.escapeAttr(v.voice)}')">🗑️</button>
          </div>`,
      )
      .join("");
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

  escapeAttr(text) {
    return String(text ?? "").replace(/'/g, "\\'");
  }

  showFeedback(message) {
    if (this.dropdownManager?.showActionFeedback) {
      this.dropdownManager.showActionFeedback("VOICE CLONE", message);
    } else {
      console.log(`VOICE CLONE: ${message}`);
    }
  }

  getDropdownContent() {
    return `
      <div class="dropdown-header">
        <h3>🧬 Voice Cloning</h3>
        <p>Record or upload a short sample to clone a new voice</p>
      </div>
      <div class="dropdown-body">
        <div class="dropdown-section">
          <input type="text" id="voiceclone-name-input" placeholder="New voice name..." maxlength="50">
        </div>
        <div class="dropdown-section">
          <button id="voiceclone-record-btn" class="dropdown-item" onclick="window.dropdownManager.getComponent('voiceclone').toggleRecording()">🎙️ Record Sample</button>
          <label class="dropdown-item voiceclone-upload-label">
            📁 Upload Sample
            <input type="file" accept="audio/*" class="voiceclone-file-input" onchange="window.dropdownManager.getComponent('voiceclone').handleFileSelected(event)">
          </label>
          <p id="voiceclone-sample-status" class="empty-text">No sample selected</p>
        </div>
        <div class="dropdown-divider"></div>
        <div class="dropdown-section">
          <button class="dropdown-item" onclick="window.dropdownManager.getComponent('voiceclone').submitClone()">🧬 Clone Voice</button>
        </div>
        <div class="dropdown-divider"></div>
        <div class="dropdown-section">
          <div class="dropdown-section-header">Cloned Voices</div>
          <div id="voiceclone-list">${this.getClonedVoicesListHtml()}</div>
        </div>
      </div>
    `;
  }
}
