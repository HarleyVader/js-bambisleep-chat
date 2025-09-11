// text2speech.js - Text-to-speech queue and audio management
class TextToSpeechSystem {
    constructor() {
        this.isEnabled = false;
        this.queue = [];
        this.isPlaying = false;
        this.audioContext = null;
        this.currentAudio = null;
        this.volume = 0.7;
        
        this.init();
    }

    init() {
        // Initialize Web Audio API
        this.initAudioContext();
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported');
        }
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

        // Clean text for TTS
        const cleanText = this.cleanTextForTTS(text);
        
        // Add to queue
        this.queue.push(cleanText);
        
        // Process queue if not already playing
        if (!this.isPlaying) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.queue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        const text = this.queue.shift();
        
        try {
            // Try using built-in TTS first
            await this.speakWithWebAPI(text);
        } catch (error) {
            console.warn('Web Speech API failed, trying server TTS');
            try {
                await this.speakWithServerAPI(text);
            } catch (serverError) {
                console.error('TTS failed:', serverError);
            }
        }
        
        // Continue with next item in queue
        setTimeout(() => this.processQueue(), 100);
    }

    speakWithWebAPI(text) {
        return new Promise((resolve, reject) => {
            if (!('speechSynthesis' in window)) {
                reject(new Error('Speech synthesis not supported'));
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.volume = this.volume;
            utterance.rate = 0.9;
            utterance.pitch = 1.1;
            
            // Try to find a female voice
            const voices = speechSynthesis.getVoices();
            const femaleVoice = voices.find(voice => 
                voice.name.toLowerCase().includes('female') || 
                voice.name.toLowerCase().includes('woman') ||
                voice.name.toLowerCase().includes('zira') ||
                voice.name.toLowerCase().includes('hazel')
            );
            
            if (femaleVoice) {
                utterance.voice = femaleVoice;
            }

            utterance.onend = () => resolve();
            utterance.onerror = (event) => reject(new Error(event.error));
            
            speechSynthesis.speak(utterance);
        });
    }

    async speakWithServerAPI(text) {
        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text })
            });
            
            if (!response.ok) {
                throw new Error(`TTS API error: ${response.status}`);
            }
            
            const audioBlob = await response.blob();
            await this.playAudioBlob(audioBlob);
            
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
            this.currentAudio = null;
        }
        
        // Stop Web Speech API
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
        }
        
        this.isPlaying = false;
    }

    clearQueue() {
        this.queue = [];
    }

    cleanTextForTTS(text) {
        // Remove URLs
        text = text.replace(/https?:\/\/[^\s]+/g, 'link');
        
        // Remove excessive punctuation
        text = text.replace(/[!]{2,}/g, '!');
        text = text.replace(/[?]{2,}/g, '?');
        text = text.replace(/[.]{3,}/g, '...');
        
        // Replace common emoticons with words
        text = text.replace(/:\)/g, 'smile');
        text = text.replace(/:\(/g, 'sad');
        text = text.replace(/:D/g, 'laugh');
        text = text.replace(/<3/g, 'heart');
        
        // Remove excessive whitespace
        text = text.replace(/\s+/g, ' ').trim();
        
        // Limit length
        if (text.length > 200) {
            text = text.substring(0, 197) + '...';
        }
        
        return text;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    getVolume() {
        return this.volume;
    }

    getQueueLength() {
        return this.queue.length;
    }

    isCurrentlyPlaying() {
        return this.isPlaying;
    }
}

// Initialize TTS system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ttsSystem = new TextToSpeechSystem();
});
