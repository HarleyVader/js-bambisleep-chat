// utils/gracefulShutdown.js
const { patterns } = require('../models/bambisleepChalk');
const mongoose = require('mongoose');
const process = require('process');

function gracefulShutdown(server) {
  server.close(() => {
    console.log(patterns.server.warning('Server closed.'));
    mongoose.connection.close(false, () => {
      console.log(patterns.server.success('MongoDB connection closed.'));
      process.exit(0);
    });
  });

  // Handle termination signals
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM');
    gracefulShutdown(server);
  });
  process.on('SIGINT', () => {
    console.log('Received SIGINT');
    gracefulShutdown(server);
  });
}

module.exports = gracefulShutdown;