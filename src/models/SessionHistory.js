import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['system', 'user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const SessionHistorySchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true,
    index: true
  },
  messages: [messageSchema],
  metadata: {
    type: Object,
    default: {}
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  },
  triggers: {
    type: Array,
    default: []
  }
});

// Update the lastUpdatedAt timestamp when session is modified
SessionHistorySchema.pre('save', function(next) {
  this.lastUpdatedAt = new Date();
  next();
});

// Method to add a message to the session history
SessionHistorySchema.methods.addMessage = function(role, content) {
  this.messages.push({ role, content });
  this.lastUpdatedAt = new Date();
  return this;
};

// Export both the schema and model to allow reuse in workers
const SessionHistory = mongoose.models.SessionHistory || mongoose.model('SessionHistory', SessionHistorySchema);

// Add schema to the export for worker thread registration
SessionHistory.schema = SessionHistorySchema;

export default SessionHistory;
