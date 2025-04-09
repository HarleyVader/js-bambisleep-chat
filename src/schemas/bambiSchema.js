import mongoose from 'mongoose';

const bambiSchema= new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    trim: true
  },
  about: {
    type: String,
    default: 'Click edit to add your about information'
  },
  description: {
    type: String,
    default: 'Click edit to add your description'
  },
  profilePictureUrl: {
    type: String,
    default: 'https://via.placeholder.com/150'
  },
  headerImageUrl: {
    type: String,
    default: 'https://via.placeholder.com/1000x250'
  },
  level: {
    type: Number,
    default: 1
  },
  hearts: {
    count: {
      type: Number,
      default: 0
    },
    users: [String] // Store usernames who liked this profile
  },
  followers: [String], // Store usernames of followers
  lastActive: {
    type: Date,
    default: Date.now
  }
});

export const Bambi = mongoose.model('Bmabi', bambiSchema);
export default bambiSchema;