import mongoose from 'mongoose';
import withDbConnection from '../utils/dbTransaction.js';

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
chatMessageSchema.statics.getRecentMessages = async function(limit = 15) {
  return withDbConnection(async () => {
    return this.find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  });
};

// Add a new method to save messages with proper connection handling
chatMessageSchema.statics.saveMessage = async function(messageData) {
  return withDbConnection(async () => {
    const message = new this(messageData);
    return await message.save();
  });
};

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

export default ChatMessage;