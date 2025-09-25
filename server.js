// server.js
// Express + Socket.io + TTS + Triggers + LM Studio chat server
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Worker } = require('worker_threads');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// TTS Configuration
const config = {
    KOKORO_API_URL: process.env.KOKORO_API_URL || `http://${process.env.KOKORO_HOST_DEVELOPMENT || process.env.KOKORO_HOST_PRODUCTION || 'localhost'}:${process.env.KOKORO_PORT || 8880}`,
    KOKORO_API_KEY: process.env.KOKORO_API_KEY,
    KOKORO_DEFAULT_VOICE: process.env.KOKORO_DEFAULT_VOICE || 'af_sky+af_bella',
    TTS_TIMEOUT: parseInt(process.env.TTS_TIMEOUT) || 30000
};

// Configuration validation and setup
function validateConfiguration() {
    console.log('🔧 Validating configuration...');

    const warnings = [];
    const errors = [];

    // Check required environment variables
    if (!process.env.PORT && !process.env.port) {
        warnings.push('PORT not set, using default 6969');
    }

    // Validate Kokoro TTS configuration
    const kokoroHost = process.env.KOKORO_HOST_DEVELOPMENT || process.env.KOKORO_HOST_PRODUCTION;
    const kokoroPort = process.env.KOKORO_PORT;

    if (!kokoroHost) {
        warnings.push('Kokoro TTS host not configured - TTS will be limited to Web Speech API');
    }

    if (!kokoroPort) {
        warnings.push('Kokoro TTS port not set, using default 8880');
    }

    // Validate LM Studio configuration
    const lmsHost = process.env.NODE_ENV === 'production'
        ? process.env.LMS_HOST_PRODUCTION
        : process.env.LMS_HOST_DEVELOPMENT;

    if (!lmsHost) {
        warnings.push('LM Studio host not configured for current environment, using default localhost');
    }

    if (!process.env.LMS_PORT) {
        warnings.push('LM Studio port not configured, using default 7777');
    }

    // Log warnings
    warnings.forEach(warning => console.warn('⚠️ ', warning));

    // Log errors and exit if critical
    if (errors.length > 0) {
        errors.forEach(error => console.error('❌', error));
        console.error('💥 Configuration validation failed. Please check your .env file.');
        process.exit(1);
    }

    console.log('✅ Configuration validation completed');

    return {
        warnings: warnings.length,
        errors: errors.length,
        ttsAvailable: !!kokoroHost,
        lmStudioConfigured: !!(lmsHost || process.env.LMS_PORT)
    };
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Validate configuration on startup
const configStatus = validateConfiguration();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage (replace with database in production)
let chatHistory = [];
let triggerWords = []; // Will be loaded from official triggers.json
let triggerData = {}; // Full trigger data for API endpoints
let connectedUsers = 0;
let uniqueUsers = new Set(); // Track unique users by IP/session

// Load OFFICIAL BambiSleep triggers from JSON file with enhanced data
function loadOfficialTriggers() {
    try {
        const fs = require('fs');
        const path = require('path');
        const triggersPath = path.join(__dirname, 'workers', 'triggers.json');

        const data = JSON.parse(fs.readFileSync(triggersPath, 'utf8'));

        // Extract trigger names and full data from official source
        triggerWords = [];
        triggerData = data; // Store complete trigger data

        if (data.triggers && Array.isArray(data.triggers)) {
            data.triggers.forEach(trigger => {
                const triggerName = trigger.name.toLowerCase();
                triggerWords.push(triggerName);
            });
        }

        console.log('🎯 Loaded OFFICIAL BambiSleep triggers:', triggerWords);
        console.log('📋 Source:', data.source, '| Version:', data.version);
        console.log('🏷️ Categories available:', Object.keys(data.categories || {}));
        console.log('⚡ Full trigger data loaded for API endpoints');

    } catch (error) {
        console.error('CRITICAL: Failed to load official BambiSleep triggers:', error);
        // NO FALLBACK - Only use official triggers
        triggerWords = [];
        triggerData = {};
    }
}

// Initialize official triggers on startup
loadOfficialTriggers();

// Worker Management
let lmWorker = null;
let kokoroWorker = null;
let workerUsers = new Map(); // Track which users are using AI
let collarActive = false;
let collarText = '';

// Initialize Workers
function initializeLMWorker() {
    try {
        lmWorker = new Worker(path.join(__dirname, 'workers', 'lmstudio.js'));

        lmWorker.on('message', (msg) => {
            handleLMWorkerMessage(msg);
        });

        lmWorker.on('error', (error) => {
            console.error('LM Studio worker error:', error);
        });

        lmWorker.on('exit', (code) => {
            console.log(`LM Studio worker exited with code ${code}`);
            if (code !== 0) {
                console.log('Restarting LM Studio worker...');
                setTimeout(initializeLMWorker, 5000);
            }
        });

        // Send initial triggers and full trigger data to worker
        lmWorker.postMessage({
            type: 'triggers',
            triggers: triggerWords,
            triggerData: triggerData // Send full trigger data to worker
        });

        console.log('LM Studio worker initialized');
    } catch (error) {
        console.error('Failed to initialize LM Studio worker:', error);
    }
}

function initializeKokoroWorker() {
    try {
        kokoroWorker = new Worker(path.join(__dirname, 'workers', 'kokoro.js'));

        kokoroWorker.on('message', (msg) => {
            handleKokoroWorkerMessage(msg);
        });

        kokoroWorker.on('error', (error) => {
            console.error('Kokoro TTS worker error:', error);
        });

        kokoroWorker.on('exit', (code) => {
            console.log(`Kokoro TTS worker exited with code ${code}`);
            if (code !== 0) {
                console.log('Restarting Kokoro TTS worker...');
                setTimeout(initializeKokoroWorker, 5000);
            }
        });

        console.log('🎤 Kokoro TTS worker initialized');
    } catch (error) {
        console.error('Failed to initialize Kokoro TTS worker:', error);
    }
}

// Handle messages from LM Studio worker
function handleLMWorkerMessage(msg) {
    switch (msg.type) {
        case 'response':
            // Check if this is an API request
            if (global.pendingAPIRequests && global.pendingAPIRequests[msg.socketId]) {
                const { res, timeout } = global.pendingAPIRequests[msg.socketId];
                clearTimeout(timeout);
                res.json({
                    response: msg.response,
                    wordCount: msg.wordCount || 0,
                    timestamp: new Date().toISOString()
                });
                delete global.pendingAPIRequests[msg.socketId];
                return;
            }

            // Send AI response to specific socket for regular chat
            if (msg.socketId) {
                io.to(msg.socketId).emit('ai-response', {
                    message: msg.response,
                    timestamp: new Date().toISOString(),
                    wordCount: msg.wordCount || 0
                });

                // Add to chat history for this user only
                const messageData = {
                    id: Date.now(),
                    message: msg.response,
                    timestamp: new Date().toISOString(),
                    user: 'BambiSleep',
                    isAI: true
                };

                chatHistory.push(messageData);
                if (chatHistory.length > 100) {
                    chatHistory.shift();
                }
            }
            break;

        case 'error':
            console.error('Worker error:', msg.error);

            // Check if this is an API request
            if (global.pendingAPIRequests && global.pendingAPIRequests[msg.socketId]) {
                const { res, timeout } = global.pendingAPIRequests[msg.socketId];
                clearTimeout(timeout);
                res.status(500).json({ error: msg.error || 'AI processing error' });
                delete global.pendingAPIRequests[msg.socketId];
                return;
            }

            // Handle regular socket error
            if (msg.socketId) {
                io.to(msg.socketId).emit('ai-error', {
                    error: msg.error,
                    timestamp: new Date().toISOString()
                });
            }
            break;

        case 'health_response':
            console.log(`Worker health: ${msg.healthy}, sessions: ${msg.sessionCount}`);
            break;

        case 'model_loaded':
            console.log(`✅ Model loaded: ${msg.modelId} (${msg.modelSize})`);
            io.emit('model-status', {
                loaded: true,
                modelId: msg.modelId,
                modelSize: msg.modelSize,
                timestamp: new Date().toISOString()
            });
            break;
    }
}

// Handle messages from Kokoro TTS worker
function handleKokoroWorkerMessage(msg) {
    switch (msg.type) {
        case 'tts_success':
            // Send TTS audio to specific socket
            if (msg.socketId) {
                io.to(msg.socketId).emit('tts-response', {
                    audioData: msg.audioData,
                    format: msg.format,
                    voice: msg.voice,
                    text: msg.text,
                    size: msg.size,
                    timestamp: msg.timestamp
                });
            }
            console.log(`✅ TTS generated for ${msg.socketId}: ${msg.size} bytes`);
            break;

        case 'error':
            console.error('Kokoro TTS error:', msg.error);
            if (msg.socketId) {
                io.to(msg.socketId).emit('tts-error', {
                    error: msg.error,
                    timestamp: msg.timestamp
                });
            }
            break;

        case 'health_response':
            console.log(`🎤 Kokoro TTS health: ${msg.healthy}, URL: ${msg.url}`);
            break;

        case 'voice_updated':
            console.log(`🎤 Voice updated to: ${msg.voice}`);
            break;
    }
}

// Initialize workers on startup
initializeLMWorker();
initializeKokoroWorker();

// Setup TTS Routes with configuration validation
setupTTSRoutes(app, configStatus);

// Socket.io connection handling
io.on('connection', (socket) => {
    connectedUsers++;

    // Track unique users by IP address for more accurate counting
    const clientIP = socket.handshake.address || socket.request.connection.remoteAddress;
    const userAgent = socket.handshake.headers['user-agent'] || 'unknown';
    const userKey = `${clientIP}-${userAgent.substring(0, 50)}`;

    uniqueUsers.add(userKey);

    console.log(`User connected. Total connections: ${connectedUsers}, Unique users: ${uniqueUsers.size}`);
    console.log(`🔍 New connection ID: ${socket.id}`);
    console.log(`🔍 Client IP: ${clientIP}`);
    console.log(`🔍 User Agent: ${userAgent?.substring(0, 100)}`);
    console.log(`🔍 Connection origin:`, socket.handshake.headers.origin);

    // Send recent chat history to new user
    socket.emit('chat-history', chatHistory.slice(-20));

    // Broadcast connection count (use unique users for display)
    io.emit('user-count', uniqueUsers.size);

    // Handle regular chat messages
    socket.on('message', (data) => {
        const messageData = {
            id: Date.now(),
            message: data.message,
            timestamp: data.timestamp || new Date().toISOString(),
            user: data.username || socket.id,
            username: data.username
        };

        // Store message
        chatHistory.push(messageData);

        // Keep only last 100 messages
        if (chatHistory.length > 100) {
            chatHistory.shift();
        }

        // Broadcast to all clients
        socket.broadcast.emit('message', messageData);

        console.log(`Message from ${messageData.user}: ${data.message}`);
    });

    // Handle AI chat requests
    socket.on('ai-chat', (data) => {
        if (!lmWorker) {
            socket.emit('ai-error', {
                error: 'AI worker not available',
                timestamp: new Date().toISOString()
            });
            return;
        }

        const username = data.username || `User_${socket.id}`;
        const userTriggers = data.triggers || []; // Get user-selected triggers

        console.log(`AI chat request from ${username}: ${data.message}`);
        console.log(`🎯 User selected triggers:`, userTriggers);

        // Track this user as using AI
        workerUsers.set(socket.id, username);

        // Send message to worker with user-selected triggers
        lmWorker.postMessage({
            type: 'chat',
            prompt: data.message,
            socketId: socket.id,
            username: username,
            triggers: userTriggers // Pass user-selected triggers to worker
        });
    });

    // Handle trigger updates
    socket.on('update-triggers', (data) => {
        if (data.triggers && Array.isArray(data.triggers)) {
            // Update triggers for this socket
            if (lmWorker) {
                lmWorker.postMessage({
                    type: 'triggers',
                    triggers: data.triggers,
                    socketId: socket.id
                });
            }
            console.log(`Updated triggers for ${socket.id}: ${data.triggers.join(', ')}`);
        }
    });

    // Handle TTS requests
    socket.on('tts-request', (data) => {
        if (!kokoroWorker) {
            socket.emit('tts-error', {
                error: 'Kokoro TTS worker not available',
                timestamp: new Date().toISOString()
            });
            return;
        }

        const { text, voice, format } = data;

        if (!text || typeof text !== 'string') {
            socket.emit('tts-error', {
                error: 'Invalid text input for TTS',
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Clean and lowercase text for TTS (same cleaning as HTTP endpoint)
        const cleanedText = cleanTextForTTS(text);

        console.log(`🎤 TTS request from ${socket.id}: "${text.substring(0, 50)}..." -> cleaned: "${cleanedText.substring(0, 50)}..."`);

        // Send to Kokoro worker
        kokoroWorker.postMessage({
            type: 'tts',
            text: cleanedText, // Send cleaned lowercase text
            voice: voice,
            format: format,
            socketId: socket.id
        });
    });

    // Handle voice setting updates
    socket.on('set-voice', (data) => {
        if (!kokoroWorker) {
            socket.emit('tts-error', {
                error: 'Kokoro TTS worker not available',
                timestamp: new Date().toISOString()
            });
            return;
        }

        const { voice } = data;

        if (!voice || typeof voice !== 'string') {
            socket.emit('tts-error', {
                error: 'Invalid voice parameter',
                timestamp: new Date().toISOString()
            });
            return;
        }

        console.log(`🎤 Voice update from ${socket.id}: ${voice}`);

        kokoroWorker.postMessage({
            type: 'set_voice',
            voice: voice,
            socketId: socket.id
        });
    });

    // Handle collar activation
    socket.on('activate-collar', (data) => {
        collarActive = true;
        collarText = data.text || 'Collar activated for deeper submission and control.';

        if (lmWorker) {
            lmWorker.postMessage({
                type: 'collar',
                data: collarText,
                socketId: socket.id
            });
        }

        console.log(`Collar activated for ${socket.id}: "${collarText.substring(0, 30)}..."`);

        // Notify client
        socket.emit('collar-activated', {
            active: true,
            text: collarText,
            timestamp: new Date().toISOString()
        });
    });

    // Handle collar deactivation
    socket.on('deactivate-collar', () => {
        collarActive = false;
        collarText = '';

        console.log(`Collar deactivated for ${socket.id}`);

        // Notify client
        socket.emit('collar-activated', {
            active: false,
            timestamp: new Date().toISOString()
        });
    });

    // Manual model loading trigger
    socket.on('load-model', () => {
        console.log(`Manual model load requested by ${socket.id}`);
        if (lmWorker) {
            lmWorker.postMessage({
                type: 'auto_load_model'
            });

            socket.emit('model-status', {
                loading: true,
                message: 'Searching for best l3-sthenomaidblackroot-8b-v1 model...',
                timestamp: new Date().toISOString()
            });
        } else {
            socket.emit('model-status', {
                error: true,
                message: 'LM Studio worker not available',
                timestamp: new Date().toISOString()
            });
        }
    });

    socket.on('disconnect', () => {
        connectedUsers--;
        workerUsers.delete(socket.id);

        // Clean up unique user tracking on disconnect
        const clientIP = socket.handshake.address || socket.request.connection.remoteAddress;
        const userAgent = socket.handshake.headers['user-agent'] || 'unknown';
        const userKey = `${clientIP}-${userAgent.substring(0, 50)}`;

        // Only remove unique user if no other connections from same user exist
        const hasOtherConnections = Array.from(io.sockets.sockets.values()).some(s => {
            if (s.id === socket.id) return false;
            const otherIP = s.handshake.address || s.request.connection.remoteAddress;
            const otherAgent = s.handshake.headers['user-agent'] || 'unknown';
            const otherKey = `${otherIP}-${otherAgent.substring(0, 50)}`;
            return otherKey === userKey;
        });

        if (!hasOtherConnections) {
            uniqueUsers.delete(userKey);
        }

        console.log(`User disconnected. Total connections: ${connectedUsers}, Unique users: ${uniqueUsers.size}`);
        console.log(`🔍 Disconnected ID: ${socket.id}`);

        // Broadcast unique user count
        io.emit('user-count', uniqueUsers.size);
    });
});

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        users: connectedUsers,
        configuration: {
            ttsAvailable: configStatus.ttsAvailable,
            lmStudioConfigured: configStatus.lmStudioConfigured,
            warnings: configStatus.warnings,
            errors: configStatus.errors
        }
    });
});

