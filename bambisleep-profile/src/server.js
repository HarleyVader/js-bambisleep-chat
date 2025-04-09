require('dotenv').config();
const app = require('./app');
const http = require('http');
const socketIo = require('socket.io');
const socketHandlers = require('./socket/handlers');
const mongoose = require('mongoose');
const config = require('./config/db');
const logger = require('./utils/logger');

// Ensure MongoDB URI exists
if (!config.mongoURI) {
  logger.error('MongoDB URI is missing. Check your .env file or config/db.js');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(config.mongoURI)
  .then(() => {
    logger.success('MongoDB Connected');
  })
  .catch(err => {
    logger.error(`MongoDB Connection Error: ${err.message}`);
    process.exit(1);
  });

// Create HTTP server
const server = http.createServer(app);

// Set up Socket.io
const io = socketIo(server);
socketHandlers(io);

// Define port
const PORT = process.env.PORT || 3000;

// Start server
server.listen(PORT, () => {
  logger.success(`Server running on port ${PORT}`);
});