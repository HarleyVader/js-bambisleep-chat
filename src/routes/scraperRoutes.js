import express from 'express';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const logger = new Logger('ScraperAPI');

// MongoDB Schema for scraper submissions
const SubmissionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'image', 'video'],
    required: true
  },
  url: {
    type: String,
    required: true
  },
  bambiname: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  results: {
    text: {
      contentFound: Boolean,
      content: String
    },
    image: {
      contentFound: Boolean,
      content: Array
    },
    video: {
      contentFound: Boolean,
      content: Array
    }
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
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

// Initialize models
let Submission;
try {
  Submission = mongoose.model('ScraperSubmission');
} catch (error) {
  Submission = mongoose.model('ScraperSubmission', SubmissionSchema);
}

// Workers map to manage worker instances
const workers = {
  text: null,
  image: null,
  video: null
};

// Initialize workers
function initializeWorker(type) {
  if (workers[type]) return workers[type];
  
  const workerPath = path.join(__dirname, '..', 'workers', 'scrapers', `${type}Scraping.js`);
  
  try {
    const worker = new Worker(workerPath);
    
    worker.on('error', (error) => {
      logger.error(`${type} worker error:`, error);
      workers[type] = null; // Reset for future reinitialization
    });
    
    worker.on('exit', (code) => {
      logger.info(`${type} worker exited with code ${code}`);
      workers[type] = null; // Reset for future reinitialization
    });
    
    logger.success(`${type} scraper worker initialized`);
    workers[type] = worker;
    return worker;
  } catch (error) {
    logger.error(`Failed to initialize ${type} scraper worker:`, error);
    return null;
  }
}

// Submit URL to scrape
router.post('/submit', async (req, res) => {
  try {
    const { url, type, bambiname } = req.body;
    
    if (!url || !type || !['text', 'image', 'video'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid request parameters' });
    }
    
    // Create a new submission
    const submission = new Submission({
      type,
      url,
      bambiname: bambiname || 'Anonymous Bambi',
      status: 'pending'
    });
    
    await submission.save();
    
    // Initialize and send message to worker
    const worker = initializeWorker(type);
    if (!worker) {
      submission.status = 'failed';
      await submission.save();
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to initialize scraper worker' 
      });
    }
    
    // Define message type based on scraper type
    let messageType;
    switch(type) {
      case 'text':
        messageType = 'scrape_url';
        break;
      case 'image':
        messageType = 'scrape_images';
        break;
      case 'video':
        messageType = 'scrape_videos';
        break;
    }
    
    // Set up promise to handle worker response
    const scrapePromise = new Promise((resolve, reject) => {
      const requestId = submission._id.toString();
      
      const responseHandler = (message) => {
        if (message.requestId === requestId) {
          worker.removeListener('message', responseHandler);
          
          if (message.type === 'error') {
            reject(new Error(message.data));
          } else if (message.type === 'scrape_result') {
            resolve(message.data);
          }
        }
      };
      
      worker.on('message', responseHandler);
      
      // Send request to worker
      worker.postMessage({
        type: messageType,
        url: url,
        requestId: requestId
      });
      
      // Set timeout to avoid hanging requests
      setTimeout(() => {
        worker.removeListener('message', responseHandler);
        reject(new Error('Scraping request timed out'));
      }, 60000); // 60 seconds timeout
    });
    
    // Handle worker response
    try {
      const result = await scrapePromise;
      
      // Update submission with results
      submission.status = result.success ? 'completed' : 'failed';
      submission.results = {
        [type]: {
          contentFound: result.contentFound || false,
          content: result.content || []
        }
      };
      await submission.save();
      
      res.json({ 
        success: true, 
        message: 'Scraping task submitted successfully', 
        submissionId: submission._id 
      });
    } catch (error) {
      logger.error('Error during scraping task:', error);
      submission.status = 'failed';
      await submission.save();
      
      res.status(500).json({ 
        success: false, 
        message: `Error during scraping task: ${error.message}` 
      });
    }
  } catch (error) {
    logger.error('Error in submit route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get all submissions by type
router.get('/submissions/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!['text', 'image', 'video'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid submission type' });
    }
    
    const submissions = await Submission.find({ type })
      .sort({ submittedAt: -1 })
      .limit(50);
    
    res.json({ success: true, submissions });
  } catch (error) {
    logger.error('Error fetching submissions:', error);
    res.status(500).json({ success: false, message: 'Error fetching submissions' });
  }
});

// Get specific submission
router.get('/submission/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const submission = await Submission.findById(id);
    
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    
    res.json({ success: true, results: submission.results });
  } catch (error) {
    logger.error('Error fetching submission:', error);
    res.status(500).json({ success: false, message: 'Error fetching submission' });
  }
});

// Vote on submission
router.post('/vote/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { vote } = req.body;
    
    if (!['upvote', 'downvote'].includes(vote)) {
      return res.status(400).json({ success: false, message: 'Invalid vote type' });
    }
    
    const submission = await Submission.findById(id);
    
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    
    if (vote === 'upvote') {
      submission.upvotes += 1;
    } else {
      submission.downvotes += 1;
    }
    
    await submission.save();
    
    res.json({ 
      success: true, 
      upvotes: submission.upvotes, 
      downvotes: submission.downvotes 
    });
  } catch (error) {
    logger.error('Error processing vote:', error);
    res.status(500).json({ success: false, message: 'Error processing vote' });
  }
});

// Add comment to submission
router.post('/comment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { bambiname, text } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }
    
    const submission = await Submission.findById(id);
    
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    
    submission.comments.push({
      bambiname: bambiname || 'Anonymous Bambi',
      text,
      date: new Date()
    });
    
    await submission.save();
    
    res.json({ 
      success: true, 
      comments: submission.comments 
    });
  } catch (error) {
    logger.error('Error adding comment:', error);
    res.status(500).json({ success: false, message: 'Error adding comment' });
  }
});

// Get comments for submission
router.get('/comments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const submission = await Submission.findById(id);
    
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    
    res.json({ 
      success: true, 
      comments: submission.comments 
    });
  } catch (error) {
    logger.error('Error fetching comments:', error);
    res.status(500).json({ success: false, message: 'Error fetching comments' });
  }
});

export default router;