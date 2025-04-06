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
  }
}, { timestamps: true });

// Create a text index for search functionality
BambiSchema.index({ username: 'text', displayName: 'text', description: 'text' });

export default mongoose.model('Bambi', BambiSchema);