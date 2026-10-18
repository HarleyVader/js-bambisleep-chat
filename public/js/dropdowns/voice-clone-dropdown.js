/**
 * Voice Clone Dropdown Component for BambiSleep Chat
 * Lets a user record or upload a short (3-30s) reference audio sample and
 * synthesize given text in that voice via the external cloning service
 * (/v1/audio/clone) - this is a one-shot operation, not a reusable voice.
 */

export class VoiceCloneDropdown {
  constructor(dropdownManager) {
    this.dropdownManager = dropdownManager;
    this.buttonId = "toggle-voiceclone";
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.selectedSample = null; // { base64, mimeType, fileName }
    this.lastResultAudioUrl = null;
    this.init();
  }

  init() {
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
            fileName: "reference.webm",
          };
          this.updateSampleStatus("Recorded sample ready (use 3-30s of clean speech)");
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
      btn.textContent = recording ? "⏹️ Stop Recording" : "🎙️ Record Reference (3-30s)";
    }
  }

  updateSampleStatus(text) {
    const el = document.getElementById("voiceclone-sample-status");
    if (el) el.textContent = text;
  }

  submitClone() {
    const textInput = document.getElementById("voiceclone-text-input");
    const text = textInput?.value?.trim();

    if (!text) {
      this.showFeedback("ENTER TEXT TO SPEAK");
      return;
    }

    if (!this.selectedSample) {
      this.showFeedback("RECORD OR UPLOAD A REFERENCE SAMPLE FIRST");
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
      text,
    });
  }

  handleCloneSuccess(data) {
    this.updateSampleStatus("✅ Clone generated - playing...");
    this.showFeedback("VOICE CLONED");
    this.playResult(data.audioData, data.format);
  }

  handleCloneError(data) {
    this.updateSampleStatus(`❌ ${data.error}`);
    this.showFeedback("CLONE FAILED");
  }

  playResult(audioBase64, format = "wav") {
    if (!audioBase64) return;

    if (this.lastResultAudioUrl) {
      URL.revokeObjectURL(this.lastResultAudioUrl);
    }

    const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: `audio/${format}` });
    this.lastResultAudioUrl = URL.createObjectURL(blob);

    const player = document.getElementById("voiceclone-result-player");
    if (player) {
      player.src = this.lastResultAudioUrl;
      player.style.display = "block";
      player.play().catch(() => {});
    }
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
        <p>Record or upload a 3-30s reference sample, then enter text to hear it spoken in that voice</p>
      </div>
      <div class="dropdown-body">
        <div class="dropdown-section">
          <textarea id="voiceclone-text-input" rows="3" placeholder="Text to speak in the cloned voice..." maxlength="2000"></textarea>
        </div>
        <div class="dropdown-section">
          <button id="voiceclone-record-btn" class="dropdown-item" onclick="window.dropdownManager.getComponent('voiceclone').toggleRecording()">🎙️ Record Reference (3-30s)</button>
          <label class="dropdown-item voiceclone-upload-label">
            📁 Upload Reference Sample
            <input type="file" accept="audio/*" class="voiceclone-file-input" onchange="window.dropdownManager.getComponent('voiceclone').handleFileSelected(event)">
          </label>
          <p id="voiceclone-sample-status" class="empty-text">No sample selected</p>
        </div>
        <div class="dropdown-divider"></div>
        <div class="dropdown-section">
          <button class="dropdown-item" onclick="window.dropdownManager.getComponent('voiceclone').submitClone()">🧬 Clone Voice</button>
          <audio id="voiceclone-result-player" controls style="display:none; width:100%; margin-top:8px;"></audio>
        </div>
      </div>
    `;
  }
}

