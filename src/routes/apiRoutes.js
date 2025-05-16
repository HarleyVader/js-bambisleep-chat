import express from 'express';
import mongoose from 'mongoose';
import { getProfile } from '../models/Profile.js';
import Logger from '../utils/logger.js';
import workerCoordinator from '../workers/workerCoordinator.js';

const router = express.Router();
const logger = new Logger('API Routes');

/**
 * Route to get chat messages
 * Endpoint: GET /api/chat/messages
 */
router.get('/chat/messages', async (req, res) => {
  try {
    // Get requested limit with default of 50
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    
    // Get messages from database or cache
    // This is a placeholder - replace with your actual data source
    const messages = []; // Replace with actual data
    
    res.json({ messages });
  } catch (error) {
    logger.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

/**
 * Route to get system controls for a profile
 * Endpoint: GET /api/profile/:username/system-controls
 */
router.get('/profile/:username/system-controls', async (req, res) => {
  try {
    const username = req.params.username;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Get profile from database
    const profile = await getProfile(username);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Return only system controls data
    // Replace this with your actual data structure
    res.json({
      activeTriggers: profile.triggers || [],
      systemSettings: profile.settings || {}
    });
  } catch (error) {
    logger.error(`Error fetching profile system controls for ${req.params.username}:`, error);
    res.status(500).json({ error: 'Error fetching profile data' });
  }
});

/**
 * Route to record client performance metrics
 * Endpoint: POST /api/performance
 */
router.post('/performance', (req, res) => {
  try {
    const metrics = req.body;
    
    // Log summary of metrics
    if (metrics && metrics.summary) {
      logger.info(`Performance metrics from client: ${JSON.stringify(metrics.summary)}`);
    }
    
    // Could store metrics in database for analysis
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error processing performance metrics:', error);
    res.status(500).json({ error: 'Error processing metrics' });  }
});

/**
 * Generate an image using RunPod API
 * Endpoint: POST /api/generate-image
 */
router.post('/generate-image', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.username) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { prompt, negativePrompt, width, height } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Generate image using worker coordinator
    workerCoordinator.generateImage({
      prompt,
      negativePrompt,
      width: width || 512,
      height: height || 512,
      apiKey: process.env.RUNPOD_API_KEY
    }, (error, result) => {
      if (error) {
        logger.error('Error generating image:', error);
        return res.status(500).json({ error: 'Failed to generate image' });
      }
      
      // If this is an async job
      if (result.status === 'processing' && result.jobId) {
        return res.json({
          success: true,
          status: 'processing',
          jobId: result.jobId,
          message: 'Image generation in progress'
        });
      }
      
      res.json(result);
    });
  } catch (error) {
    logger.error('Error processing image generation request:', error);
    res.status(500).json({ error: 'Error processing request' });
  }
});

/**
 * Check status of an image generation job
 * Endpoint: GET /api/image-job/:jobId
 */
router.get('/image-job/:jobId', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.username) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }
    
    // Check job status
    workerCoordinator.checkImageJobStatus(jobId, (error, result) => {
      if (error) {
        logger.error('Error checking image job status:', error);
        return res.status(500).json({ error: 'Failed to check job status' });
      }
      
      res.json(result);
    });
  } catch (error) {
    logger.error('Error processing job status request:', error);
    res.status(500).json({ error: 'Error processing request' });
  }
});

/**
 * Get profile data for a username
 */
router.get('/api/profile/:username/data', async (req, res) => {
  try {
    const username = req.params.username;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Get profile by username
    const Profile = getModel('Profile');
    const profile = await withDbConnection(async () => {
      return await Profile.findOne({ username });
    });
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Return sanitized profile data
    res.json({
      username: profile.username,
      displayName: profile.displayName || profile.username,
      level: profile.level || 0,
      xp: profile.xp || 0,
      activeTriggers: profile.activeTriggers || [],
      systemControls: profile.systemControls || { 
        activeTriggers: [],
        collarEnabled: false,
        collarText: ''
      }
    });
  } catch (error) {
    logger.error(`Error fetching profile data for ${req.params.username}:`, error);
    res.status(500).json({ error: 'Error fetching profile data' });
  }
});

/**
 * Get system controls for a username
 */
router.get('/api/profile/:username/system-controls', async (req, res) => {
  try {
    const username = req.params.username;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Get profile by username
    const Profile = getModel('Profile');
    const profile = await withDbConnection(async () => {
      return await Profile.findOne({ username });
    });
    
    if (!profile) {
      return res.status(404).json({ 
        activeTriggers: [],
        level: 0,
        xp: 0
      });
    }
    
    // Return system controls data
    res.json({
      activeTriggers: profile.activeTriggers || [],
      systemControls: profile.systemControls || {},
      level: profile.level || 0,
      xp: profile.xp || 0
    });
  } catch (error) {
    logger.error(`Error fetching system controls for ${req.params.username}:`, error);
    res.status(500).json({ 
      error: 'Error fetching system controls',
      activeTriggers: []
    });
  }
});

/**
 * Update system controls for a username
 */
router.post('/api/profile/:username/system-controls', async (req, res) => {
  try {
    const username = req.params.username;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Get profile by username
    const Profile = getModel('Profile');
    let profile = await withDbConnection(async () => {
      return await Profile.findOne({ username });
    });
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Update system controls with request body
    if (!profile.systemControls) {
      profile.systemControls = {};
    }
    
    // Update active triggers if provided
    if (req.body.activeTriggers) {
      profile.activeTriggers = req.body.activeTriggers;
      profile.systemControls.activeTriggers = req.body.activeTriggers;
    }
    
    // Update collar settings if provided
    if (req.body.collarEnabled !== undefined) {
      profile.systemControls.collarEnabled = !!req.body.collarEnabled;
    }
    
    if (req.body.collarText !== undefined) {
      profile.systemControls.collarText = req.body.collarText;
      profile.systemControls.collarLastUpdated = new Date();
    }
    
    // Update spirals settings if provided
    if (req.body.spiralsEnabled !== undefined) {
      profile.systemControls.spiralsEnabled = !!req.body.spiralsEnabled;
    }
    
    // Update hypnosis settings if provided
    if (req.body.hypnosisEnabled !== undefined) {
      profile.systemControls.hypnosisEnabled = !!req.body.hypnosisEnabled;
    }
    
    // Save the updated profile
    await withDbConnection(async () => {
      return await profile.save();
    });
    
    // Return success response
    res.json({
      success: true,
      activeTriggers: profile.activeTriggers || [],
      systemControls: profile.systemControls
    });
  } catch (error) {
    logger.error(`Error updating system controls for ${req.params.username}:`, error);
    res.status(500).json({ error: 'Error updating system controls' });
  }
});

/**
 * Route to get user's session history
 * Endpoint: GET /api/sessions/:username
 */
router.get('/sessions/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Get sessions from SessionHistory model
    const SessionHistory = mongoose.model('SessionHistory');
    const sessions = await SessionHistory.find({ username })
      .sort({ 'metadata.lastActivity': -1 })
      .limit(20);
    
    if (!sessions || sessions.length === 0) {
      return res.json({ 
        success: true,
        sessions: [] 
      });
    }
    
    res.json({ 
      success: true,
      sessions: sessions.map(session => ({
        _id: session._id,
        title: session.title,
        messages: session.messages,
        metadata: session.metadata,
        createdAt: session.metadata.createdAt
      }))
    });
  } catch (error) {
    logger.error(`Error fetching session history: ${error.message}`);
    res.status(500).json({ error: 'Error fetching session history', sessions: [] });
  }
});

export default router;