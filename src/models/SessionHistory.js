import mongoose from 'mongoose';

const sessionHistorySchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true,
    index: true 
  },
  socketId: { 
    type: String,
    required: true
  },
  messages: [{
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
  }],
  metadata: {
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    triggers: [String],
    collarActive: Boolean,
    collarText: String
  }
}, { 
  timestamps: true 
});

// Index for faster queries on username and lastActivity
sessionHistorySchema.index({ username: 1, 'metadata.lastActivity': -1 });

// Create TTL index to automatically expire old sessions after 30 days
sessionHistorySchema.index({ 'metadata.lastActivity': 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const SessionHistory = mongoose.model('SessionHistory', sessionHistorySchema);

export default SessionHistory;