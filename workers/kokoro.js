// workers/kokoro.js
// Kokoro TTS Worker - Handles text-to-speech via Kokoro-FastAPI
const { parentPort } = require('worker_threads');
// Note: Using Node's native fetch API (available in Node 18+)

class KokoroTTSWorker {
    constructor() {
        // Load environment variables
        require('dotenv').config();

        this.isHealthy = false;
        this.fallbackMode = false;
        this.outputFormat = 'mp3';

        try {
            this.initializeKokoroConfig();
        } catch (error) {
            console.warn('⚠️ Kokoro TTS configuration incomplete:', error.message);
            console.warn('🔄 Running in fallback mode - TTS will use Web Speech API only');
            this.fallbackMode = true;
            this.isHealthy = false;
        }

        this.init();
    }

    initializeKokoroConfig() {
        const kokoroHost = process.env.NODE_ENV === 'production'
            ? process.env.KOKORO_HOST_PRODUCTION
            : process.env.KOKORO_HOST_DEVELOPMENT;

        if (!kokoroHost) {
            throw new Error(`Missing Kokoro host config for ${process.env.NODE_ENV} environment`);
        }

        const kokoroPort = process.env.KOKORO_PORT || '8880';
        this.defaultVoice = process.env.KOKORO_DEFAULT_VOICE || 'af_bella';

        this.kokoroUrl = `http://${kokoroHost}:${kokoroPort}`;
        this.isHealthy = true;

        console.log('✅ Kokoro TTS configured:', this.kokoroUrl);
    }

    async init() {
        console.log('🎤 Kokoro TTS Worker initializing...');
        if (this.fallbackMode) {
            console.log('🎤 Kokoro TTS running in fallback mode');
        } else {
            console.log(`🎤 Kokoro TTS service URL: ${this.kokoroUrl}`);
        }

        if (parentPort) {
            parentPort.on('message', this.handleMessage.bind(this));
        }
    }

    async handleMessage(msg) {
        try {
            if (this.fallbackMode && msg.type === 'tts') {
                this.sendError('Kokoro TTS not available - using Web Speech API fallback', msg.socketId);
                return;
            }

            switch (msg.type) {
                case 'tts':
                    await this.generateSpeech(msg);
                    break;

                case 'health':
                    this.sendResponse('health_response', {
                        healthy: this.isHealthy,
                        fallbackMode: this.fallbackMode,
                        url: this.kokoroUrl || 'not-configured',
                        lastCheck: new Date().toISOString()
                    }, msg.socketId);
                    break;

                case 'set_voice':
                    if (this.fallbackMode) {
                        this.sendError('Voice setting not available in fallback mode', msg.socketId);
                        return;
                    }
                    this.defaultVoice = msg.voice || this.defaultVoice;
                    this.sendResponse('voice_updated', {
                        voice: this.defaultVoice
                    }, msg.socketId);
                    break;

                default:
                    console.warn(`Unknown message type: ${msg.type}`);
            }
        } catch (error) {
            console.error('Kokoro worker error:', error);
            this.sendError(error.message, msg.socketId);
        }
    }



    async generateSpeech(msg) {
        const { text, voice, format, socketId, streaming = false } = msg;

        if (!text || typeof text !== 'string') {
            throw new Error('Invalid text input for TTS');
        }

        const selectedVoice = voice || this.defaultVoice;
        const selectedFormat = format || this.outputFormat;

        console.log(`🎤 Generating speech: "${text.substring(0, 50)}..." with voice: ${selectedVoice}`);

        try {
            // Use OpenAI-compatible endpoint per Kokoro-FastAPI official docs
            // https://github.com/remsky/Kokoro-FastAPI
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(`${this.kokoroUrl}/v1/audio/speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // NO Authorization header needed per Kokoro-FastAPI docs
                },
                body: JSON.stringify({
                    model: 'kokoro',
                    voice: selectedVoice,
                    input: text,
                    response_format: selectedFormat,
                    speed: 1.0
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Kokoro API error (${response.status}): ${errorText}`);
            }

            // Get audio buffer
            const audioBuffer = await response.arrayBuffer();
            const audioBase64 = Buffer.from(audioBuffer).toString('base64');

            console.log(`✅ Speech generated successfully (${audioBuffer.byteLength} bytes)`);

            this.sendResponse('tts_success', {
                audioData: audioBase64,
                format: selectedFormat,
                voice: selectedVoice,
                text: text,
                size: audioBuffer.byteLength,
                timestamp: new Date().toISOString()
            }, socketId);

        } catch (error) {
            console.error('Kokoro TTS generation failed:', error);
            this.sendError(`TTS generation failed: ${error.message}`, socketId);
        }
    }

    sendResponse(type, data, socketId = null) {
        if (parentPort) {
            parentPort.postMessage({
                type,
                socketId,
                ...data
            });
        }
    }

    sendError(error, socketId = null) {
        if (parentPort) {
            parentPort.postMessage({
                type: 'error',
                error,
                socketId,
                timestamp: new Date().toISOString()
            });
        }
    }
}

// Initialize worker
const worker = new KokoroTTSWorker();

// Handle worker shutdown
process.on('SIGTERM', () => {
    console.log('🎤 Kokoro TTS Worker shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🎤 Kokoro TTS Worker shutting down...');
    process.exit(0);
});
