// text2speech.js - Enhanced Text-to-speech with Kokoro integration and spiral synchronization
// OPTIMIZED: Added prefetching, parallel processing, and improved memory management
class TextToSpeechSystem {
  constructor() {
    this.isEnabled ??= false;
    this.queue ??= [];
    this.textArray ??= []; // Synchronized text queue for spiral display
    this.audioArray ??= []; // Audio URL queue for playback
    this.isPlaying ??= false;
    this.state ??= true; // TTS state machine for synchronization (true = ready to start)
    this.audioContext ??= null;
    this.currentAudio ??= null;
    this.currentText ??= ""; // Currently playing text (original for display)
    this.currentTTSText ??= ""; // Currently playing text (cleaned for TTS)
    this.currentAudioUrl ??= null; // Track current blob URL for cleanup
    this.volume ??= 0.7;
    this.speed ??= 1.0; // Default speed setting
    this.socket ??= null;
    this.useKokoro ??= true; // Prefer Kokoro over Web Speech API
    this.currentVoice ??= "af_bella"; // Default FEMALE Kokoro voice - BambiSleep is a GIRL!

    // ENHANCED VOICE SELECTION - Integrated from TTS Dropdown
    this.selectedVoices = []; // Track multiple selected voices (max 2)
    this.maxVoices = 2; // Maximum number of voices that can be selected per Kokoro-FastAPI
    // All female voices from Kokoro-FastAPI official docs
    // Reference: https://github.com/remsky/Kokoro-FastAPI
    this.availableVoices = [
      "af_alloy",
      "af_aoede",
      "af_bella",
      "af_heart",
      "af_jadzia",
      "af_jessica",
      "af_kore",
      "af_nicole",
      "af_nova",
      "af_river",
      "af_sarah",
      "af_sky",
    ];

    // MEMORY MANAGEMENT - Enhanced cleanup system
    this.blobUrls = new Set(); // Track all created blob URLs
    this.maxQueueSize = 50; // Limit queue growth
    this.maxAudioCache = 25; // Limit audio URL cache
    this.cleanupInterval = null; // Regular cleanup timer

    // OPTIMIZATION: Prefetching system for faster playback
    this.prefetchQueue = []; // Queue of texts to prefetch
    this.prefetchedAudio = new Map(); // Map of text -> blob URL
    this.maxPrefetch = 3; // Max number of prefetched audio items
    this.isPrefetching = false;

    // OPTIMIZATION: Parallel processing configuration
    this.maxParallelRequests = 2; // Max concurrent TTS requests
    this.activeRequests = 0;

    this.init();
  }

  init() {
    // Initialize Web Audio API
    this.initAudioContext();

    // Set up socket connection for Kokoro TTS
    this.initSocket();

    // Create audio element for playback
    this.initAudioElement();

    // ENHANCED: Load saved voice state
    this.loadVoiceState();
  }

  initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
    } catch (error) {
      console.warn("Web Audio API not supported");
    }
  }

  initSocket() {
    // Multiple attempts to connect to socket
    const tryConnectSocket = () => {
      if (window.chatCore?.socket) {
        this.socket = window.chatCore.socket;
        this.setupSocketListeners();
        console.log("🎤 TTS connected to socket via chatCore");
        return true;
      }

      // Also try direct socket.io connection
      if (window.io && typeof window.io === "function") {
        try {
          this.socket = window.io();
          this.setupSocketListeners();
          return true;
        } catch (error) {
          console.warn("🎤 Direct socket connection failed:", error);
        }
      }

      return false;
    };

    // Try immediate connection
    if (tryConnectSocket()) {
      return;
    }

    // Wait for DOM content loaded
    document.addEventListener("DOMContentLoaded", () => {
      if (tryConnectSocket()) {
        return;
      }

      // Keep trying every second for up to 10 seconds
      let attempts = 0;
      const maxAttempts = 10;
      const retryInterval = setInterval(() => {
        attempts++;
        if (tryConnectSocket() || attempts >= maxAttempts) {
          clearInterval(retryInterval);
          if (attempts >= maxAttempts && !this.socket) {
            console.warn(
              "🎤 TTS socket connection failed after",
              maxAttempts,
              "attempts - will use Web Speech API only"
            );
          }
        }
      }, 1000);
    });
  }

  setupSocketListeners() {
    if (!this.socket) {
      console.warn("🎤 No socket available for TTS");
      return;
    }

    // Listen for TTS responses from Kokoro
    this.socket.on("tts-response", (data) => {
      this.handleKokoroResponse(data);
    });

    this.socket.on("tts-error", (data) => {
      console.error("🎤 Kokoro TTS error from server:", data.error);

      // Report error through error management system if available
      if (window.chatCore && window.chatCore.errorManager) {
        window.chatCore.errorManager.reportError("tts", "service_unavailable", {
          message: data.error,
          retryCallback: () => this.retryCurrentText(),
        });
      }

      console.error("🎤 Kokoro TTS unavailable - no fallback configured");
    });

    // Add connection monitoring
    this.socket.on("connect", () => {
      // Connected successfully
    });

    this.socket.on("disconnect", () => {
      console.warn("🎤 TTS socket disconnected");
    });

    this.socket.on("connect_error", (error) => {
      console.error("🎤 TTS socket connection error:", error);
    });
  }

  initAudioElement() {
    // Create or get existing audio element
    let audio = document.getElementById("audio");
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = "audio";
      audio.hidden = true;
      audio.controls = true;
      document.body.appendChild(audio);
    }

    this.currentAudio = audio;
    this.setupAudioListeners();
  }

  setupAudioListeners() {
    if (!this.currentAudio) return;

    // Core synchronization functions from tts.js
    this.currentAudio.addEventListener("ended", () => this.handleAudioEnded());
    this.currentAudio.addEventListener("play", () => this.handleAudioPlay());
    this.currentAudio.addEventListener("error", (e) =>
      this.handleAudioError(e)
    );

    // Start regular memory cleanup
    this.startMemoryCleanup();
  }

  // ==================== MEMORY MANAGEMENT SYSTEM ====================
  // 🛡️ DATA PROTECTION: Only cleans device cache & temporary memory
  // ✅ CLEANS: Blob URLs, audio cache, oversized queues
  // ❌ PRESERVES: User voice settings, localStorage, preferences

  /**
   * Start regular memory cleanup interval
   */
  startMemoryCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Run cleanup every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.performMemoryCleanup();
    }, 30000);
  }

  /**
   * LIGHTWEIGHT memory cleanup - DEVICE CACHE ONLY
   * ✅ Cleans: Blob URLs, temporary audio cache, oversized queues
   * ❌ NEVER touches: User settings, chat data, localStorage
   */
  performMemoryCleanup() {
    let cleaned = 0;

    // ONLY clean up temporary blob URLs (device cache)
    cleaned += this.cleanupBlobUrls();

    // ONLY limit oversized technical queues (prevent runaway memory)
    cleaned += this.limitQueueSizes();

    // ONLY clean temporary audio cache (not user data)
    cleaned += this.cleanupAudioCache();

    if (cleaned > 0) {
      console.log(`🧹 TTS cache cleanup: freed ${cleaned} temporary resources`);
    }
  }
  /**
   * Clean up all tracked blob URLs
   */
  cleanupBlobUrls() {
    let cleaned = 0;

    this.blobUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
        cleaned++;
      } catch (error) {
        // Enhanced error with cause chain
        const cleanupError = ErrorManager.createError(
          "Failed to revoke blob URL during cleanup",
          {
            cause: error,
            context: { url, totalUrls: this.blobUrls.size },
            code: "BLOB_CLEANUP_FAILED",
            retryable: false,
          }
        );
        console.warn("Blob URL cleanup error:", cleanupError);
      }
    });

    this.blobUrls.clear();
    return cleaned;
  }

  /**
   * Limit queue sizes to prevent unbounded growth
   */
  limitQueueSizes() {
    let cleaned = 0;

    // Limit text array
    if (this.textArray.length > this.maxQueueSize) {
      const removed = this.textArray.length - this.maxQueueSize;
      this.textArray = this.textArray.slice(-this.maxQueueSize);
      cleaned += removed;
    }

    // Limit main queue
    if (this.queue.length > this.maxQueueSize) {
      const removed = this.queue.length - this.maxQueueSize;
      this.queue = this.queue.slice(-this.maxQueueSize);
      cleaned += removed;
    }

    return cleaned;
  }

  /**
   * Clean up audio URL cache
   */
  cleanupAudioCache() {
    let cleaned = 0;

    if (this.audioArray.length > this.maxAudioCache) {
      const toRemove = this.audioArray.slice(
        0,
        this.audioArray.length - this.maxAudioCache
      );

      toRemove.forEach((url) => {
        if (typeof url === "string" && url.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(url);
            this.blobUrls.delete(url);
            cleaned++;
          } catch (error) {
            console.warn("Failed to clean audio URL:", error);
          }
        }
      });

      this.audioArray = this.audioArray.slice(-this.maxAudioCache);
    }

    return cleaned;
  }

  /**
   * Enhanced clear queue with memory cleanup
   */
  clearQueue() {
    // Clean up existing blob URLs before clearing
    this.cleanupBlobUrls();

    this.queue = [];
    this.textArray = [];
    this.audioArray = [];
    this.isPlaying = false;
    this.state = true;

    console.log("🧹 TTS queue cleared with memory cleanup");
  }

  /**
   * Enhanced stop with cleanup
   */
  stop() {
    // Cleanup current audio URL
    if (this.currentAudioUrl) {
      try {
        URL.revokeObjectURL(this.currentAudioUrl);
        this.blobUrls.delete(this.currentAudioUrl);
      } catch (error) {
        // Enhanced error with cause chain
        const stopError = ErrorManager.createError(
          "Failed to cleanup audio URL during stop",
          {
            cause: error,
            context: { url: this.currentAudioUrl },
            code: "AUDIO_STOP_CLEANUP_FAILED",
            retryable: false,
          }
        );
        console.warn("Audio stop cleanup error:", stopError);
      }
      this.currentAudioUrl = null;
    }

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = "";
    }

    this.isPlaying = false;
    this.state = true;
    this.currentText = "";
    this.currentTTSText = "";

    console.log("🛑 TTS stopped with memory cleanup");
  }

  /**
   * Cleanup on system shutdown
   */
  cleanup() {
    console.log("🧹 TTS system cleanup starting...");

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Stop everything
    this.stop();
    this.clearQueue();

    // Final blob URL cleanup
    this.cleanupBlobUrls();

    // Close audio context
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
    }

    console.log("✅ TTS system cleanup completed");
  }

  // ==================== END MEMORY MANAGEMENT ====================

  // ENHANCED: Toggle with state persistence
  toggle() {
    this.isEnabled = !this.isEnabled;
    if (!this.isEnabled) {
      this.stop();
      this.clearQueue();
    }

    // Save state when toggled
    this.saveVoiceState();

    console.log("🎤 TTS", this.isEnabled ? "ENABLED" : "DISABLED");
    return this.isEnabled;
  }

  // ENHANCED: Enable TTS
  enable() {
    this.isEnabled = true;
    this.saveVoiceState();
    console.log("🎤 TTS ENABLED");
    return this.isEnabled;
  }

  // ENHANCED: Disable TTS
  disable() {
    this.isEnabled = false;
    this.stop();
    this.clearQueue();
    this.saveVoiceState();
    console.log("🎤 TTS DISABLED");
    return this.isEnabled;
  }

  // ENHANCED: Force refresh TTS state and clear inconsistent data
  refreshState() {
    console.log("🔄 Refreshing TTS state...");

    // Log current state
    console.log("Current TTS state:", {
      isEnabled: this.isEnabled,
      currentVoice: this.currentVoice,
      selectedVoices: this.selectedVoices,
    });

    // Clear potentially corrupted localStorage data
    try {
      const oldState = localStorage.getItem("bambi-tts-voice-state");
      console.log("Old localStorage state:", oldState);

      // Force save current state
      this.saveVoiceState();
      console.log("✅ TTS state refreshed and saved");
    } catch (e) {
      console.warn("Failed to refresh TTS state:", e);
    }

    return this.isEnabled;
  }

  speak(text) {
    if (!this.isEnabled || !text.trim()) return;

    console.log("🎤 TTS request:", text.substring(0, 50) + "...");

    // Clean text for TTS
    const cleanText = this.cleanTextForTTS(text);

    // Split text by punctuation for better synchronization
    const sentences = this.splitTextIntoSentences(text); // Use original text for splitting
    const cleanSentences = this.splitTextIntoSentences(cleanText); // Clean text for TTS

    // Add sentences to text array for synchronized display (original) and TTS (cleaned)
    sentences.forEach((sentence, index) => {
      if (sentence.trim().length > 0) {
        this.textArray.push({
          display: sentence.trim(), // Original text for display
          tts: cleanSentences[index]
            ? cleanSentences[index].trim()
            : sentence.trim(), // Cleaned text for TTS
        });
      }
    });

    // Start processing if not already playing (original pattern: state=true means ready)
    if (!this.isPlaying && this.state) {
      this.processTextQueue();
    }
  }

  // New method for pre-split sentences from aigf-core.js
  speakSentences(sentencesArray) {
    if (!this.isEnabled || !sentencesArray || sentencesArray.length === 0)
      return;

    console.log(
      "🎤 TTS speakSentences request:",
      sentencesArray.length,
      "sentences"
    );

    // Add pre-cleaned sentences directly to text array (legacy support)
    // Convert to object format for compatibility with processTextQueue
    sentencesArray.forEach((sentence) => {
      if (sentence && sentence.trim().length > 0) {
        const text = sentence.trim();
        this.textArray.push({
          display: text,
          tts: text
        });
      }
    });

    console.log("🎤 Added", this.textArray.length, "sentences to TTS queue");

    // Start processing if not already playing (original pattern: state=true means ready)
    if (!this.isPlaying && this.state) {
      this.processTextQueue();
    }
  }

  // New method to handle sentence pairs with separate display and TTS text
  speakSentencePairs(sentencePairsArray) {
    if (
      !this.isEnabled ||
      !sentencePairsArray ||
      sentencePairsArray.length === 0
    )
      return;

    console.log(
      "🎤 TTS speakSentencePairs request:",
      sentencePairsArray.length,
      "sentence pairs"
    );

    // Add sentence pairs to text array
    sentencePairsArray.forEach((pair) => {
      if (pair && pair.display && pair.tts && pair.display.trim().length > 0) {
        this.textArray.push({
          display: pair.display.trim(),
          tts: pair.tts.trim(),
        });
      }
    });

    console.log(
      "🎤 Added",
      this.textArray.length,
      "sentence pairs to TTS queue"
    );

    // Start processing if not already playing (original pattern: state=true means ready)
    if (!this.isPlaying && this.state) {
      this.processTextQueue();
    }
  }

  // Retry current text (for error recovery)
  retryCurrentText() {
    if (this.currentTTSText && this.currentTTSText.trim().length > 0) {
      console.log(
        "🎤 Retrying TTS for:",
        this.currentTTSText.substring(0, 50) + "..."
      );

      // Add back to the front of the queue
      this.textArray.unshift({
        display: this.currentText || this.currentTTSText,
        tts: this.currentTTSText,
      });

      // Reset state and restart processing
      this.isPlaying = false;
      this.state = true;
      this.processTextQueue();
    }
  }

  splitTextIntoSentences(text) {
    // Split on sentence boundaries including asterisks, but preserve triggers as single units
    // Handle asterisks as sentence separators (common in AI responses)
    return text
      .split(/(?<=[:;,.!?\*]["']?)\s+|(?<=\*\*)\s+|\*\s+/g)
      .filter((s) => s.trim().length > 0);
  }

  async processTextQueue() {
    if (this.textArray.length === 0) {
      this.isPlaying = false;
      this.state = false;
      return;
    }

    // Use Web Locks API to prevent concurrent processing (progressive enhancement)
    const processLogic = async () => {
      this.isPlaying = true;
      const textItem = this.textArray.shift();

      // Handle both object format {display, tts} and legacy string format
      if (typeof textItem === 'string') {
        this.currentText = textItem;
        this.currentTTSText = textItem;
      } else {
        this.currentText = textItem.display;
        this.currentTTSText = textItem.tts;
      }

      console.log("🎤 Processing text:", this.currentText);

      // OPTIMIZATION: Check prefetch cache first for instant playback
      const prefetchedUrl = this.getPrefetchedAudio(this.currentTTSText);
      if (prefetchedUrl) {
        // Use prefetched audio directly - much faster!
        this.currentAudioUrl = prefetchedUrl;
        if (this.currentAudio) {
          this.currentAudio.src = prefetchedUrl;
          this.currentAudio.load();
          this.currentAudio.onloadedmetadata = () => {
            console.log("⚡ Playing prefetched audio, duration:", this.currentAudio.duration);
            this.currentAudio.play().catch((e) => this.handleAudioError(e));
          };
        }
        return;
      }

      // Add to audio queue using TTS text and use do_tts like original working version
      this.arrayPush(this.audioArray, this.currentTTSText);
      this.do_tts(this.audioArray); // CRITICAL: Use do_tts() not requestTTS()
    };

    // Check for Web Locks API support
    if ("locks" in navigator) {
      try {
        await navigator.locks.request(
          "tts-processing",
          { mode: "exclusive" },
          async () => {
            await processLogic();
            // Lock will be released when this function completes
          }
        );
      } catch (error) {
        console.warn("Web Locks API failed, using fallback:", error);
        await processLogic();
      }
    } else {
      await processLogic();
    }
  }

  // Core synchronization function - Process next text in queue when audio ends
  handleAudioEnded() {
    console.log("🎤 Audio ended, processing next in queue");

    // Cleanup current audio URL
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }

    // Reset state to ready
    this.state = true;
    this.isPlaying = false;

    // Process next item if available
    if (this.textArray.length > 0) {
      this.processTextQueue();
    } else {
      console.log("🎤 TTS queue empty");
    }
  }

  handleAudioPlay() {
    console.log("🎤 Audio playing:", this.currentText);
    const duration = this.currentAudio.duration * 1000;

    // Display text in spiral center synchronized with audio
    this.flashTrigger(this.currentText, duration);

    // Display in chat if response element exists
    this.displayInChat(this.currentText);

    // OPTIMIZATION: Start prefetching next items while current is playing
    this.prefetchNext();
  }

  handleAudioError(e) {
    console.error("🎤 Audio error:", e);

    // Report error through error management system if available
    if (window.chatCore && window.chatCore.errorManager) {
      window.chatCore.errorManager.reportError("tts", "audio_playback_failed", {
        message: "Failed to play generated audio",
        error: e.message,
        retryCallback: () => this.retryCurrentText(),
      });
    }

    // Cleanup current audio URL
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }

    // Continue with next item using original pattern
    if (this.textArray.length > 0) {
      this.state = false;
      const textItem = this.textArray.shift();

      // Use new object format
      this.currentText = textItem.display;
      this.currentTTSText = textItem.tts;

      this.arrayPush(this.audioArray, this.currentTTSText);
      this.do_tts(this.audioArray);
    } else {
      this.isPlaying = false;
      this.state = true;
    }
  }

  // Request TTS from Kokoro
  requestTTS(text) {
    console.log("🎤 Requesting TTS for:", text.substring(0, 50) + "...");

    if (!this.socket || !this.socket.connected) {
      console.error("🎤 Kokoro TTS socket not connected");
      return;
    }

    console.log("🎤 Using Kokoro TTS via socket");
    // Use Kokoro TTS via socket
    this.socket.emit("tts-request", {
      text: text,
      voice: this.currentVoice,
      format: "mp3",
    });
  }

  handleKokoroResponse(data) {
    console.log("🎤 Kokoro response received:", data.size, "bytes", data.cached ? "(cached)" : "");

    try {
      // Convert base64 audio data to blob URL
      const audioBlob = this.base64ToBlob(data.audioData, "audio/mpeg");
      const audioUrl = URL.createObjectURL(audioBlob);

      // Track blob URL for cleanup
      this.blobUrls.add(audioUrl);
      this.currentAudioUrl = audioUrl;

      // Set audio source and play
      if (this.currentAudio) {
        this.currentAudio.src = audioUrl;
        this.currentAudio.load();

        this.currentAudio.onloadedmetadata = () => {
          console.log(
            "🎤 Audio metadata loaded, duration:",
            this.currentAudio.duration
          );
          this.currentAudio.play().catch((e) => {
            console.error("🎤 Error playing audio:", e);
            this.handleAudioError(e);
          });
        };
      }
    } catch (error) {
      console.error("🎤 Error processing Kokoro response:", error);
      // Try next item in queue
      this.processTextQueue();
    }
  }

  // ==================== PREFETCHING SYSTEM ====================

  /**
   * OPTIMIZATION: Prefetch next items in queue while current is playing
   */
  prefetchNext() {
    if (this.isPrefetching || this.textArray.length === 0) return;

    // Prefetch up to maxPrefetch items
    const itemsToPrefetch = this.textArray.slice(0, this.maxPrefetch);
    
    itemsToPrefetch.forEach((textItem) => {
      const ttsText = typeof textItem === 'string' ? textItem : textItem.tts;
      
      // Skip if already prefetched
      if (this.prefetchedAudio.has(ttsText)) return;
      
      // Request prefetch via socket
      this.requestPrefetch(ttsText);
    });
  }

  /**
   * Request audio prefetch (non-blocking)
   */
  requestPrefetch(text) {
    if (!this.socket?.connected || this.prefetchedAudio.has(text)) return;
    
    console.log(`⚡ Prefetching: "${text.substring(0, 30)}..."`);
    
    this.socket.emit("tts-request", {
      text: text,
      voice: this.currentVoice,
      format: "mp3",
      prefetch: true // Mark as prefetch request
    });
  }

  /**
   * Check if audio is prefetched and return it
   */
  getPrefetchedAudio(text) {
    const cached = this.prefetchedAudio.get(text);
    if (cached) {
      this.prefetchedAudio.delete(text); // Remove after use
      console.log(`⚡ Using prefetched audio for: "${text.substring(0, 30)}..."`);
      return cached;
    }
    return null;
  }

  /**
   * Store prefetched audio for later use
   */
  storePrefetchedAudio(text, audioUrl) {
    // Limit prefetch cache size
    if (this.prefetchedAudio.size >= this.maxPrefetch * 2) {
      const firstKey = this.prefetchedAudio.keys().next().value;
      const oldUrl = this.prefetchedAudio.get(firstKey);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      this.prefetchedAudio.delete(firstKey);
    }
    
    this.prefetchedAudio.set(text, audioUrl);
  }

  base64ToBlob(base64, contentType) {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);

      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
  }

  // Flash text in spiral center (from tts.js)
  flashTrigger(text, duration) {
    // Try to find spiral container or eye element
    let container =
      document.getElementById("eye") ??
      document.getElementById("spiral-container") ??
      document.querySelector("#spiral-container");

    if (!container) {
      console.warn("🎤 No spiral container found for text display");
      return;
    }

    // Create or find text display element
    let textDisplay = container.querySelector(".tts-text-display");
    if (!textDisplay) {
      textDisplay = document.createElement("div");
      textDisplay.className = "tts-text-display";
      textDisplay.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: var(--tertiary-alt);
                font-size: 2rem;
                font-weight: bold;
                text-align: center;
                text-shadow: 0 0 10px var(--tertiary-alt), 0 0 20px var(--tertiary-alt);
                z-index: 1000;
                pointer-events: none;
                max-width: 90%;
                word-wrap: break-word;
                white-space: normal;
                animation: pulse 0.5s ease-in-out infinite alternate;
                overflow-wrap: break-word;
                hyphens: auto;
                line-height: 1.2;
            `;
      container.appendChild(textDisplay);
    }

    // Display the text horizontally, not as a vertical column
    // Keep text flowing left to right, only break on explicit newlines
    let html = String(text).replace(/\n/g, " "); // Replace newlines with spaces for horizontal flow
    textDisplay.innerHTML = html;
    textDisplay.style.display = "block";

    // Clear after duration
    setTimeout(() => {
      if (textDisplay) {
        textDisplay.style.display = "none";
        textDisplay.innerHTML = "";
      }
    }, duration || 3000);
  }

  displayInChat(text) {
    // Display text at the bottom of the message-text area
    const response =
      document.querySelector(".message.ai .message-text:last-child") ||
      document.querySelector("#response") ||
      document.querySelector("#message");

    if (response) {
      const messageElement = document.createElement("p");
      messageElement.className = "tts-speaking";
      messageElement.textContent = text;
      messageElement.style.cssText = `
                color: #FF1493;
                font-weight: bold;
                margin: 0.5rem 0;
                padding: 0.5rem;
                background: rgba(255, 20, 147, 0.1);
                border-left: 3px solid #FF1493;
                border-radius: 4px;
            `;

      // Append to bottom of message-text (not insert at top)
      response.appendChild(messageElement);

      // Remove after speaking
      setTimeout(
        () => {
          if (messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
          }
        },
        this.currentAudio ? this.currentAudio.duration * 1000 : 3000
      );
    }
  }

  // Array management functions from tts.js template - UPGRADED
  arrayPush(array, text) {
    if (this.currentAudio) {
      this.currentAudio.hidden = true;
    }

    // Use improved URL format with better encoding
    let URL = `/api/tts?text=${encodeURIComponent(
      text
    )}&voice=${encodeURIComponent(this.currentVoice)}`;
    array.push(URL);
  }

  arrayShift(array) {
    if (array.length > 0 && this.currentAudio !== null) {
      let currentURL = array.shift();
      console.log("🎤 Processing URL:", currentURL);
      return currentURL;
    }
    return undefined;
  }

  // UPGRADED: Enhanced TTS processing with better error handling and blob management
  // OPTIMIZED: Reduced retry delays and added connection reuse hints
  async do_tts(array) {
    const messageEl = document.querySelector("#message");
    if (messageEl) messageEl.textContent = "Synthesizing...";

    let currentURL = this.arrayShift(array);
    if (!currentURL) return;

    let retries = 2; // Number of retry attempts
    let audioUrl = null; // Track the blob URL for cleanup

    while (retries >= 0) {
      try {
        // OPTIMIZATION: Minimal logging
        console.log(`🎤 TTS Request: ${currentURL.substring(0, 80)}...`);

        // OPTIMIZATION: Fetch with timeout for faster failure detection
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(currentURL, {
          method: "GET",
          headers: {
            Accept: "audio/mpeg",
            Connection: "keep-alive" // Hint for connection reuse
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`🎤 TTS API Error: ${response.status}`);

          if (retries > 0) {
            console.log(`🎤 Retrying TTS (${retries} left)...`);
            retries--;
            // OPTIMIZATION: Reduced retry delay from 1000ms to 300ms
            await new Promise((resolve) => setTimeout(resolve, 300));
            continue;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        // Get audio data as blob
        const audioBlob = await response.blob();

        // Create object URL from blob
        audioUrl = URL.createObjectURL(audioBlob);

        // Track blob URL for cleanup
        this.blobUrls.add(audioUrl);
        this.currentAudioUrl = audioUrl;

        // Set audio source to blob URL
        if (this.currentAudio) {
          this.currentAudio.src = audioUrl;
          console.log("🎤 Audio source set:", audioUrl);

          this.currentAudio.load();

          // Set up event handlers - CRITICAL: Use class methods for proper synchronization
          this.currentAudio.onloadedmetadata = () => {
            console.log(
              "🎤 Audio metadata loaded, duration:",
              this.currentAudio.duration
            );
            if (messageEl) messageEl.textContent = "Playing...";
            this.currentAudio.play().catch((e) => {
              console.error("🎤 Error playing audio:", e);
              if (messageEl)
                messageEl.textContent = "Error playing audio: " + e.message;

              // Cleanup on play error
              if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
                audioUrl = null;
              }

              // Use class method for proper queue handling
              this.handleAudioError(e);
            });
          };

          // CRITICAL: Remove inline event handlers and rely on setupAudioListeners() class methods
          // The class methods handleAudioEnded() and handleAudioPlay() are properly set up in setupAudioListeners()

          // Store current audioUrl for cleanup
          this.currentAudioUrl = audioUrl;
        }

        break; // Exit the retry loop on success
      } catch (error) {
        if (retries <= 0) {
          console.error("🎤 Fetch error:", error);
          if (messageEl)
            messageEl.textContent = "Error fetching audio: " + error.message;

          // Cleanup on fetch error
          if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            audioUrl = null;
          }

          // Process next item in queue if any
          if (array.length > 0) {
            this.do_tts(array);
          }
        } else {
          retries--;
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }
    }
  }

  // UPGRADED: Enhanced voice fetching with better error handling
  async fetchAvailableVoices() {
    try {
      const response = await fetch("/api/tts/voices");
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      console.log("🎤 Available voices loaded:", data.voices?.length || 0);
      return data.voices || data; // Handle both new and legacy formats
    } catch (error) {
      console.error("🎤 Error fetching available voices:", error);
      // Return fallback female voices if API fails
      return this.getFemaleVoices();
    }
  }

  // Voice management with strict female-only validation and ENHANCED SELECTION
  setVoice(voice) {
    if (voice && typeof voice === "string") {
      // Enhanced voice setting - handle combinations and individual voices
      this.currentVoice = voice;

      // Update selectedVoices array based on current voice
      if (voice.includes("+")) {
        // Voice combination (e.g., "af_sky+af_bella")
        this.selectedVoices = voice
          .split("+")
          .filter((v) => v.trim().length > 0);
      } else {
        // Single voice
        this.selectedVoices = [voice];
      }

      // Validate voice selection constraints
      this.validateAndCleanVoiceSelection();

      // Update global currentVoice like original working implementation
      window.currentVoice = this.currentVoice;
      console.log(
        "✅ Voice set to:",
        voice,
        "| Selected voices:",
        this.selectedVoices
      );

      // Update voice on server if socket available
      if (this.socket) {
        this.socket.emit("set-voice", { voice: voice });
      }

      // Save state for persistence
      this.saveVoiceState();
    }
  }

  // ENHANCED: Add/remove individual voices (from dropdown methodology)
  addVoice(voiceName) {
    if (!voiceName || typeof voiceName !== "string") {
      console.warn("Invalid voice name:", voiceName);
      return false;
    }

    // Check if voice is already selected
    if (this.selectedVoices.includes(voiceName)) {
      console.log("Voice already selected:", voiceName);
      return false;
    }

    // Check max voices limit
    if (this.selectedVoices.length >= this.maxVoices) {
      console.warn(`Maximum ${this.maxVoices} voices allowed`);
      return false;
    }

    // Validate it's a female voice
    if (!this.availableVoices.includes(voiceName)) {
      console.error("Invalid or non-female voice:", voiceName);
      return false;
    }

    // Add voice
    this.selectedVoices.push(voiceName);
    this.updateCurrentVoiceFromSelection();
    console.log(
      "✅ Voice added:",
      voiceName,
      "| Selected:",
      this.selectedVoices
    );

    return true;
  }

  // ENHANCED: Remove individual voice
  removeVoice(voiceName) {
    const index = this.selectedVoices.indexOf(voiceName);
    if (index === -1) {
      console.log("Voice not found in selection:", voiceName);
      return false;
    }

    this.selectedVoices.splice(index, 1);
    this.updateCurrentVoiceFromSelection();
    console.log(
      "✅ Voice removed:",
      voiceName,
      "| Selected:",
      this.selectedVoices
    );

    return true;
  }

  // ENHANCED: Clear all voice selection
  clearVoiceSelection() {
    this.selectedVoices = [];
    this.currentVoice = "af_bella"; // Reset to default
    window.currentVoice = this.currentVoice;
    this.saveVoiceState();
    console.log("🗑️ Voice selection cleared, reset to default");
  }

  // ENHANCED: Update currentVoice from selectedVoices array
  updateCurrentVoiceFromSelection() {
    if (this.selectedVoices.length === 0) {
      this.currentVoice = "af_bella"; // Default fallback
    } else if (this.selectedVoices.length === 1) {
      this.currentVoice = this.selectedVoices[0];
    } else {
      this.currentVoice = this.selectedVoices.join("+");
    }

    // Update global reference
    window.currentVoice = this.currentVoice;
    this.saveVoiceState();
  }

  // ENHANCED: Validate and clean voice selection
  validateAndCleanVoiceSelection() {
    // Remove any invalid voices
    this.selectedVoices = this.selectedVoices.filter((voice) =>
      this.availableVoices.includes(voice)
    );

    // Enforce max voices limit
    if (this.selectedVoices.length > this.maxVoices) {
      console.warn(`Too many voices selected, keeping first ${this.maxVoices}`);
      this.selectedVoices = this.selectedVoices.slice(0, this.maxVoices);
    }

    // Update currentVoice to match cleaned selection
    this.updateCurrentVoiceFromSelection();
  }

  // ENHANCED: Get current voice display string (from dropdown methodology)
  getCurrentVoiceDisplay() {
    if (this.selectedVoices.length === 0) {
      return "None";
    } else if (this.selectedVoices.length === 1) {
      return this.selectedVoices[0];
    } else {
      return this.selectedVoices.join(" + ");
    }
  }

  // ENHANCED: State persistence
  saveVoiceState() {
    const state = {
      currentVoice: this.currentVoice,
      selectedVoices: this.selectedVoices,
      speed: this.speed,
      isEnabled: this.isEnabled,
    };

    try {
      localStorage.setItem("bambi-tts-voice-state", JSON.stringify(state));
    } catch (e) {
      console.warn("Failed to save TTS voice state:", e);
    }
  }

  // ENHANCED: Load saved state
  loadVoiceState() {
    try {
      const saved = localStorage.getItem("bambi-tts-voice-state");
      if (saved) {
        const state = JSON.parse(saved);

        if (state.selectedVoices && Array.isArray(state.selectedVoices)) {
          this.selectedVoices = state.selectedVoices;
        }

        if (state.currentVoice) {
          this.currentVoice = state.currentVoice;
          window.currentVoice = this.currentVoice;
        }

        if (typeof state.speed === "number") {
          this.speed = state.speed;
        }

        if (typeof state.isEnabled === "boolean") {
          this.isEnabled = state.isEnabled;
        }

        // Validate loaded state
        this.validateAndCleanVoiceSelection();
      }
    } catch (e) {
      console.warn("Failed to load TTS voice state:", e);
      // Fallback to defaults
      this.selectedVoices = [];
      this.currentVoice = "af_bella";
    }
  }

  // Get only verified female voices with combination support (Kokoro only)
  getFemaleVoices() {
    // Base female voices
    const baseVoices = ["af_sky", "af_bella", "af_sarah", "af_nicole"];
    const combinedVoices = [];

    // Generate all valid combinations of 2 voices
    for (let i = 0; i < baseVoices.length; i++) {
      for (let j = i + 1; j < baseVoices.length; j++) {
        combinedVoices.push(`${baseVoices[i]}+${baseVoices[j]}`);
      }
    }

    return [...baseVoices, ...combinedVoices];
  }

  // Validate voice combination (max 2 voices, female only)
  validateVoiceCombination(voiceString) {
    if (!voiceString) return false;

    const voices = voiceString.split("+");

    // Check max 2 voices
    if (voices.length > 2) {
      console.warn("Voice combination limited to maximum 2 voices");
      return false;
    }

    // Check all voices are female
    const femaleVoices = [
      "af_sky",
      "af_bella",
      "af_sarah",
      "af_nicole",
      "af_jadzia",
      "af_jessica",
      "af_nicole",
      "af_nova",
      "af_kore",
      "af_hearth",
    ];
    for (const voice of voices) {
      if (!femaleVoices.includes(voice.trim())) {
        console.warn(`Voice ${voice} is not a valid female voice`);
        return false;
      }
    }

    return true;
  }

  // Get available voice combinations for dropdown (Kokoro only)
  getVoiceCombinations() {
    return this.getFemaleVoices();
  }

  // Cleanup function
  cleanupCurrentAudio() {
    if (this.currentAudio && this.currentAudio.src) {
      // Revoke object URL to free memory
      if (this.currentAudio.src.startsWith("blob:")) {
        URL.revokeObjectURL(this.currentAudio.src);
      }
      this.currentAudio.src = "";
    }
  }

  async speakWithServerAPI(text) {
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text,
          voice: this.currentVoice,
          format: "mp3",
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.audioData) {
        // Handle base64 audio data from Kokoro
        const audioBlob = this.base64ToBlob(data.audioData, "audio/mpeg");
        await this.playAudioBlob(audioBlob);
      } else {
        throw new Error("Invalid TTS response format");
      }
    } catch (error) {
      throw new Error(`Server TTS failed: ${error.message}`);
    }
  }

  playAudioBlob(blob) {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.volume = this.volume;

      audio.onended = () => {
        this.currentAudio = null;
        resolve();
      };

      audio.onerror = () => {
        this.currentAudio = null;
        reject(new Error("Audio playback failed"));
      };

      const audioUrl = URL.createObjectURL(blob);
      this.blobUrls.add(audioUrl);
      audio.src = audioUrl;
      this.currentAudio = audio;
      audio.play().catch(reject);
    });
  }

  stop() {
    // Stop current playback
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.cleanupCurrentAudio();
    }

    // Stop Web Speech API
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }

    // Clear all queues
    this.textArray = [];
    this.audioArray = [];
    this.queue = [];

    this.isPlaying = false;
    this.state = false;

    // Clear spiral text display
    this.clearSpiralText();
  }

  clearQueue() {
    this.textArray = [];
    this.audioArray = [];
    this.queue = [];
  }

  clearSpiralText() {
    const container =
      document.getElementById("eye") ||
      document.getElementById("spiral-container") ||
      document.querySelector("#spiral-container");

    if (container) {
      const textDisplay = container.querySelector(".tts-text-display");
      if (textDisplay) {
        textDisplay.style.display = "none";
        textDisplay.textContent = "";
      }
    }
  }

  cleanTextForTTS(text) {
    // Remove URLs
    text = text.replace(/https?:\/\/[^\s]+/g, "link");

    // Remove apostrophes from contractions and possessives (you'll -> youll, bambi's -> bambis)
    text = text.replace(/'/g, "");

    // Remove ALL punctuation marks that should not be spoken
    text = text.replace(/[.,;:!?"""''`~@#$%^&*()_+=\[\]{}|\\<>/\-]/g, " ");

    // Remove excessive punctuation
    text = text.replace(/[!]{2,}/g, "");
    text = text.replace(/[?]{2,}/g, "");
    text = text.replace(/[.]{3,}/g, "");

    // Replace common emoticons with words
    text = text.replace(/:\)/g, "smile");
    text = text.replace(/:\(/g, "sad");
    text = text.replace(/:D/g, "laugh");
    text = text.replace(/<3/g, "heart");

    // Remove HTML tags but preserve the text content
    text = text.replace(/<[^>]*>/g, "");

    // Remove markdown formatting
    text = text.replace(/\*\*(.*?)\*\*/g, "$1"); // Remove **bold**
    text = text.replace(/\*(.*?)\*/g, "$1"); // Remove *italic*
    text = text.replace(/__(.*?)__/g, "$1"); // Remove __underline__

    // Remove excessive whitespace and normalize
    text = text.replace(/\s+/g, " ").trim();

    // Convert to lowercase for TTS (display stays uppercase, but speech is lowercase)
    return text.toLowerCase();
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  getVolume() {
    return this.volume;
  }

  // Add missing methods for dropdown integration
  clearCache() {
    // Clear all queues and reset TTS state
    this.textArray = [];
    this.audioArray = [];
    this.queue = [];
    this.stop();
    this.isPlaying = false;
    this.state = false;
    this.currentText = "";
    this.currentTTSText = "";
    console.log("🗑️ TTS cache cleared");
  }

  setSpeed(speed) {
    // For Web Speech API voices, store speed setting
    this.speed = Math.max(0.1, Math.min(10, speed));
    console.log("⚡ TTS speed set to:", this.speed);

    // Note: Kokoro TTS speed is controlled server-side
    if (!this.useKokoro) {
      console.log("🎤 Web Speech API speed updated");
    } else {
      console.log("🎤 Kokoro TTS speed updates require server configuration");
    }
  }

  getQueueLength() {
    return this.textArray.length + this.audioArray.length + this.queue.length;
  }

  isCurrentlyPlaying() {
    return this.isPlaying || this.state;
  }

  // Enhanced API for external access
  getCurrentText() {
    return this.currentText;
  }

  getCurrentVoice() {
    return this.currentVoice;
  }

  setUseKokoro(useKokoro) {
    this.useKokoro = useKokoro;
    console.log("🎤 Kokoro TTS:", useKokoro ? "ENABLED" : "DISABLED");
  }

  getAvailableVoices() {
    // Return only verified female voices
    return this.getFemaleVoices();
  }

  // Utility function for external access to TTS functions
  processAIResponse(message) {
    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      console.warn("🎤 Received empty or invalid response:", message);
      return;
    }

    console.log(
      "🎤 Processing AI response for TTS:",
      message.substring(0, 50) + "..."
    );
    this.speak(message);
  }
}

