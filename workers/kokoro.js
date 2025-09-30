// workers/kokoro.js
// Kokoro TTS Worker - Handles text-to-speech via Kokoro-FastAPI
const { parentPort } = require('worker_threads');
const fetch = require('node-fetch');

class KokoroTTSWorker {
    constructor() {
        // Load environment variables
        require('dotenv').config();

        // Determine Kokoro URL based on environment - NO HARDCODED DEFAULTS
        const kokoroHost = process.env.NODE_ENV === 'production'
            ? process.env.KOKORO_HOST_PRODUCTION
            : process.env.KOKORO_HOST_DEVELOPMENT;

        if (!kokoroHost) {
            throw new Error(`Missing required environment variable: ${process.env.NODE_ENV === 'production' ? 'KOKORO_HOST_PRODUCTION' : 'KOKORO_HOST_DEVELOPMENT'}`);
        }

        const kokoroPort = process.env.KOKORO_PORT;
        if (!kokoroPort) {
            throw new Error('Missing required environment variable: KOKORO_PORT');
        }

        this.kokoroUrl = `http://${kokoroHost}:${kokoroPort}`;
        this.defaultVoice = process.env.KOKORO_DEFAULT_VOICE;
        if (!this.defaultVoice) {
            throw new Error('Missing required environment variable: KOKORO_DEFAULT_VOICE');
        }
        this.outputFormat = 'mp3';
        this.isHealthy = true; // Assume healthy, no health check endpoint available

        this.init();
    }

    async init() {
        console.log('🎤 Kokoro TTS Worker initializing...');
        console.log(`🎤 Kokoro TTS service URL: ${this.kokoroUrl}`);

        if (parentPort) {
            parentPort.on('message', this.handleMessage.bind(this));
        }
    }

    async handleMessage(msg) {
        try {
            switch (msg.type) {
                case 'tts':
                    await this.generateSpeech(msg);
                    break;

                case 'health':
                    this.sendResponse('health_response', {
                        healthy: true,
                        url: this.kokoroUrl,
                        lastCheck: new Date().toISOString()
                    }, msg.socketId);
                    break;

                case 'set_voice':
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

        // Kokoro TTS service assumed to be available

        const selectedVoice = voice || this.defaultVoice;
        const selectedFormat = format || this.outputFormat;

        console.log(`🎤 Generating speech: "${text.substring(0, 50)}..." with voice: ${selectedVoice}`);

        try {
            // Use OpenAI-compatible endpoint as per Kokoro docs
            const response = await fetch(`${this.kokoroUrl}/v1/audio/speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer not-needed' // Kokoro doesn't require real auth
                },
                body: JSON.stringify({
                    model: 'kokoro',
                    voice: selectedVoice,
                    input: text,
                    response_format: selectedFormat,
                    speed: 1.0
                }),
                timeout: 30000
            });

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
