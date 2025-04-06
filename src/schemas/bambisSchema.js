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
  experience: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
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
  }]
}, { timestamps: true });

// Create a text index for search functionality
BambiSchema.index({ username: 'text', displayName: 'text', description: 'text' });

// Add this method to the schema
BambiSchema.methods.addExperience = async function(amount) {
  this.experience += amount;
  
  // Calculate level based on experience 
  // (simple formula: each level requires level*100 XP)
  const newLevel = Math.floor(this.experience / 100);
  
  const leveledUp = newLevel > this.level;
  this.level = newLevel;
  this.lastActivity = Date.now();
  
  await this.save();
  return { leveledUp, newLevel, experience: this.experience };
};

export default mongoose.model('Bambi', BambiSchema);