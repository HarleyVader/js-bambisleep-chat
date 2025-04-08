import mongoose from 'mongoose';

const socketStatsSchema = new mongoose.Schema({
  userId: String,
  messageType: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  content: String,
  metadata: Object
});

const serverStatsSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  metric: {
    type: String,
    required: true,
    enum: ['cpu', 'memory', 'connections', 'messages', 'errors', 'operations']
  },
  value: {
    type: Number,
    required: true
  },
  metadata: Object
});

const SocketStats = mongoose.model('SocketStats', socketStatsSchema);
const ServerStats = mongoose.model('ServerStats', serverStatsSchema);

export { SocketStats, ServerStats };