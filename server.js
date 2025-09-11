// server.js
// Express + Socket.io + TTS + Triggers chat server
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
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

// Socket.io connection handling
io.on('connection', (socket) => {
    connectedUsers++;
    console.log(`User connected. Total users: ${connectedUsers}`);
    
    // Send recent chat history to new user
    socket.emit('chat-history', chatHistory.slice(-20));
    
    // Broadcast user count
    io.emit('user-count', connectedUsers);

    socket.on('message', (data) => {
        const messageData = {
            id: Date.now(),
            message: data.message,
            timestamp: data.timestamp || new Date().toISOString(),
            user: socket.id
        };
        
        // Store message
        chatHistory.push(messageData);
        
        // Keep only last 100 messages
        if (chatHistory.length > 100) {
            chatHistory.shift();
        }
        
        // Broadcast to all clients
        socket.broadcast.emit('message', messageData);
        
        console.log(`Message from ${socket.id}: ${data.message}`);
    });

    socket.on('disconnect', () => {
        connectedUsers--;
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
        res.json({ success: true, triggers: triggerWords });
    } else {
        res.status(400).json({ error: 'Invalid triggers format' });
    }
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
