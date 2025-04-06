import mongoose from 'mongoose';

const BadgeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  criteria: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['achievement', 'participation', 'contribution', 'special'],
    default: 'achievement'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Badge', BadgeSchema);