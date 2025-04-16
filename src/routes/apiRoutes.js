import express from 'express';
import { getProfile } from '../models/Profile.js';
import Logger from '../utils/logger.js';

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
    res.status(500).json({ error: 'Error processing metrics' });
  }
});

export default router;