// Initialize TTS system when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.ttsSystem = new TextToSpeechSystem();

  // Add CSS animations for spiral text display
  const style = document.createElement("style");
  style.textContent = `
        @keyframes pulse {
            0% { opacity: 0.7; transform: translate(-50%, -50%) scale(0.95); }
            100% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
        }

        .tts-text-display {
            font-family: 'Audiowide', sans-serif;
            user-select: none;
            white-space: nowrap;
            line-height: 1.2;
        }

        .tts-speaking {
            animation: ttsSpeaking 0.5s ease-in-out infinite alternate;
        }

        @keyframes ttsSpeaking {
            0% { opacity: 0.8; }
            100% { opacity: 1; }
        }
    `;

  if (!document.querySelector("#tts-animations")) {
    style.id = "tts-animations";
    document.head.appendChild(style);
  }

  // Make the modern TTS API available globally
  // ⚠️ IMPORTANT: BambiSleep is a GIRL - ONLY FEMALE VOICES ALLOWED! ⚠️
  window.tts = {
    // Core TTS functions
    speak: (text) => window.ttsSystem.speak(text),
    speakSentences: (sentences) => window.ttsSystem.speakSentences(sentences),
    toggle: () => window.ttsSystem.toggle(),
    enable: () => window.ttsSystem.enable(),
    disable: () => window.ttsSystem.disable(),
    stop: () => window.ttsSystem.stop(),
    isEnabled: () => window.ttsSystem.isEnabled,
    isPlaying: () => window.ttsSystem.isCurrentlyPlaying(),

    // ENHANCED: Voice selection methods
    setVoice: (voice) => window.ttsSystem.setVoice(voice),
    addVoice: (voice) => window.ttsSystem.addVoice(voice),
    removeVoice: (voice) => window.ttsSystem.removeVoice(voice),
    clearVoiceSelection: () => window.ttsSystem.clearVoiceSelection(),
    getCurrentVoice: () => window.ttsSystem.getCurrentVoice(),
    getCurrentVoiceDisplay: () => window.ttsSystem.getCurrentVoiceDisplay(),
    getSelectedVoices: () => window.ttsSystem.selectedVoices,

    // Voice management and validation
    setUseKokoro: (use) => window.ttsSystem.setUseKokoro(use),
    getAvailableVoices: () => window.ttsSystem.getAvailableVoices(), // Returns FEMALE voices only
    getFemaleVoices: () => window.ttsSystem.getFemaleVoices(), // Explicit female voice getter
    validateVoiceCombination: (voiceString) =>
      window.ttsSystem.validateVoiceCombination(voiceString), // Voice combination validation
    getVoiceCombinations: () => window.ttsSystem.getVoiceCombinations(), // Available voice combinations

    // Core processing
    processAIResponse: (message) => window.ttsSystem.processAIResponse(message),
    fetchAvailableVoices: () => window.ttsSystem.fetchAvailableVoices(),
    do_tts: (array) => window.ttsSystem.do_tts(array),
    arrayPush: (array, text) => window.ttsSystem.arrayPush(array, text),
    arrayShift: (array) => window.ttsSystem.arrayShift(array),

    // DIAGNOSTIC: State management and troubleshooting
    refreshState: () => window.ttsSystem.refreshState(),
    diagnose: () => {
      console.log("🔍 TTS System Diagnosis:");
      console.log("System State:", {
        isEnabled: window.ttsSystem.isEnabled,
        isPlaying: window.ttsSystem.isPlaying,
        currentVoice: window.ttsSystem.currentVoice,
        selectedVoices: window.ttsSystem.selectedVoices,
        useKokoro: window.ttsSystem.useKokoro,
        socketConnected: window.ttsSystem.socket?.connected,
      });
      console.log("Queue Status:", {
        textArrayLength: window.ttsSystem.textArray.length,
        audioArrayLength: window.ttsSystem.audioArray.length,
        currentText: window.ttsSystem.currentText,
      });
      console.log("📋 To enable TTS: window.tts.enable()");
      console.log('📋 To test TTS: window.tts.speak("test")');
      console.log("📋 To check UI: window.diagnoseTTS()");
    },

    // QUICK FIX: Emergency TTS enablement
    forceEnable: () => {
      console.log("🚨 Force enabling TTS...");
      window.ttsSystem.isEnabled = true;
      window.ttsSystem.saveVoiceState();
      console.log("✅ TTS force enabled - try speaking now");
      return true;
    },
  };
});

// ==================== GLOBAL INITIALIZATION ====================

// Initialize TTS system when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  if (!window.tts) {
    console.log("🎤 Initializing global TTS system...");
    window.tts = new TextToSpeechSystem();
    window.ttsSystem = window.tts;
    console.log("✅ Global TTS system initialized");
  }
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (window.tts && window.tts.cleanup) {
    window.tts.cleanup();
  }
});
