import mongoose from 'mongoose';

const ScraperSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video'],
    required: true
  },
  bambiname: {
    type: String,
    default: 'Anonymous Bambi'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  upvotes: {
    type: Number,
    default: 0
  },
  downvotes: {
    type: Number,
    default: 0
  },
  comments: [{
    bambiname: String,
    text: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  results: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

const Scraper = mongoose.model('Scraper', ScraperSchema);

export default Scraper;