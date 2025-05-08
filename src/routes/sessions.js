import express from 'express';
import mongoose from 'mongoose';
import { withDbConnection } from '../config/db.js';
import Logger from '../utils/logger.js';

const router = express.Router();
const logger = new Logger('Sessions Routes');

// Use constant for model name
const SESSION_HISTORY_MODEL = 'SessionHistory';

// Get session history for a user
router.get('/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const sessions = await withDbConnection(async () => {
      const SessionHistory = mongoose.model(SESSION_HISTORY_MODEL);
      return await SessionHistory.find({ username })
        .sort({ 'metadata.lastActivity': -1 })
        .limit(20);
    });
    
    res.json({ 
      success: true,
      sessions: sessions?.map(session => ({
        _id: session._id,
        title: session.title || 'Untitled Session',
        messages: session.messages || [],
        metadata: session.metadata || {},
        createdAt: session.metadata?.createdAt || session.createdAt
      })) || []
    });
  } catch (error) {
    logger.error(`Error fetching session history: ${error.message}`);
    res.status(500).json({ error: 'Error fetching session history', sessions: [] });
  }
});

// Get specific session by ID
router.get('/id/:sessionId', async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    
    if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
      return res.status(400).json({ error: 'Valid session ID is required' });
    }
    
    const session = await withDbConnection(async () => {
      const SessionHistory = mongoose.model(SESSION_HISTORY_MODEL);
      return await SessionHistory.findById(sessionId);
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
      success: true,
      session: {
        _id: session._id,
        title: session.title || 'Untitled Session',
        messages: session.messages || [],
        metadata: session.metadata || {},
        createdAt: session.metadata?.createdAt || session.createdAt
      }
    });
  } catch (error) {
    logger.error(`Error fetching session: ${error.message}`);
    res.status(500).json({ error: 'Error fetching session data' });
  }
});

export default router;