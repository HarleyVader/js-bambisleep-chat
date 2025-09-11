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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage (replace with database in production)
let chatHistory = [];
let triggerWords = []; // Will be loaded from official triggers.json
let triggerData = {}; // Full trigger data for API endpoints
let connectedUsers = 0;

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

// LM Studio Worker Management
let lmWorker = null;
let workerUsers = new Map(); // Track which users are using AI
let collarActive = false;
let collarText = '';

// Initialize LM Studio Worker
function initializeLMWorker() {
    try {
        lmWorker = new Worker(path.join(__dirname, 'workers', 'lmstudio.js'));

        lmWorker.on('message', (msg) => {
            handleWorkerMessage(msg);
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

// Handle messages from LM Studio worker
function handleWorkerMessage(msg) {
    switch (msg.type) {
        case 'response':
            // Send AI response to specific socket
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

// Initialize worker on startup
initializeLMWorker();

// Socket.io connection handling
io.on('connection', (socket) => {
    connectedUsers++;
    console.log(`User connected. Total users: ${connectedUsers}`);

    // Send recent chat history to new user
    socket.emit('chat-history', chatHistory.slice(-20));

    // Broadcast user count
    io.emit('user-count', connectedUsers);

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
        console.log(`User disconnected. Total users: ${connectedUsers}`);
        io.emit('user-count', connectedUsers);
    });
});

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        users: connectedUsers
    });
});

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
        username: username || 'Anonymous'
    });

    // Set a timeout to respond
    const timeout = setTimeout(() => {
        res.status(504).json({ error: 'AI response timeout' });
    }, 30000);

    // Listen for worker response (simplified for API)
    const originalHandler = handleWorkerMessage;
    handleWorkerMessage = (msg) => {
        if (msg.type === 'response' && msg.socketId === tempSocketId) {
            clearTimeout(timeout);
            res.json({
                response: msg.response,
                wordCount: msg.wordCount || 0,
                timestamp: new Date().toISOString()
            });
            handleWorkerMessage = originalHandler;
        } else {
            originalHandler(msg);
        }
    };
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

// Text-to-Speech endpoint (placeholder)
app.post('/api/tts', (req, res) => {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Invalid text input' });
    }

    // For now, return error to force client to use Web Speech API
    // In production, this would integrate with TTS service
    res.status(503).json({
        error: 'Server TTS not implemented',
        message: 'Use browser TTS instead'
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
