// text2speech.js - Enhanced Text-to-speech with Kokoro integration and spiral synchronization
class TextToSpeechSystem {
    constructor() {
        this.isEnabled = false;
        this.queue = [];
        this.textArray = []; // Synchronized text queue for spiral display
        this.audioArray = []; // Audio URL queue for playback
        this.isPlaying = false;
        this.state = false; // TTS state machine for synchronization
        this.audioContext = null;
        this.currentAudio = null;
        this.currentText = ''; // Currently playing text
        this.volume = 0.7;
        this.socket = null;
        this.useKokoro = true; // Prefer Kokoro over Web Speech API
        this.currentVoice = 'af_sky+af_bella'; // Default FEMALE Kokoro voice - BambiSleep is a GIRL!

        this.init();
    }

    init() {
        // Initialize Web Audio API
        this.initAudioContext();

        // Set up socket connection for Kokoro TTS
        this.initSocket();

        // Create audio element for playback
        this.initAudioElement();
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported');
        }
    }

    initSocket() {
        // Get socket from global chatCore if available
        if (window.chatCore && window.chatCore.socket) {
            this.socket = window.chatCore.socket;
            this.setupSocketListeners();
        } else {
            // Wait for chatCore to be available
            document.addEventListener('DOMContentLoaded', () => {
                if (window.chatCore && window.chatCore.socket) {
                    this.socket = window.chatCore.socket;
                    this.setupSocketListeners();
                }
            });
        }
    }

    setupSocketListeners() {
        if (!this.socket) return;

        // Listen for TTS responses from Kokoro
        this.socket.on('tts-response', (data) => {
            this.handleKokoroResponse(data);
        });

        this.socket.on('tts-error', (data) => {
            console.error('Kokoro TTS error:', data.error);
            // Fallback to Web Speech API
            this.fallbackToWebSpeech();
        });
    }

    initAudioElement() {
        // Create or get existing audio element
        let audio = document.getElementById('audio');
        if (!audio) {
            audio = document.createElement('audio');
            audio.id = 'audio';
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
        this.currentAudio.addEventListener('ended', () => this.handleAudioEnded());
        this.currentAudio.addEventListener('play', () => this.handleAudioPlay());
        this.currentAudio.addEventListener('error', (e) => this.handleAudioError(e));
    }

    toggle() {
        this.isEnabled = !this.isEnabled;
        if (!this.isEnabled) {
            this.stop();
            this.clearQueue();
        }
        return this.isEnabled;
    }

    speak(text) {
        if (!this.isEnabled || !text.trim()) return;

        console.log('🎤 TTS request:', text.substring(0, 50) + '...');

        // Clean text for TTS
        const cleanText = this.cleanTextForTTS(text);

        // Split text by punctuation for better synchronization
        const sentences = this.splitTextIntoSentences(cleanText);

        // Add sentences to text array for synchronized display
        sentences.forEach(sentence => {
            if (sentence.trim().length > 0) {
                this.textArray.push(sentence.trim());
            }
        });

        // Start processing if not already playing
        if (!this.isPlaying && !this.state) {
            this.processTextQueue();
        }
    }

    // New method for pre-split sentences from aigf-core.js
    speakSentences(sentencesArray) {
        if (!this.isEnabled || !sentencesArray || sentencesArray.length === 0) return;

        console.log('🎤 TTS speakSentences request:', sentencesArray.length, 'sentences');

        // Add pre-cleaned sentences directly to text array
        sentencesArray.forEach(sentence => {
            if (sentence && sentence.trim().length > 0) {
                this.textArray.push(sentence.trim());
            }
        });

        console.log('🎤 Added', this.textArray.length, 'sentences to TTS queue');

        // Start processing if not already playing
        if (!this.isPlaying && !this.state) {
            this.processTextQueue();
        }
    }

    splitTextIntoSentences(text) {
        // Split on sentence boundaries but preserve triggers as single units
        // Don't split triggers that might be highlighted
        return text.split(/(?<=[:;,.!?]["']?)\s+/g).filter(s => s.trim().length > 0);
    }

    processTextQueue() {
        if (this.textArray.length === 0) {
            this.isPlaying = false;
            this.state = false;
            return;
        }

        this.isPlaying = true;
        this.currentText = this.textArray.shift();

        console.log('🎤 Processing text:', this.currentText);

        // Add to audio queue and request TTS
        this.arrayPush(this.audioArray, this.currentText);
        this.requestTTS(this.currentText);
    }

    // Core synchronization function from tts.js - MUST BE EXACTLY AS IT IS
    handleAudioEnded() {
        console.log('🎤 Audio ended, processing next in queue');

        if (this.textArray.length > 0) {
            this.state = false;
            this.currentText = this.textArray.shift();
            this.arrayPush(this.audioArray, this.currentText);
            this.requestTTS(this.currentText);
        } else if (this.textArray.length === 0) {
            this.state = true;
            this.isPlaying = false;
            return;
        }
    }

    handleAudioPlay() {
        console.log('🎤 Audio playing:', this.currentText);
        const duration = this.currentAudio.duration * 1000;

        // Display text in spiral center synchronized with audio
        this.flashTrigger(this.currentText, duration);

        // Display in chat if response element exists
        this.displayInChat(this.currentText);
    }

    handleAudioError(e) {
        console.error('🎤 Audio error:', e);

        // Clean up and continue with next item
        this.cleanupCurrentAudio();

        if (this.textArray.length > 0 || this.audioArray.length > 0) {
            setTimeout(() => this.processTextQueue(), 500);
        } else {
            this.isPlaying = false;
            this.state = false;
        }
    }

    // Request TTS from Kokoro or fallback to Web Speech API
    requestTTS(text) {
        if (this.useKokoro && this.socket) {
            // Use Kokoro TTS via socket
            this.socket.emit('tts-request', {
                text: text,
                voice: this.currentVoice,
                format: 'mp3'
            });
        } else {
            // Fallback to Web Speech API
            this.speakWithWebAPI(text);
        }
    }

    handleKokoroResponse(data) {
        console.log('🎤 Kokoro response received:', data.size, 'bytes');

        try {
            // Convert base64 audio data to blob URL
            const audioBlob = this.base64ToBlob(data.audioData, 'audio/mpeg');
            const audioUrl = URL.createObjectURL(audioBlob);

            // Set audio source and play
            if (this.currentAudio) {
                this.currentAudio.src = audioUrl;
                this.currentAudio.load();

                this.currentAudio.onloadedmetadata = () => {
                    console.log('🎤 Audio metadata loaded, duration:', this.currentAudio.duration);
                    this.currentAudio.play().catch(e => {
                        console.error('🎤 Error playing audio:', e);
                        this.handleAudioError(e);
                    });
                };
            }
        } catch (error) {
            console.error('🎤 Error processing Kokoro response:', error);
            this.fallbackToWebSpeech();
        }
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

    fallbackToWebSpeech() {
        console.log('🎤 Falling back to Web Speech API');
        this.speakWithWebAPI(this.currentText);
    }

    // Flash text in spiral center (from tts.js)
    flashTrigger(text, duration) {
        // Try to find spiral container or eye element
        let container = document.getElementById("eye") ||
            document.getElementById("spiral-container") ||
            document.querySelector("#spiral-container");

        if (!container) {
            console.warn('🎤 No spiral container found for text display');
            return;
        }

        // Create or find text display element
        let textDisplay = container.querySelector('.tts-text-display');
        if (!textDisplay) {
            textDisplay = document.createElement('div');
            textDisplay.className = 'tts-text-display';
            // Use CSS variables for proper theming and single-line display
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
                max-width: 80%;
                word-wrap: break-word;
                white-space: nowrap;
                animation: pulse 0.5s ease-in-out infinite alternate;
            `;
            container.appendChild(textDisplay);
        }

        // Display the text
        textDisplay.textContent = text;
        textDisplay.style.display = 'block';

        // Clear after duration
        setTimeout(() => {
            if (textDisplay) {
                textDisplay.style.display = 'none';
                textDisplay.textContent = '';
            }
        }, duration || 3000);
    }

    displayInChat(text) {
        // Display text in chat response area if available
        const response = document.querySelector('.message.ai .message-text:last-child') ||
            document.querySelector('#response') ||
            document.querySelector('#message');

        if (response) {
            const messageElement = document.createElement('p');
            messageElement.className = 'tts-speaking';
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

            if (response.firstChild) {
                response.insertBefore(messageElement, response.firstChild);
            } else {
                response.appendChild(messageElement);
            }

            // Remove after speaking
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, this.currentAudio ? (this.currentAudio.duration * 1000) : 3000);
        }
    }

    // Array management functions from tts.js template
    arrayPush(array, text) {
        if (this.currentAudio) {
            this.currentAudio.hidden = true;
        }

        // Create URL for Kokoro TTS request
        let URL = `/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(this.currentVoice)}`;
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

    // Voice management with strict female-only validation
    setVoice(voice) {
        if (voice && typeof voice === 'string') {
            // Validate that it's not a male voice pattern for Web Speech API
            if (!this.useKokoro && this.isMaleVoice(voice)) {
                console.error('❌ REJECTED male voice for BambiSleep:', voice);
                console.log('🎤 BambiSleep is a GIRL - keeping current female voice');
                return;
            }

            this.currentVoice = voice;
            console.log('✅ Voice set to:', voice);

            // Update voice on server if socket available
            if (this.socket) {
                this.socket.emit('set-voice', { voice: voice });
            }
        }
    }

    // Validate voice is not male (for Web Speech API)
    isMaleVoice(voiceName) {
        const malePatterns = [
            'male', 'man', 'boy', 'david', 'mark', 'george', 'microsoft david',
            'alex', 'daniel', 'fred', 'tom', 'adam', 'andrew', 'brian',
            'christopher', 'diego', 'jorge', 'microsoft mark', 'ricky', 'viktor'
        ];

        const name = voiceName.toLowerCase();
        return malePatterns.some(pattern => name.includes(pattern));
    }

    // Get only verified female voices
    getFemaleVoices() {
        if (this.useKokoro) {
            // All Kokoro voices are female by design
            return [
                'af_sky',
                'af_bella',
                'af_sky+af_bella',
                'af_sarah',
                'af_nicole'
            ];
        } else {
            // Filter Web Speech API voices to only females
            const voices = speechSynthesis.getVoices();
            return voices.filter(voice =>
                (voice.lang.startsWith('en') || voice.lang === '') &&
                !this.isMaleVoice(voice.name)
            );
        }
    }

    // Cleanup function
    cleanupCurrentAudio() {
        if (this.currentAudio && this.currentAudio.src) {
            // Revoke object URL to free memory
            if (this.currentAudio.src.startsWith('blob:')) {
                URL.revokeObjectURL(this.currentAudio.src);
            }
            this.currentAudio.src = '';
        }
    }

    speakWithWebAPI(text) {
        return new Promise((resolve, reject) => {
            if (!('speechSynthesis' in window)) {
                reject(new Error('Speech synthesis not supported'));
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.volume = this.volume;
            utterance.rate = 0.6; // Much slower for better comprehension and pauses
            utterance.pitch = 1.3; // Higher pitch for feminine sound

            // Get all available voices
            const voices = speechSynthesis.getVoices();

            // BAMBISLEEP IS A GIRL - ONLY FEMALE VOICES!
            // Priority order for female voices - STRICTLY FEMALE ONLY
            const femaleVoicePatterns = [
                'zira', 'hazel', 'susan', 'samantha', 'karen', 'helena', 'catherine',
                'female', 'woman', 'girl', 'salli', 'joanna', 'kendra', 'kimberly',
                'amy', 'emma', 'neural', 'enhanced', 'jenny', 'aria', 'nova',
                'alloy', 'shimmer', 'microsoft eva', 'microsoft zira'
            ];

            // Male voice patterns to ABSOLUTELY AVOID
            const maleVoicePatterns = [
                'male', 'man', 'boy', 'david', 'mark', 'george', 'microsoft david',
                'alex', 'daniel', 'fred', 'tom', 'adam', 'andrew', 'brian',
                'christopher', 'diego', 'jorge', 'microsoft mark', 'ricky', 'viktor'
            ];

            let selectedVoice = null;

            // Step 1: Find best female voice by priority
            for (const pattern of femaleVoicePatterns) {
                selectedVoice = voices.find(voice =>
                    voice.name.toLowerCase().includes(pattern) &&
                    (voice.lang.startsWith('en') || voice.lang === '') &&
                    !maleVoicePatterns.some(male => voice.name.toLowerCase().includes(male))
                );
                if (selectedVoice) {
                    console.log('🎤 Found priority female voice:', selectedVoice.name);
                    break;
                }
            }

            // Step 2: If no priority match, find ANY female voice that's not male
            if (!selectedVoice) {
                selectedVoice = voices.find(voice =>
                    (voice.lang.startsWith('en') || voice.lang === '') &&
                    !maleVoicePatterns.some(male => voice.name.toLowerCase().includes(male)) &&
                    (voice.name.toLowerCase().includes('female') ||
                        voice.name.toLowerCase().includes('woman') ||
                        !voice.name.toLowerCase().includes('microsoft'))
                );

                if (selectedVoice) {
                    console.log('🎤 Found alternative female voice:', selectedVoice.name);
                }
            }

            // Step 3: EMERGENCY - Force feminine settings even if no clear female voice
            if (!selectedVoice) {
                // Find any voice that's not explicitly male and force feminine settings
                selectedVoice = voices.find(voice =>
                    (voice.lang.startsWith('en') || voice.lang === '') &&
                    !maleVoicePatterns.some(male => voice.name.toLowerCase().includes(male))
                );

                if (selectedVoice) {
                    console.warn('🎤 Using fallback voice with forced feminine settings:', selectedVoice.name);
                    // Force very high pitch and slower rate for feminine sound
                    utterance.pitch = 1.5;
                    utterance.rate = 0.5;
                } else {
                    // LAST RESORT: Reject if only male voices available
                    console.error('❌ CRITICAL: Only male voices available! BambiSleep requires female voices!');
                    reject(new Error('No female voices available - BambiSleep is a GIRL and requires female TTS!'));
                    return;
                }
            }

            if (selectedVoice) {
                utterance.voice = selectedVoice;
                console.log('✅ Selected FEMALE voice for BambiSleep:', selectedVoice.name, '- Rate:', utterance.rate, '- Pitch:', utterance.pitch);
            }

            // Add debugging and proper event handling
            utterance.onstart = () => {
                console.log('🔊 Web Speech TTS started:', text.substring(0, 50) + '...');
                // Display text in spiral for Web Speech API
                const duration = text.length * 100; // Estimate duration based on text length
                this.flashTrigger(text, duration);
            };

            utterance.onend = () => {
                console.log('✅ Web Speech TTS completed');
                // Add pause between sentences for better comprehension
                const pauseDuration = 500; // 500ms pause between sentences
                setTimeout(() => {
                    this.processTextQueue();
                }, pauseDuration);
                resolve();
            };

            utterance.onerror = (event) => {
                console.error('❌ Web Speech TTS error:', event.error, event);
                // Still continue with next sentence on error
                setTimeout(() => {
                    this.processTextQueue();
                }, 200);
                // Don't reject completely, just log the error
                resolve(); // Continue processing even if one sentence fails
            };

            // Handle pause/resume events
            utterance.onpause = () => {
                console.log('⏸️ Web Speech TTS paused');
            };

            utterance.onresume = () => {
                console.log('▶️ Web Speech TTS resumed');
            };

            // Sometimes speechSynthesis needs a moment to load voices
            if (voices.length === 0) {
                speechSynthesis.addEventListener('voiceschanged', () => {
                    speechSynthesis.speak(utterance);
                }, { once: true });
            } else {
                speechSynthesis.speak(utterance);
            }
        });
    }

    async speakWithServerAPI(text) {
        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    voice: this.currentVoice,
                    format: 'mp3'
                })
            });

            if (!response.ok) {
                throw new Error(`TTS API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.audioData) {
                // Handle base64 audio data from Kokoro
                const audioBlob = this.base64ToBlob(data.audioData, 'audio/mpeg');
                await this.playAudioBlob(audioBlob);
            } else {
                throw new Error('Invalid TTS response format');
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
                reject(new Error('Audio playback failed'));
            };

            audio.src = URL.createObjectURL(blob);
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
        if ('speechSynthesis' in window) {
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
        const container = document.getElementById("eye") ||
            document.getElementById("spiral-container") ||
            document.querySelector("#spiral-container");

        if (container) {
            const textDisplay = container.querySelector('.tts-text-display');
            if (textDisplay) {
                textDisplay.style.display = 'none';
                textDisplay.textContent = '';
            }
        }
    }

    cleanTextForTTS(text) {
        // Remove URLs
        text = text.replace(/https?:\/\/[^\s]+/g, 'link');

        // Remove ALL punctuation marks that should not be spoken
        text = text.replace(/[.,;:!?"""''`~@#$%^&*()_+=\[\]{}|\\<>/\-]/g, ' ');

        // Remove excessive punctuation
        text = text.replace(/[!]{2,}/g, '');
        text = text.replace(/[?]{2,}/g, '');
        text = text.replace(/[.]{3,}/g, '');

        // Replace common emoticons with words
        text = text.replace(/:\)/g, 'smile');
        text = text.replace(/:\(/g, 'sad');
        text = text.replace(/:D/g, 'laugh');
        text = text.replace(/<3/g, 'heart');

        // Remove HTML tags but preserve the text content
        text = text.replace(/<[^>]*>/g, '');

        // Remove markdown formatting
        text = text.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove **bold**
        text = text.replace(/\*(.*?)\*/g, '$1'); // Remove *italic*
        text = text.replace(/__(.*?)__/g, '$1'); // Remove __underline__

        // Remove excessive whitespace and normalize
        text = text.replace(/\s+/g, ' ').trim();

        return text;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    getVolume() {
        return this.volume;
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
        console.log('🎤 Kokoro TTS:', useKokoro ? 'ENABLED' : 'DISABLED');
    }

    getAvailableVoices() {
        // Return only verified female voices
        return this.getFemaleVoices();
    }

    // Utility function for external access to TTS functions
    processAIResponse(message) {
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            console.warn('🎤 Received empty or invalid response:', message);
            return;
        }

        console.log('🎤 Processing AI response for TTS:', message.substring(0, 50) + '...');
        this.speak(message);
    }
}

// Initialize TTS system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ttsSystem = new TextToSpeechSystem();

    // Add CSS animations for spiral text display
    const style = document.createElement('style');
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

    if (!document.querySelector('#tts-animations')) {
        style.id = 'tts-animations';
        document.head.appendChild(style);
    }

    // Export legacy functions for compatibility with existing code
    window.do_tts = function (array) {
        if (window.ttsSystem && array && array.length > 0) {
            const url = window.ttsSystem.arrayShift(array);
            if (url) {
                // Extract text from URL parameter
                const urlParams = new URLSearchParams(url.split('?')[1]);
                const text = urlParams.get('text');
                if (text) {
                    window.ttsSystem.speak(decodeURIComponent(text));
                }
            }
        }
    };

    window.arrayPush = function (array, text) {
        if (window.ttsSystem) {
            window.ttsSystem.arrayPush(array, text);
        }
    };

    window.setVoice = function (voice) {
        if (window.ttsSystem) {
            window.ttsSystem.setVoice(voice);
        }
    };

    // Make the enhanced TTS API available globally
    // ⚠️ IMPORTANT: BambiSleep is a GIRL - ONLY FEMALE VOICES ALLOWED! ⚠️
    window.tts = {
        speak: (text) => window.ttsSystem.speak(text),
        speakSentences: (sentences) => window.ttsSystem.speakSentences(sentences),
        setVoice: (voice) => window.ttsSystem.setVoice(voice),
        setUseKokoro: (use) => window.ttsSystem.setUseKokoro(use),
        getAvailableVoices: () => window.ttsSystem.getAvailableVoices(), // Returns FEMALE voices only
        getFemaleVoices: () => window.ttsSystem.getFemaleVoices(), // Explicit female voice getter
        processAIResponse: (message) => window.ttsSystem.processAIResponse(message),
        toggle: () => window.ttsSystem.toggle(),
        stop: () => window.ttsSystem.stop(),
        isEnabled: () => window.ttsSystem.isEnabled,
        isPlaying: () => window.ttsSystem.isCurrentlyPlaying()
    };
});
