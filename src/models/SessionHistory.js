import mongoose from 'mongoose';

// Enhanced schema definition with additional fields and indexes
const sessionHistorySchema = new mongoose.Schema({
  username: { type: String, required: true, index: true },
  socketId: { type: String, required: true },
  title: { type: String, default: 'Untitled Session' },
  shareToken: { type: String, unique: true, sparse: true },
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
  },
  activeTriggers: [String],
  collarSettings: {
    enabled: Boolean,
    text: String
  },
  spiralSettings: {
    enabled: Boolean,
    spiral1Width: Number,
    spiral2Width: Number,
    spiral1Speed: Number,
    spiral2Speed: Number
  }
}, { timestamps: true });

// Add index for efficient filtering
sessionHistorySchema.index({ 'metadata.createdAt': -1 });
sessionHistorySchema.index({ shareToken: 1 });
sessionHistorySchema.index({ title: 'text' }); // Text index for title search

// Add instance methods for session data
sessionHistorySchema.methods = {
  // Update last activity timestamp
  updateActivity() {
    this.metadata.lastActivity = new Date();
    return this.save();
  },
  
  // Generate a share token if one doesn't exist
  async generateShareToken() {
    if (!this.shareToken) {
      try {
        const crypto = require('crypto');
        
        // Generate 24 bytes of random data (more secure than Math.random)
        const buffer = crypto.randomBytes(24);
        
        // Convert to URL-safe base64 string
        const token = buffer.toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        
        // Add user-specific salt to prevent token prediction
        const salt = this.username.substring(0, 4) + this._id.toString().substring(0, 4);
        const hash = crypto.createHash('sha256')
          .update(salt + Date.now())
          .digest('hex')
          .substring(0, 8);
        
        // Use first 14 chars of random base64 plus 8 chars of hash
        this.shareToken = token.substring(0, 14) + hash;
        await this.save();
      } catch (e) {
        console.error('Error generating secure token:', e);
        // Fallback to a simpler but less secure method
        this.shareToken = Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
        await this.save();
      }
    }
    return this.shareToken;
  },
  
  // Add a message to the session
  addMessage(role, content) {
    this.messages.push({ role, content, timestamp: new Date() });
    this.metadata.lastActivity = new Date();
    return this;
  },
  
  // Update session settings
  updateSettings(settings) {
    // Update trigger settings
    if (settings.activeTriggers) {
      this.activeTriggers = settings.activeTriggers;
      this.metadata.triggers = settings.activeTriggers;
    }
    
    // Update collar settings
    if (settings.collarSettings) {
      this.collarSettings = settings.collarSettings;
      this.metadata.collarActive = settings.collarSettings.enabled;
      this.metadata.collarText = settings.collarSettings.text;
    }
    
    // Update spiral settings
    if (settings.spiralSettings) {
      this.spiralSettings = settings.spiralSettings;
      this.metadata.spiralSettings = settings.spiralSettings;
    }
    
    // Update title if provided
    if (settings.title) {
      this.title = settings.title;
    }
    
    this.metadata.lastActivity = new Date();
    return this.save();
  },
  
  // Remove a message by its index
  removeMessage(index) {
    if (index >= 0 && index < this.messages.length) {
      this.messages.splice(index, 1);
      this.metadata.lastActivity = new Date();
      return this.save();
    }
    return Promise.resolve(this);
  }
};

// Add static methods for common queries
sessionHistorySchema.statics = {
  // Find sessions by username
  findByUsername(username, options = {}) {
    const { limit = 20, skip = 0, sort = { 'metadata.createdAt': -1 } } = options;
    
    return this.find({ username })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .exec();
  },
  
  // Find session by share token
  findByShareToken(token) {
    return this.findOne({ shareToken: token }).exec();
  },
  
  // Get recent sessions
  findRecentSessions(username, limit = 5) {
    return this.find({ username })
      .sort({ 'metadata.lastActivity': -1 })
      .limit(limit)
      .exec();
  },
  
  // Search sessions by title text
  searchSessions(username, query, limit = 10) {
    return this.find(
      { username, $text: { $search: query } },
      { score: { $meta: "textScore" } }
    )
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .exec();
  },
  
  // Delete a session by ID
  deleteSession(id) {
    return this.findByIdAndDelete(id).exec();
  },
  
  // Delete sessions by username
  deleteUserSessions(username) {
    return this.deleteMany({ username }).exec();
  },
  
  // Create new session with defaults
  createSession(data) {
    return this.create({
      username: data.username,
      socketId: data.socketId,
      title: data.title || `Session ${new Date().toLocaleString()}`,
      messages: data.messages || [],
      metadata: {
        createdAt: new Date(),
        lastActivity: new Date(),
        triggers: data.triggers || [],
        collarActive: data.collarActive || false,
        collarText: data.collarText || '',
        spiralSettings: data.spiralSettings || {}
      },
      activeTriggers: data.activeTriggers || data.triggers || [],
      collarSettings: {
        enabled: data.collarActive || false,
        text: data.collarText || ''
      },
      spiralSettings: data.spiralSettings || {
        enabled: false,
        spiral1Width: 5,
        spiral2Width: 3,
        spiral1Speed: 20,
        spiral2Speed: 15
      }
    });
  }
};

// Create model once
let SessionHistory;

// Get model function with enhanced error handling
function getSessionHistoryModel() {
  try {
    if (mongoose.models.SessionHistory) {
      return mongoose.models.SessionHistory;
    }
    
    if (!SessionHistory) {
      SessionHistory = mongoose.model('SessionHistory', sessionHistorySchema);
    }
    
    return SessionHistory;
  } catch (error) {
    console.error('Error getting SessionHistory model:', error);
    // Return a placeholder model that won't crash the app
    return {
      findByUsername: () => Promise.resolve([]),
      findByShareToken: () => Promise.resolve(null),
      findRecentSessions: () => Promise.resolve([]),
      searchSessions: () => Promise.resolve([]),
      deleteSession: () => Promise.resolve({}),
      deleteUserSessions: () => Promise.resolve({ deletedCount: 0 }),
      createSession: () => Promise.resolve({}),
      find: () => ({ sort: () => ({ limit: () => Promise.resolve([]) }) }),
      findOne: () => Promise.resolve(null),
      create: () => Promise.resolve({})
    };
  }
}

// Export both
export { getSessionHistoryModel };
export default mongoose.model('SessionHistory', sessionHistorySchema);