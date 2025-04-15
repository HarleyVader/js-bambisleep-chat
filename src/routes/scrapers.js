import express from 'express';
import Logger from '../utils/logger.js';
import footerConfig from '../config/footer.config.js';
import Scraper from '../models/Scraper.js';

const logger = new Logger('ScrapersRoutes');
const router = express.Router();

// Define the base path for this router
export const basePath = '/scrapers';

// Main scrapers page
router.get('/', async (req, res) => {
  try {
    // Get cookie data
    const bambiname = req.cookies?.bambiname ? decodeURIComponent(req.cookies.bambiname) : 'Anonymous Bambi';
    
    // Fetch submissions
    const textSubmissions = await Scraper.find({ type: 'text' })
      .sort({ submittedAt: -1 })
      .limit(10);
      
    const imageSubmissions = await Scraper.find({ type: 'image' })
      .sort({ submittedAt: -1 })
      .limit(10);
      
    const videoSubmissions = await Scraper.find({ type: 'video' })
      .sort({ submittedAt: -1 })
      .limit(10);
    
    // Get stats
    const stats = {
      successful: await Scraper.countDocuments({ status: 'completed' }),
      failed: await Scraper.countDocuments({ status: 'failed' }),
      blocked: 0, // Add logic if needed
      totalUpvotes: await calculateTotalVotes('upvotes'),
      totalDownvotes: await calculateTotalVotes('downvotes'),
      topUpvoted: await Scraper.find().sort({ upvotes: -1 }).limit(5),
      topDownvoted: await Scraper.find().sort({ downvotes: -1 }).limit(5)
    };
    
    res.render('scrapers', {
      title: 'Content Scrapers',
      bambiname,
      textSubmissions,
      imageSubmissions,
      videoSubmissions,
      stats,
      validConstantsCount: 5,
      footer: footerConfig
    });
  } catch (error) {
    logger.error(`Error loading scrapers page: ${error.message}`);
    res.status(500).render('error', {
      message: 'Error loading scrapers page',
      error: req.app.get('env') === 'development' ? error : {},
      validConstantsCount: 5,
      title: 'Error'
    });
  }
});

// API routes
router.post('/api/scraper/submit', async (req, res) => {
  try {
    const { url, type, bambiname } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL is required' });
    }
    
    // Create scraper job
    const newSubmission = new Scraper({
      url,
      type,
      bambiname: bambiname || 'Anonymous Bambi',
      status: 'pending'
    });
    
    await newSubmission.save();
    
    // In a real app, you'd queue a background job here
    // For demo purposes, let's simulate completion after a delay
    setTimeout(async () => {
      newSubmission.status = 'completed';
      newSubmission.results = {
        [type]: {
          contentFound: Math.random() > 0.3, // Random success for demo
          content: `Sample ${type} content from ${url}`
        }
      };
      await newSubmission.save();
    }, 5000);
    
    res.json({ success: true, message: 'Submission created successfully' });
  } catch (error) {
    logger.error(`Error submitting URL: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Vote endpoint
router.post('/api/scraper/vote/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { vote } = req.body;
    
    const submission = await Scraper.findById(id);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    
    if (vote === 'upvote') {
      submission.upvotes += 1;
    } else if (vote === 'downvote') {
      submission.downvotes += 1;
    }
    
    await submission.save();
    
    // Check if needs to be deleted due to downvotes
    let deleted = false;
    if (submission.downvotes >= 10) {
      await Scraper.findByIdAndDelete(id);
      deleted = true;
    }
    
    res.json({
      success: true,
      upvotes: submission.upvotes,
      downvotes: submission.downvotes,
      deleted
    });
  } catch (error) {
    logger.error(`Error processing vote: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Comments endpoints
router.get('/api/scraper/comments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const submission = await Scraper.findById(id);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    
    res.json({ success: true, comments: submission.comments || [] });
  } catch (error) {
    logger.error(`Error fetching comments: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/api/scraper/comment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, bambiname } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }
    
    const submission = await Scraper.findById(id);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    
    const comment = {
      text,
      bambiname: bambiname || 'Anonymous Bambi',
      date: new Date()
    };
    
    submission.comments.push(comment);
    await submission.save();
    
    res.json({ success: true, comments: submission.comments });
  } catch (error) {
    logger.error(`Error adding comment: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Content viewing endpoint
router.get('/api/scraper/submission/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const submission = await Scraper.findById(id);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    
    res.json({ 
      success: true, 
      results: submission.results,
      debug: {
        status: submission.status,
        type: submission.type
      }
    });
  } catch (error) {
    logger.error(`Error fetching submission content: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Stats endpoint
router.get('/api/scraper/stats', async (req, res) => {
  try {
    const stats = {
      successful: await Scraper.countDocuments({ status: 'completed' }),
      failed: await Scraper.countDocuments({ status: 'failed' }),
      blocked: 0,
      totalUpvotes: await calculateTotalVotes('upvotes'),
      totalDownvotes: await calculateTotalVotes('downvotes'),
      topUpvoted: await Scraper.find().sort({ upvotes: -1 }).limit(5),
      topDownvoted: await Scraper.find().sort({ downvotes: -1 }).limit(5)
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    logger.error(`Error fetching stats: ${error.message}`);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Helper function to calculate total votes
async function calculateTotalVotes(field) {
  const result = await Scraper.aggregate([
    { $group: { _id: null, total: { $sum: `$${field}` } } }
  ]);
  return result.length > 0 ? result[0].total : 0;
}

// For server startup
export async function initializeScrapers() {
  try {
    logger.info('Initializing scrapers system...');
    // Any startup logic goes here
    return true;
  } catch (error) {
    logger.error(`Error initializing scrapers: ${error.message}`);
    return false;
  }
}

export default router;