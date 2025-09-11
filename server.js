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
let triggerWords = ['bambi', 'bimbo', 'good girl', 'pink', 'spiral', 'obey', 'submit', 'empty', 'blank', 'mindless', 'doll', 'pretty', 'cute', 'sleep'];
let connectedUsers = 0;

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
        
        // Send initial triggers to worker
        lmWorker.postMessage({
            type: 'triggers',
            triggers: triggerWords
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
                
                // Also add to chat history
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
                
                // Broadcast to all clients
                io.emit('message', messageData);
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
        console.log(`AI chat request from ${username}: ${data.message}`);

        // Track this user as using AI
        workerUsers.set(socket.id, username);

        // Send message to worker
        lmWorker.postMessage({
            type: 'chat',
            prompt: data.message,
            socketId: socket.id,
            username: username
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

// Trigger words management
app.get('/api/triggers', (req, res) => {
    res.json({ triggers: triggerWords });
});

app.post('/api/triggers', (req, res) => {
    const { triggers } = req.body;
    if (Array.isArray(triggers)) {
        triggerWords = triggers.filter(word => typeof word === 'string' && word.trim());
        
        // Update worker with new triggers
        if (lmWorker) {
            lmWorker.postMessage({
                type: 'triggers',
                triggers: triggerWords
            });
        }
        
        res.json({ success: true, triggers: triggerWords });
    } else {
        res.status(400).json({ error: 'Invalid triggers format' });
    }
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
