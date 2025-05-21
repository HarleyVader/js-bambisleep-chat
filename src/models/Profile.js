import mongoose from 'mongoose';

const ProfileSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  xp: {
    type: Number,
    default: 0
  },
  preferences: {
    type: Object,
    default: {}
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate user level based on XP
ProfileSchema.virtual('level').get(function() {
  const requirements = [100, 250, 450, 700, 1200];
  let level = 0;
  
  while (level < requirements.length && this.xp >= requirements[level]) {
    level++;
  }
  
  return level;
});

// Add methods to check if user has access to specific features
ProfileSchema.methods.hasAccess = function(feature) {
  // Basic feature check based on level
  const featureLevels = {
    basicChat: 0,
    customTriggers: 1,
    voiceCommands: 2,
    sessionHistory: 1
  };
  
  const requiredLevel = featureLevels[feature] || 0;
  return this.level >= requiredLevel;
};

// Export both the schema and model to allow reuse in workers
const Profile = mongoose.models.Profile || mongoose.model('Profile', ProfileSchema);

// Add schema to the export for worker thread registration
Profile.schema = ProfileSchema;

export default Profile;
