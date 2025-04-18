import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 500
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

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
    modelName: String
  },
  stats: {
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    dislikes: {
      type: Number,
      default: 0
    },
    likedBy: [String],
    dislikedBy: [String]
  },
  comments: [commentSchema]
}, { 
  timestamps: true 
});

// Index for faster queries
sessionHistorySchema.index({ username: 1, 'metadata.lastActivity': -1 });
sessionHistorySchema.index({ isPublic: 1, 'stats.likes': -1 });
sessionHistorySchema.index({ shareToken: 1 });

// TTL index to expire old sessions
sessionHistorySchema.index({ 'metadata.lastActivity': 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Method to generate a share token
sessionHistorySchema.methods.generateShareToken = function() {
  if (!this.shareToken) {
    const randomBytes = require('crypto').randomBytes(16);
    this.shareToken = randomBytes.toString('hex');
  }
  return this.shareToken;
};

// Method to toggle session visibility
sessionHistorySchema.methods.toggleVisibility = async function() {
  this.isPublic = !this.isPublic;
  return this.save();
};

// Method to handle likes/dislikes
sessionHistorySchema.methods.handleReaction = async function(username, action) {
  if (!username) return false;
  
  if (action === 'like') {
    // Remove from dislikedBy if present
    if (this.stats.dislikedBy.includes(username)) {
      this.stats.dislikedBy = this.stats.dislikedBy.filter(u => u !== username);
      this.stats.dislikes = Math.max(0, this.stats.dislikes - 1);
    }
    
    // Add to likedBy if not already there
    if (!this.stats.likedBy.includes(username)) {
      this.stats.likedBy.push(username);
      this.stats.likes += 1;
    }
  } else if (action === 'dislike') {
    // Remove from likedBy if present
    if (this.stats.likedBy.includes(username)) {
      this.stats.likedBy = this.stats.likedBy.filter(u => u !== username);
      this.stats.likes = Math.max(0, this.stats.likes - 1);
    }
    
    // Add to dislikedBy if not already there
    if (!this.stats.dislikedBy.includes(username)) {
      this.stats.dislikedBy.push(username);
      this.stats.dislikes += 1;
    }
  }
  
  return this.save();
};

// Method to add a comment
sessionHistorySchema.methods.addComment = async function(username, content) {
  if (!username || !content) return false;
  
  this.comments.push({
    username,
    content,
    createdAt: new Date()
  });
  
  return this.save();
};

const SessionHistory = mongoose.model('SessionHistory', sessionHistorySchema);

export default SessionHistory;