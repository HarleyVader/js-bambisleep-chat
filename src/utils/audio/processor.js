// Audio Processing Utilities
// Implements audio caching, binaural beat generation, and processing
// Optimized for hypnotic audio experiences

export class AudioProcessor {
    constructor() {
        this.audioCache = new Map();
        this.loadAttempts = new Map();
        this.maxLoadAttempts = 3;
    }

    // Audio caching with error handling
    async cacheAudio(url, key) {
        if (this.audioCache.has(key)) {
            return this.audioCache.get(key);
        }

        const attempts = this.loadAttempts.get(key) || 0;
        if (attempts >= this.maxLoadAttempts) {
            throw new Error(`Failed to load audio after ${this.maxLoadAttempts} attempts: ${url}`);
        }

        try {
            const audio = new Audio(url);
            await this.loadAudioPromise(audio);
            this.audioCache.set(key, audio);
            this.loadAttempts.delete(key);
            return audio;
        } catch (error) {
            this.loadAttempts.set(key, attempts + 1);
            throw error;
        }
    }

    // Promise wrapper for audio loading
    loadAudioPromise(audio) {
        return new Promise((resolve, reject) => {
            audio.addEventListener('canplaythrough', resolve);
            audio.addEventListener('error', reject);
            audio.load();
        });
    }

    // Binaural beat generation
    generateBinauralBeat(baseFreq, beatFreq, duration, sampleRate = 48000) {
        const samples = duration * sampleRate;
        const leftChannel = new Float32Array(samples);
        const rightChannel = new Float32Array(samples);

        const leftFreq = baseFreq - (beatFreq / 2);
        const rightFreq = baseFreq + (beatFreq / 2);

        for (let i = 0; i < samples; i++) {
            const time = i / sampleRate;
            leftChannel[i] = Math.sin(2 * Math.PI * leftFreq * time);
            rightChannel[i] = Math.sin(2 * Math.PI * rightFreq * time);
        }

        return { leftChannel, rightChannel, sampleRate };
    }

    // Volume and speed control
    applyVolumeControl(audio, volume) {
        audio.volume = Math.max(0, Math.min(1, volume));
    }

    applySpeedControl(audio, speed) {
        audio.playbackRate = Math.max(0.1, Math.min(3.0, speed));
    }

    // Audio format optimization
    optimizeForHypnosis(audioBuffer) {
        // Implementation for hypnosis-specific audio optimization
        return audioBuffer;
    }
}

export default AudioProcessor;
