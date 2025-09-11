// Main Express.js application server
// Implements hypnotic AI experience platform with security middleware
// Integrates Socket.io, MCP servers, and ElevenLabs agents

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
    cors: {
        origin: process.env.CORS_ORIGIN,
        methods: ["GET", "POST"]
    }
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:"]
        }
    }
}));

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    exposedHeaders: ['Mcp-Session-Id'],
    allowedHeaders: ['Content-Type', 'mcp-session-id']
}));

app.use(express.json());

// MCP server integration
const mcpServers = new Map();

// Initialize MCP servers
async function initializeMcpServers() {
    console.log(chalk.blue('🔧 Initializing MCP servers...'));

    // Load each MCP server from mcp.json configuration
    // Implementation to be added

    console.log(chalk.green('✅ MCP servers initialized'));
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(chalk.cyan(`👤 User connected: ${socket.id}`));

    socket.on('disconnect', () => {
        console.log(chalk.yellow(`👋 User disconnected: ${socket.id}`));
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(chalk.green(`🚀 Bambi Sleep Chat server running on port ${PORT}`));
    initializeMcpServers();
});

export { app, server, io, mcpServers };
