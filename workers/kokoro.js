// workers/kokoro.js
// Kokoro TTS Worker - Handles text-to-speech via Kokoro-FastAPI
// OPTIMIZED: Added caching, connection pooling, and batch processing
const { parentPort } = require('worker_threads');
const http = require('http');
const https = require('https');
const ENV = require('../config/env');

// HTTP Keep-Alive agents for connection reuse (faster subsequent requests)
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10, timeout: 15000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10, timeout: 15000 });

class KokoroTTSWorker {
    constructor() {
        this.isHealthy = false;
        this.fallbackMode = false;
        this.outputFormat = 'mp3';

        // OPTIMIZATION: Audio cache for repeated phrases (LRU-style)
        this.audioCache = new Map();
        this.maxCacheSize = 50;
        this.cacheHits = 0;
        this.cacheMisses = 0;

        // OPTIMIZATION: Request queue for batch processing
        this.pendingRequests = new Map();
        this.processingBatch = false;

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
        if (!ENV.KOKORO.isConfigured) {
            throw new Error(`Missing Kokoro host config for ${ENV.NODE_ENV} environment`);
        }

        this.kokoroUrl = ENV.KOKORO.URL;
        this.defaultVoice = ENV.KOKORO.DEFAULT_VOICE;
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

                case 'tts_batch':
                    // OPTIMIZATION: Process multiple texts in parallel
                    await this.generateSpeechBatch(msg);
                    break;

                case 'cache_stats':
                    this.sendResponse('cache_stats', {
                        size: this.audioCache.size,
                        hits: this.cacheHits,
                        misses: this.cacheMisses,
                        hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
                    }, msg.socketId);
                    break;

                case 'clear_cache':
                    this.audioCache.clear();
                    this.cacheHits = 0;
                    this.cacheMisses = 0;
                    console.log('🧹 TTS cache cleared');
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



    // OPTIMIZATION: Generate cache key for audio caching
    getCacheKey(text, voice, format) {
        return `${voice}:${format}:${text.substring(0, 200)}`; // Limit key length
    }

    // OPTIMIZATION: Add to cache with LRU eviction
    addToCache(key, audioBase64) {
        // Evict oldest entries if cache is full
        if (this.audioCache.size >= this.maxCacheSize) {
            const firstKey = this.audioCache.keys().next().value;
            this.audioCache.delete(firstKey);
        }
        this.audioCache.set(key, {
            data: audioBase64,
            timestamp: Date.now()
        });
    }

    async generateSpeech(msg) {
        const { text, voice, format, socketId, streaming = false, speed = 1.0 } = msg;

        if (!text || typeof text !== 'string') {
            throw new Error('Invalid text input for TTS');
        }

        const selectedVoice = voice || this.defaultVoice;
        const selectedFormat = format || this.outputFormat;
        const cacheKey = this.getCacheKey(text, selectedVoice, selectedFormat);

        // OPTIMIZATION: Check cache first
        const cached = this.audioCache.get(cacheKey);
        if (cached) {
            this.cacheHits++;
            console.log(`⚡ Cache hit for: "${text.substring(0, 30)}..." (${this.cacheHits} hits)`);
            this.sendResponse('tts_success', {
                audioData: cached.data,
                format: selectedFormat,
                voice: selectedVoice,
                text: text,
                size: cached.data.length * 0.75, // Approximate size from base64
                cached: true,
                timestamp: new Date().toISOString()
            }, socketId);
            return;
        }
        this.cacheMisses++;

        console.log(`🎤 Generating speech: "${text.substring(0, 50)}..." with voice: ${selectedVoice}`);

        try {
            // OPTIMIZATION: Reduced timeout from 30s to 15s for faster failure detection
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            // OPTIMIZATION: Use keep-alive agent for connection reuse
            const isHttps = this.kokoroUrl.startsWith('https');
            const agent = isHttps ? httpsAgent : httpAgent;

            const response = await fetch(`${this.kokoroUrl}/v1/audio/speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Connection': 'keep-alive'
                },
                body: JSON.stringify({
                    model: 'kokoro',
                    voice: selectedVoice,
                    input: text,
                    response_format: selectedFormat,
                    speed: speed
                }),
                signal: controller.signal,
                agent: agent // Use keep-alive agent
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Kokoro API error (${response.status}): ${errorText}`);
            }

            // Get audio buffer
            const audioBuffer = await response.arrayBuffer();
            const audioBase64 = Buffer.from(audioBuffer).toString('base64');

            // OPTIMIZATION: Cache the result
            this.addToCache(cacheKey, audioBase64);

            console.log(`✅ Speech generated successfully (${audioBuffer.byteLength} bytes)`);

            this.sendResponse('tts_success', {
                audioData: audioBase64,
                format: selectedFormat,
                voice: selectedVoice,
                text: text,
                size: audioBuffer.byteLength,
                cached: false,
                timestamp: new Date().toISOString()
            }, socketId);

        } catch (error) {
            console.error('Kokoro TTS generation failed:', error);
            this.sendError(`TTS generation failed: ${error.message}`, socketId);
        }
    }

    // OPTIMIZATION: Batch process multiple texts in parallel
    async generateSpeechBatch(msg) {
        const { texts, voice, format, socketId } = msg;

        if (!Array.isArray(texts) || texts.length === 0) {
            this.sendError('Invalid texts array for batch TTS', socketId);
            return;
        }

        console.log(`🎤 Batch generating ${texts.length} speeches`);
        const startTime = Date.now();

        // Process up to 3 requests in parallel for optimal performance
        const batchSize = 3;
        const results = [];

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchPromises = batch.map((text, idx) =>
                this.generateSpeechInternal(text, voice, format)
                    .then(result => ({ index: i + idx, success: true, ...result }))
                    .catch(error => ({ index: i + idx, success: false, error: error.message }))
            );
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        const elapsed = Date.now() - startTime;
        console.log(`✅ Batch complete: ${results.filter(r => r.success).length}/${texts.length} in ${elapsed}ms`);

        this.sendResponse('tts_batch_success', {
            results: results,
            totalTime: elapsed,
            timestamp: new Date().toISOString()
        }, socketId);
    }

    // Internal speech generation without socket response (for batch processing)
    async generateSpeechInternal(text, voice, format) {
        const selectedVoice = voice || this.defaultVoice;
        const selectedFormat = format || this.outputFormat;
        const cacheKey = this.getCacheKey(text, selectedVoice, selectedFormat);

        // Check cache
        const cached = this.audioCache.get(cacheKey);
        if (cached) {
            this.cacheHits++;
            return { audioData: cached.data, format: selectedFormat, voice: selectedVoice, text, cached: true };
        }
        this.cacheMisses++;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${this.kokoroUrl}/v1/audio/speech`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Connection': 'keep-alive' },
            body: JSON.stringify({ model: 'kokoro', voice: selectedVoice, input: text, response_format: selectedFormat, speed: 1.0 }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`Kokoro API error: ${response.status}`);

        const audioBuffer = await response.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');
        this.addToCache(cacheKey, audioBase64);

        return { audioData: audioBase64, format: selectedFormat, voice: selectedVoice, text, cached: false, size: audioBuffer.byteLength };
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