// Serve docs folder for markdown documentation
app.use('/docs', express.static(path.join(__dirname, 'public', 'docs')));

// Chat history
app.get('/api/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    res.json({
        messages: chatHistory.slice(-limit),
        total: chatHistory.length
    });
});

// Enhanced trigger management with full official data
app.get('/api/triggers', (req, res) => {
    res.json({
        triggers: triggerWords,
        data: triggerData,
        source: triggerData.source || 'Unknown',
        version: triggerData.version || 'Unknown',
        categories: triggerData.categories || {},
        count: triggerWords.length
    });
});

// Serve the raw triggers.json file
app.get('/api/triggers/json', (req, res) => {
    res.json(triggerData);
});

// Get triggers by category
app.get('/api/triggers/category/:category', (req, res) => {
    const { category } = req.params;

    if (!triggerData.triggers) {
        return res.status(404).json({ error: 'Trigger data not loaded' });
    }

    const categoryTriggers = triggerData.triggers.filter(trigger =>
        trigger.category === category
    );

    res.json({
        category,
        triggers: categoryTriggers,
        count: categoryTriggers.length,
        description: triggerData.categories ? triggerData.categories[category] : 'No description'
    });
});

// Get specific trigger details
app.get('/api/triggers/details/:triggerName', (req, res) => {
    const { triggerName } = req.params;

    if (!triggerData.triggers) {
        return res.status(404).json({ error: 'Trigger data not loaded' });
    }

    const trigger = triggerData.triggers.find(t =>
        t.name.toLowerCase() === triggerName.toLowerCase()
    );

    if (trigger) {
        res.json(trigger);
    } else {
        res.status(404).json({ error: 'Trigger not found' });
    }
});

