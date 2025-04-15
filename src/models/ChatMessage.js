import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },
  data: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Create indexes for efficient querying
chatMessageSchema.index({ timestamp: -1 });
chatMessageSchema.index({ username: 1 });

// Static method to get recent messages
chatMessageSchema.statics.getRecentMessages = function(limit = 15) {
  return this.find({})
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

export default ChatMessage;