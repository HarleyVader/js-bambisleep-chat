import mongoose from 'mongoose';

const BambiSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters']
  },
  displayName: {
    type: String,
    trim: true,
    default: ''
  },
  profilePicture: {
    type: String,
    default: '/images/default-profile.png'
  },
  triggers: {
    type: [String],
    default: []
  },
  favoriteFiles: {
    type: [String],
    default: []
  },
  level: {
    type: Number,
    default: 0
  },
  experience: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    default: '',
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  profileTheme: {
    primaryColor: {
      type: String,
      default: '#fa81ff'
    },
    secondaryColor: {
      type: String,
      default: '#ff4fa2'
    },
    textColor: {
      type: String,
      default: '#ffffff'
    },
    customHeaderImage: {
      type: String,
      default: ''
    }
  },
  badges: [{
    badge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Badge'
    },
    awardedAt: {
      type: Date,
      default: Date.now
    }
  }],
  following: [{
    type: String,  // username of followed bambi
    since: {
      type: Date,
      default: Date.now
    }
  }],
  followers: [{
    type: String,  // username of follower
    since: {
      type: Date,
      default: Date.now
    }
  }],
  activities: [{
    type: {
      type: String,
      enum: ['file', 'level', 'badge', 'login', 'follow'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }]
}, { timestamps: true });

// Create a text index for search functionality
BambiSchema.index({ username: 'text', displayName: 'text', description: 'text' });

// Method to add experience and handle level ups
BambiSchema.methods.addExperience = async function(amount) {
  this.experience += amount;
  
  // Calculate level based on experience 
  // (simple formula: each level requires level*100 XP)
  const newLevel = Math.floor(this.experience / 100);
  
  const leveledUp = newLevel > this.level;
  this.level = newLevel;
  this.lastActive = Date.now();
  
  // Record level up activity if needed
  if (leveledUp) {
    this.activities.unshift({
      type: 'level',
      description: `Reached level ${newLevel}!`,
      timestamp: Date.now()
    });
  }
  
  await this.save();
  return { leveledUp, newLevel, experience: this.experience };
};

// Method to add activity
BambiSchema.methods.addActivity = async function(type, description, metadata = {}) {
  this.activities.unshift({
    type,
    description,
    timestamp: Date.now(),
    metadata
  });
  
  // Keep only the last 50 activities
  if (this.activities.length > 50) {
    this.activities = this.activities.slice(0, 50);
  }
  
  this.lastActive = Date.now();
  await this.save();
  return this.activities[0];
};

export default mongoose.model('Bambi', BambiSchema);