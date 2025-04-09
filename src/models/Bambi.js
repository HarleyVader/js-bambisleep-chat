import mongoose from 'mongoose';

const BambiSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  displayName: String,
  about: String,
  description: String,
  profilePictureUrl: String,
  headerImageUrl: String,
  lastActive: Date,
  lastViewed: Date,
  triggers: Array,
  level: {
    type: Number,
    default: 1
  },
  hearts: {
    users: [String],
    count: {
      type: Number,
      default: 0
    }
  },
  favoriteSeasons: [String]
});

export const Bambi = mongoose.model('Bambi', BambiSchema);
export { BambiSchema };