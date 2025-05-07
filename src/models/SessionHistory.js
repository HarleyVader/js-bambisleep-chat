import mongoose from 'mongoose';

// Simple schema definition
const sessionHistorySchema = new mongoose.Schema({
  username: { type: String, required: true, index: true },
  socketId: { type: String, required: true },
  title: { type: String, default: 'Untitled Session' },
  shareToken: String,
  messages: [{
    role: String,
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  metadata: {
    createdAt: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now },
    triggers: [String],
    collarActive: Boolean,
    collarText: String,
    spiralSettings: Object
  }
}, { timestamps: true });

// Create model once
let SessionHistory;

// Get model function
function getSessionHistoryModel() {
  if (mongoose.models.SessionHistory) {
    return mongoose.models.SessionHistory;
  }
  
  if (!SessionHistory) {
    SessionHistory = mongoose.model('SessionHistory', sessionHistorySchema);
  }
  
  return SessionHistory;
}

// Export both
export { getSessionHistoryModel };
export default mongoose.model('SessionHistory', sessionHistorySchema);