import express from 'express';
import { getSessionHistoryModel } from '../models/SessionHistory.js';
import Logger from '../utils/logger.js';

const router = express.Router();
const logger = new Logger('SessionRoutes');

// Get sessions for a user
router.get('/api/sessions/:username', async (req, res) => {
  try {
    const SessionHistory = getSessionHistoryModel();
    const sessions = await SessionHistory.find({ username: req.params.username })
      .sort({ 'metadata.lastActivity': -1 })
      .limit(50);
    
    res.json({ success: true, sessions });
  } catch (error) {
    logger.error('Error fetching sessions:', error.message);
    res.json({ success: false });
  }
});

// Get a specific session by ID
router.get('/api/sessions/id/:sessionId', async (req, res) => {
  try {
    const SessionHistory = getSessionHistoryModel();
    const session = await SessionHistory.findById(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }
    
    res.json({ success: true, session });
  } catch (error) {
    logger.error('Error fetching session by ID:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching session' });
  }
});

// Handle 404 for sessions routes
router.get('*', (req, res) => {
  logger.info(`Session route not found: ${req.path}`);
  res.status(404).render('error', {
    message: 'Session page not found',
    error: { status: 404 },
    title: '404 - Page Not Found'
  });
});

// Fix the exports - both named and default
const basePath = '/sessions';
export { router, basePath };
export default router;