app.post('/api/triggers', (req, res) => {
    res.status(403).json({
        error: 'Trigger modification disabled - Only official BambiSleep triggers are supported',
        message: 'This system uses exclusively official triggers from https://bambisleep.info/Triggers'
    });
});

// AI Chat endpoint
app.post('/api/chat', (req, res) => {
    const { message, username, triggers, collar } = req.body;

    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Invalid message input' });
    }

    if (!lmWorker) {
        return res.status(503).json({ error: 'AI worker not available' });
    }

    // Generate a temporary socket ID for API requests
    const tempSocketId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Send to worker
    lmWorker.postMessage({
        type: 'chat',
        prompt: message,
        socketId: tempSocketId,
        username: username || 'Anonymous',
        triggers: triggers || [] // Pass triggers to worker
    });

    // Set a timeout to respond
    const timeout = setTimeout(() => {
        res.status(504).json({ error: 'AI response timeout' });
        delete pendingAPIRequests[tempSocketId];
    }, 60000); // 1 minute timeout

    // Store the response object for this request
    if (!global.pendingAPIRequests) {
        global.pendingAPIRequests = {};
    }
    global.pendingAPIRequests[tempSocketId] = { res, timeout };
});

// Collar management
app.post('/api/collar', (req, res) => {
    const { active, text } = req.body;

    collarActive = Boolean(active);
    collarText = active ? (text || 'Collar activated for deeper submission and control.') : '';

    if (lmWorker && active) {
        lmWorker.postMessage({
            type: 'collar',
            data: collarText
        });
    }

    res.json({
        success: true,
        active: collarActive,
        text: collarText,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/collar', (req, res) => {
    res.json({
        active: collarActive,
        text: collarText,
        timestamp: new Date().toISOString()
    });
});

// Setup TTS Routes with configuration validation
function setupTTSRoutes(app, configStatus = { ttsAvailable: true }) {
    // Check if Kokoro API is configured
    if (!config.KOKORO_API_URL || !kokoroWorker || !configStatus.ttsAvailable) {
        console.warn('🎤 Kokoro API or worker not configured, TTS routes will return 503');

        // Return service unavailable for all TTS endpoints
        app.get('/api/tts/voices', (req, res) => {
            res.status(503).json({
                error: 'TTS service not configured',
                message: 'Kokoro TTS worker is not available or properly configured.',
                fallback: 'Web Speech API may be available in browser'
            });
        });

        app.get('/api/tts', (req, res) => {
            res.status(503).json({
                error: 'TTS service not configured',
                message: 'Kokoro TTS worker is not available or properly configured.',
                fallback: 'Please use Web Speech API or configure Kokoro TTS'
            });
        });

        app.post('/api/tts', (req, res) => {
            res.status(503).json({
                error: 'TTS service not configured',
                message: 'Kokoro TTS worker is not available or properly configured.',
                fallback: 'Please use Web Speech API or configure Kokoro TTS'
            });
        });

        return;
    }

    // Get voice list
    app.get('/api/tts/voices', async (req, res) => {
        try {
            const femaleVoices = [
                'af_sky',
                'af_bella',
                'af_sarah',
                'af_nicole',
                'af_alloy'
            ];

            const maleBanned = [
                'am_adam',
                'am_michael'
            ];

            // Generate all possible combinations (maximum 2 voices)
            const voiceCombinations = [];

            // Add individual voices
            femaleVoices.forEach(voice => {
                voiceCombinations.push({
                    value: voice,
                    name: voice.replace('af_', '').replace(/^\w/, c => c.toUpperCase()),
                    type: 'single',
                    voices: [voice]
                });
            });

            // Add dual combinations
            for (let i = 0; i < femaleVoices.length; i++) {
                for (let j = i + 1; j < femaleVoices.length; j++) {
                    const combination = `${femaleVoices[i]}+${femaleVoices[j]}`;
                    const name1 = femaleVoices[i].replace('af_', '').replace(/^\w/, c => c.toUpperCase());
                    const name2 = femaleVoices[j].replace('af_', '').replace(/^\w/, c => c.toUpperCase());

                    voiceCombinations.push({
                        value: combination,
                        name: `${name1} + ${name2}`,
                        type: 'combination',
                        voices: [femaleVoices[i], femaleVoices[j]]
                    });
                }
            }

            res.json({
                voices: voiceCombinations,
                femaleOnly: femaleVoices,
                bannedMaleVoices: maleBanned,
                defaultVoice: config.KOKORO_DEFAULT_VOICE,
                description: 'Available Kokoro TTS female voices. BambiSleep enforces female-only voices. Use + to combine up to 2 voices.',
                maxCombination: 2,
                language: 'en',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error(`🎤 Voice listing error: ${error.message}`);
            res.status(500).json({
                error: 'Error fetching voice list',
                details: process.env.NODE_ENV === 'production' ? null : error.message
            });
        }
    });

    // Generate speech (GET method for compatibility)
    app.get('/api/tts', async (req, res) => {
        const text = req.query.text;
        const voice = req.query.voice || config.KOKORO_DEFAULT_VOICE;

        if (typeof text !== 'string' || text.trim() === '') {
            return res.status(400).json({ error: 'Invalid input: text must be a non-empty string' });
        }

        try {
            await generateTTSAudio(text, voice, res);
        } catch (error) {
            handleTTSError(error, res);
        }
    });

    // Generate speech (POST method)
    app.post('/api/tts', async (req, res) => {
        const { text, voice, format } = req.body;
        const selectedVoice = voice || config.KOKORO_DEFAULT_VOICE;

        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Invalid text input' });
        }

        try {
            await generateTTSAudio(text, selectedVoice, res, format);
        } catch (error) {
            handleTTSError(error, res);
        }
    });

    console.log('🎤 TTS routes configured with Kokoro integration');
}

// Clean text for TTS processing - mirrors client-side cleanTextForTTS
function cleanTextForTTS(text) {
    // Remove URLs
    text = text.replace(/https?:\/\/[^\s]+/g, 'link');

    // Remove apostrophes from contractions and possessives (you'll -> youll, bambi's -> bambis)
    text = text.replace(/'/g, '');

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

    // Convert to lowercase for TTS (display stays uppercase, but speech is lowercase)
    return text.toLowerCase();
}

// Generate TTS audio using Kokoro worker
async function generateTTSAudio(text, voice, res, format = 'mp3') {
    return new Promise((resolve, reject) => {
        // Generate a temporary socket ID for API requests
        const tempSocketId = `api_tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Clean and lowercase text for TTS (same cleaning as client-side cleanTextForTTS)
        const cleanedText = cleanTextForTTS(text);

        console.log(`🎤 API TTS request: "${text.substring(0, 50)}..." -> cleaned: "${cleanedText.substring(0, 50)}..." with voice: ${voice}`);

        // Send to Kokoro worker
        kokoroWorker.postMessage({
            type: 'tts',
            text: cleanedText, // Send cleaned lowercase text
            voice: voice,
            format: format,
            socketId: tempSocketId
        });

        // Set a timeout to respond
        const timeout = setTimeout(() => {
            reject(new Error('TTS generation timeout'));
        }, config.TTS_TIMEOUT);

        // Listen for worker response
        const originalHandler = handleKokoroWorkerMessage;
        handleKokoroWorkerMessage = (msg) => {
            if (msg.socketId === tempSocketId) {
                clearTimeout(timeout);

                if (msg.type === 'tts_success') {
                    // Convert base64 to buffer and send as audio
                    const audioBuffer = Buffer.from(msg.audioData, 'base64');

                    res.setHeader('Content-Type', 'audio/mpeg');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Content-Length', audioBuffer.length);

                    res.send(audioBuffer);
                    resolve();
                } else if (msg.type === 'error') {
                    reject(new Error(msg.error));
                }

                handleKokoroWorkerMessage = originalHandler;
            } else {
                originalHandler(msg);
            }
        };
    });
}

// Handle TTS errors
function handleTTSError(error, res) {
    console.error('🎤 TTS Error:', error.message);

    if (error.message.includes('timeout')) {
        res.status(504).json({
            error: 'TTS generation timeout',
            message: 'The text-to-speech generation took too long. Please try again with shorter text.'
        });
    } else {
        res.status(500).json({
            error: 'TTS generation failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// TTS Health check endpoint (enhanced)
app.get('/api/tts/health', async (req, res) => {
    if (!kokoroWorker) {
        return res.status(503).json({
            healthy: false,
            error: 'Kokoro TTS worker not available',
            timestamp: new Date().toISOString()
        });
    }

    // Request health check from worker
    kokoroWorker.postMessage({
        type: 'health'
    });

    // Determine correct Kokoro host based on NODE_ENV
    let kokoroHost;
    if (process.env.NODE_ENV === 'production') {
        kokoroHost = process.env.KOKORO_HOST_PRODUCTION || process.env.KOKORO_HOST_DEVELOPMENT || 'localhost';
    } else {
        kokoroHost = process.env.KOKORO_HOST_DEVELOPMENT || process.env.KOKORO_HOST_PRODUCTION || 'localhost';
    }
    const kokoroPort = process.env.KOKORO_PORT || 8880;

    res.json({
        healthy: true,
        service: 'Kokoro TTS',
        url: `http://${kokoroHost}:${kokoroPort}`,
        config: config.KOKORO_API_URL,
        defaultVoice: config.KOKORO_DEFAULT_VOICE,
        timeout: config.TTS_TIMEOUT,
        timestamp: new Date().toISOString()
    });
});

// TTS Voice management endpoint (enhanced)
app.post('/api/tts/voice', (req, res) => {
    const { voice } = req.body;

    if (!voice || typeof voice !== 'string') {
        return res.status(400).json({ error: 'Invalid voice parameter' });
    }

    // Validate that the voice is female only
    const femaleVoices = ['af_alloy', 'af_aoede', 'af_bella', 'af_heart', 'af_jadzia', 'af_jessica', 'af_kore', 'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky'];
    const voiceParts = voice.split('+');

    for (const voicePart of voiceParts) {
        if (!femaleVoices.includes(voicePart.trim())) {
            return res.status(400).json({
                error: 'Invalid voice selection - only female voices are allowed',
                allowedVoices: femaleVoices
            });
        }
    }

    if (voiceParts.length > 2) {
        return res.status(400).json({
            error: 'Voice combination limited to maximum 2 voices'
        });
    }

    if (!kokoroWorker) {
        return res.status(503).json({
            error: 'Kokoro TTS worker not available'
        });
    }

    kokoroWorker.postMessage({
        type: 'set_voice',
        voice: voice
    });

    res.json({
        success: true,
        voice: voice,
        timestamp: new Date().toISOString()
    });
});

// Basic API endpoint example
app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello from BambiSleep Chat backend!' });
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 6969;
server.listen(PORT, () => {
    console.log(`🚀 BambiSleep Chat server running on http://localhost:${PORT}`);
    console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
    console.log(`🎯 Environment: ${process.env.NODE_ENV || 'development'}`);
});
