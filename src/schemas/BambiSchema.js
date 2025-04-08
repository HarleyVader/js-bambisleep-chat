const mongoose = require('mongoose');

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
    default: 'default-avatar.png'
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

const User = mongoose.model('User', userSchema);
const UserProfile = mongoose.model('UserProfile', userProfileSchema);

module.exports = { User, UserProfile };