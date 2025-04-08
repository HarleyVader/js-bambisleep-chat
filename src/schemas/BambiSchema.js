import mongoose from 'mongoose';

// Bambi Schema
const bambiSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    default: 'Just a sleepy Bambi in the forest...',
    maxlength: 500
  },
  profilePicture: {
    buffer: Buffer,
    contentType: String
  },
  level: {
    type: Number,
    default: 1
  },
  experience: {
    type: Number,
    default: 0
  },
  woodland: {
    type: String,
    default: 'Sleepy Meadow'
  },
  favoriteSeasons: {
    type: [String],
    enum: ['spring', 'summer', 'autumn', 'winter'],
    default: ['spring']
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
    }
  },
  triggers: [String],
  activities: [{
    type: {
      type: String,
      enum: ['achievement', 'heart', 'follow', 'level', 'other'],
      default: 'other'
    },
    description: String,
    timestamp: {
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
  followers: [{
    type: String,
    ref: 'Bambi'
  }],
  following: [{
    type: String,
    ref: 'Bambi'
  }],
  lastActive: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Helper methods
bambiSchema.methods.addActivity = async function(type, description) {
  this.activities = this.activities || [];
  
  // Keep max 10 activities
  if (this.activities.length >= 10) {
    this.activities.pop(); // Remove oldest
  }
  
  // Add new activity at the beginning
  this.activities.unshift({
    type,
    description,
    timestamp: Date.now()
  });
  
  return this.save();
};

bambiSchema.methods.addExperience = async function(amount) {
  this.experience = (this.experience || 0) + amount;
  
  // Level up logic
  const newLevel = Math.floor(this.experience / 100) + 1;
  if (newLevel > this.level) {
    this.level = newLevel;
    await this.addActivity('level', `Reached level ${newLevel}!`);
  }
  
  return this.save();
};

// User Schema (for authentication)
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
});

// User Profile Schema (for profile data)
const userProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  avatar: {
    type: String,
    default: 'default-avatar.gif'
  },
  woodland: {
    type: String,
    default: 'Sleepy Meadow'
  },
  bio: {
    type: String,
    default: 'Just a sleepy Bambi in the forest...',
    maxlength: 500
  },
  favoriteSeasons: {
    type: [String],
    enum: ['spring', 'summer', 'autumn', 'winter'],
    default: ['spring']
  },
  friends: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: []
  },
  notifications: [{
    type: {
      type: String,
      enum: ['friend_request', 'profile_update', 'message'],
      required: true
    },
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    read: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to update the updatedAt field
userProfileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create the models
export const Bambi = mongoose.model('Bambi', bambiSchema);
export const User = mongoose.model('User', userSchema);
export const UserProfile = mongoose.model('UserProfile', userProfileSchema);