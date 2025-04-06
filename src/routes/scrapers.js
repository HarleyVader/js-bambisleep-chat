import express from 'express';
import mongoose from 'mongoose';
import Logger from '../utils/logger.js';

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

// Routes for scraper page
router.get('/', async (req, res) => {
  try {
    // Get cookie for bambiname
    const bambiname = req.cookies.bambiname 
      ? decodeURIComponent(req.cookies.bambiname).replace(/%20/g, ' ') 
      : 'Anonymous Bambi';
    
    // Fetch latest submissions for each type
    const SubmissionModel = getSubmissionModel();
    
    let textSubmissions = [];
    let imageSubmissions = [];
    let videoSubmissions = [];
    
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
    } else {
      logger.warning('ScraperSubmission model not available, using empty arrays');
    }
    
    // Render the scrapers page
    res.render('scrapers', {
      bambiname,
      textSubmissions,
      imageSubmissions,
      videoSubmissions
    });
  } catch (error) {
    logger.error('Error in scrapers route:', error);
    res.status(500).render('error', {
      error: 'Failed to load scrapers page',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

export default router;