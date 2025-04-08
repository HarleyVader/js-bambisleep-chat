import mongoose from 'mongoose';

const BambiSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [20, 'Username cannot exceed 20 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: [50, 'Display name cannot exceed 50 characters'],
    default: ''
  },
  profilePicture: {
    type: String,
    default: '/images/in-her-bubble.gif'
  },
  profileImageData: {
    type: String, // Stores Base64 encoded image data
  },
  profileImageType: {
    type: String, // Stores MIME type
  },
  profileImageName: String,
  profileImageId: String,
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
    default: 1
  },
  experience: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: [500, 'Description cannot exceed 500 characters']
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
  hearts: {
    count: {
      type: Number,
      default: 0
    },
    users: [{
      username: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },
  activities: [{
    type: {
      type: String,
      enum: ['file', 'level', 'badge', 'heart', 'other'],
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

// Virtual for profile picture URL
BambiSchema.virtual('profilePictureUrl').get(function() {
  if (this.profileImageData && this.profileImageType) {
    return `/bambis/api/profile/${this.username}/picture`;
  }
  return '/images/default-profile.png';
});

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
  
  // Keep only the last 20 activities
  if (this.activities.length > 20) {
    this.activities = this.activities.slice(0, 20);
  }
  
  this.lastActive = Date.now();
  await this.save();
  return this.activities[0];
};

const Bambi = mongoose.model('Bambi', BambiSchema);

export default Bambi;