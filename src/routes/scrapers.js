import express from 'express';
import mongoose from 'mongoose';
import { patterns } from '../middleware/bambisleepChalk.js';
import Logger from '../utils/logger.js';
import workerCoordinator from '../workers/workerCoordinator.js';

const router = express.Router();
const logger = new Logger('ScrapersRoute');

// MongoDB Schema for scrape submissions
const SubmissionSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  bambiname: {
    type: String,
    required: true
  },
  scrapeType: {
    type: String,
    enum: ['text', 'image', 'video'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  results: Object,
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
    comment: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

// Create models from schemas
const SubmissionModel = mongoose.model('ScraperSubmission', SubmissionSchema);

// Auth middleware - Only allow access to users with bambiname cookie not set to anonBambi
const requireBambiAuth = (req, res, next) => {
  const cookies = req.headers.cookie?.split(';')
    .map(cookie => cookie.trim().split('='))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {}) || {};
    
  const bambiname = decodeURIComponent(cookies['bambiname'] || 'anonBambi').replace(/%20/g, ' ');
  
  if (bambiname === 'anonBambi') {
    return res.status(403).render('error', {
      message: 'You must set a bambi name to access the scrapers',
      error: { status: 403, stack: '' }
    });
  }
  
  req.bambiname = bambiname;
  next();
};

// Route to render the scrapers dashboard
router.get('/', requireBambiAuth, async (req, res) => {
  try {
    // Fetch submissions for each type
    const textSubmissions = await SubmissionModel.find({ scrapeType: 'text' }).sort({ submittedAt: -1 }).limit(50);
    const imageSubmissions = await SubmissionModel.find({ scrapeType: 'image' }).sort({ submittedAt: -1 }).limit(50);
    const videoSubmissions = await SubmissionModel.find({ scrapeType: 'video' }).sort({ submittedAt: -1 }).limit(50);
    
    res.render('scrapers', {
      bambiname: req.bambiname,
      textSubmissions,
      imageSubmissions,
      videoSubmissions
    });
  } catch (error) {
    logger.error('Error fetching submissions:', error);
    res.status(500).render('error', { 
      message: 'Failed to load scraper dashboard', 
      error: { status: 500, stack: process.env.NODE_ENV === 'development' ? error.stack : '' }
    });
  }
});

// Route to submit a URL for scraping
router.post('/submit', requireBambiAuth, async (req, res) => {
  try {
    const { url, scrapeType } = req.body;
    
    if (!url || !scrapeType) {
      return res.status(400).json({ error: 'URL and scrape type are required' });
    }
    
    if (!['text', 'image', 'video'].includes(scrapeType)) {
      return res.status(400).json({ error: 'Invalid scrape type' });
    }
    
    // Create a new submission
    const submission = new SubmissionModel({
      url,
      bambiname: req.bambiname,
      scrapeType,
      status: 'pending'
    });
    
    await submission.save();
    
    // Start the scraping process
    workerCoordinator.scrapeUrl(url, async (error, results) => {
      try {
        if (error) {
          submission.status = 'failed';
          submission.results = { error: error.message };
          logger.error(`Error scraping ${url}:`, error);
        } else {
          submission.status = 'completed';
          submission.results = results;
          logger.success(`Successfully scraped ${url}`);
        }
        
        await submission.save();
      } catch (saveError) {
        logger.error('Error saving scrape results:', saveError);
      }
    });
    
    res.json({ success: true, message: 'Scraping request submitted', submissionId: submission._id });
  } catch (error) {
    logger.error('Error submitting scraping request:', error);
    res.status(500).json({ error: 'Failed to submit scraping request' });
  }
});

// Route to vote on a submission
router.post('/vote/:id', requireBambiAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { voteType } = req.body;
    
    if (!['upvote', 'downvote'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote type' });
    }
    
    const submission = await SubmissionModel.findById(id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    if (voteType === 'upvote') {
      submission.upvotes += 1;
    } else {
      submission.downvotes += 1;
    }
    
    await submission.save();
    
    res.json({ success: true, upvotes: submission.upvotes, downvotes: submission.downvotes });
  } catch (error) {
    logger.error('Error voting on submission:', error);
    res.status(500).json({ error: 'Failed to register vote' });
  }
});

// Route to add a comment to a submission
router.post('/comment/:id', requireBambiAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    
    if (!comment) {
      return res.status(400).json({ error: 'Comment text is required' });
    }
    
    const submission = await SubmissionModel.findById(id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    submission.comments.push({
      bambiname: req.bambiname,
      comment
    });
    
    await submission.save();
    
    res.json({ success: true, comments: submission.comments });
  } catch (error) {
    logger.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Route to get submission details
router.get('/detail/:id', requireBambiAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const submission = await SubmissionModel.findById(id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    res.json(submission);
  } catch (error) {
    logger.error('Error fetching submission details:', error);
    res.status(500).json({ error: 'Failed to fetch submission details' });
  }
});

export default router;