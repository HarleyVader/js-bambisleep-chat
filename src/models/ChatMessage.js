import mongoose from 'mongoose';
import { withDbConnection } from '../config/db.js';

const chatMessageSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    default: 'anonymous'
  },
  data: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Use the transaction pattern for database operations
chatMessageSchema.statics.getRecentMessages = async function(limit = 50) {
  return withDbConnection(async () => {
    return this.find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  });
};

chatMessageSchema.statics.saveMessage = async function(messageData) {
  return withDbConnection(async () => {
    const message = new this(messageData);
    return await message.save();
  });
};

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

export default ChatMessage;