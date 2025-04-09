import express from 'express';
import mongoose from 'mongoose';
import { Logger } from '../utils/logger.js';  // Use named import with curly braces

const router = express.Router();
const logger = new Logger('ScrapersRoute');

// Get the model defined in scraperRoutes.js
const getSubmissionModel = () => {
  try {
    return mongoose.model('ScraperSubmission');
  } catch (error) {
    logger.error('Error getting ScraperSubmission model:', error);
    return null;
  }
};

// Initialize all scrapers (called from server.js)
export const initializeScrapers = async () => {
  try {
    // This is just to ensure the model is defined
    const SubmissionModel = getSubmissionModel();
    if (!SubmissionModel) {
      logger.warning('ScraperSubmission model not found - may be initialized later');
      return false;
    }
    
    logger.success('Scrapers system initialized successfully');
    return true;
  } catch (error) {
    logger.error('Error initializing scrapers:', error);
    return false;
  }
};

// Helper function to parse cookies from request header
function getBambiNameFromCookies(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return 'AnonBambi';
  
  const cookies = cookieHeader.split(';')
    .map(cookie => cookie.trim().split('='))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  
  return cookies['bambiname'] 
    ? decodeURIComponent(cookies['bambiname']).replace(/%20/g, ' ') 
    : 'AnonBambi';
}

// Routes for scraper page
router.get('/', async (req, res) => {
  try {
    // Get cookie for bambiname using manual parsing
    const bambiname = getBambiNameFromCookies(req);
    
    // Fetch latest submissions for each type
    const SubmissionModel = getSubmissionModel();
    
    let textSubmissions = [];
    let imageSubmissions = [];
    let videoSubmissions = [];
    let stats = {
      successful: 0,
      failed: 0,
      blocked: 0,
      totalUpvotes: 0,
      totalDownvotes: 0,
      topUpvoted: [],
      topDownvoted: []
    };
    
    if (SubmissionModel) {
      // Fetch recent submissions for each type
      textSubmissions = await SubmissionModel.find({ type: 'text' })
        .sort({ submittedAt: -1 })
        .limit(10);
        
      imageSubmissions = await SubmissionModel.find({ type: 'image' })
        .sort({ submittedAt: -1 })
        .limit(10);
        
      videoSubmissions = await SubmissionModel.find({ type: 'video' })
        .sort({ submittedAt: -1 })
        .limit(10);
      
      // Get statistics
      stats.successful = await SubmissionModel.countDocuments({ 
        status: 'completed',
        'results.text.contentFound': true,
        $or: [
          { 'results.text.contentFound': true },
          { 'results.image.contentFound': true },
          { 'results.video.contentFound': true }
        ]
      });
      
      stats.failed = await SubmissionModel.countDocuments({ status: 'failed' });
      
      // Count as blocked if status is completed but no content found
      stats.blocked = await SubmissionModel.countDocuments({
        status: 'completed',
        $and: [
          { 'results.text.contentFound': { $ne: true } },
          { 'results.image.contentFound': { $ne: true } },
          { 'results.video.contentFound': { $ne: true } }
        ]
      });
      
      // Aggregate votes
      const voteCounts = await SubmissionModel.aggregate([
        {
          $group: {
            _id: null,
            totalUpvotes: { $sum: '$upvotes' },
            totalDownvotes: { $sum: '$downvotes' }
          }
        }
      ]);
      
      if (voteCounts.length > 0) {
        stats.totalUpvotes = voteCounts[0].totalUpvotes;
        stats.totalDownvotes = voteCounts[0].totalDownvotes;
      }
      
      // Top 5 most upvoted
      stats.topUpvoted = await SubmissionModel.find()
        .sort({ upvotes: -1 })
        .limit(5);
      
      // Top 5 most downvoted
      stats.topDownvoted = await SubmissionModel.find({ downvotes: { $gt: 0 } })
        .sort({ downvotes: -1 })
        .limit(5);
    } else {
      logger.warning('ScraperSubmission model not available, using empty arrays');
    }
    
    // Render the scrapers page
    res.render('scrapers', {
      bambiname,
      textSubmissions,
      imageSubmissions,
      videoSubmissions,
      stats
    });
  } catch (error) {
    logger.error('Error in scrapers route:', error);
    res.status(500).render('error', {
      error: {
        status: 500,
        message: 'Failed to load scrapers page'
      },
      message: 'Failed to load scrapers page',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

export default router;