import mongoose from 'mongoose';

// Enhanced schema definition
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
    spiralSettings: Object,
    recovered: { type: Boolean, default: false },
    lastActiveIP: String
  }
}, { timestamps: true });

// Add index for better query performance
sessionHistorySchema.index({ 'metadata.lastActivity': -1 });

// Method to mark session as recovered
sessionHistorySchema.methods.markAsRecovered = async function() {
  this.metadata.recovered = true;
  return this.save();
};

// Static method to find inactive sessions
sessionHistorySchema.statics.findInactiveSessions = async function(thresholdMinutes = 30) {
  const thresholdTime = new Date(Date.now() - (thresholdMinutes * 60 * 1000));
  return this.find({
    'metadata.lastActivity': { $lt: thresholdTime },
    'metadata.recovered': { $ne: true }
  }).sort({ 'metadata.lastActivity': -1 });
};

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