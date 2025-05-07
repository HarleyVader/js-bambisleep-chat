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

// Fix the exports - both named and default
const basePath = '/sessions';
export { router, basePath };
export default router;