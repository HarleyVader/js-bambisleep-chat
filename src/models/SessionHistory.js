import mongoose from 'mongoose';

// Simple schema definition
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
  title: {
    type: String,
    default: 'Untitled Session'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  shareToken: {
    type: String,
    sparse: true,
    unique: true
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
    collarText: String,
    modelName: String,
    spiralSettings: {
      enabled: Boolean,
      spiral1Width: Number,
      spiral2Width: Number,
      spiral1Speed: Number,
      spiral2Speed: Number
    }
  },
  stats: {
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    }
  }
}, { 
  timestamps: true 
});

// Simple indexes
sessionHistorySchema.index({ username: 1, 'metadata.lastActivity': -1 });
sessionHistorySchema.index({ isPublic: 1, 'stats.likes': -1 });

// Create model or get existing
export function getSessionHistoryModel() {
  // Return existing model if already registered
  if (mongoose.models.SessionHistory) {
    return mongoose.models.SessionHistory;
  }
  
  // Create and return new model
  return mongoose.model('SessionHistory', sessionHistorySchema);
}

// Default export
export default mongoose.model('SessionHistory', sessionHistorySchema);