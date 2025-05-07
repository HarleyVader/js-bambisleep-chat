import express from 'express';
import mongoose from 'mongoose';
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

// Get single session
router.get('/:sessionId', async (req, res) => {
  try {
    const SessionHistory = await getSessionHistoryModel();
    const session = await SessionHistory.findById(req.params.sessionId);
    
    res.json({ success: true, session });
  } catch (error) {
    logger.error('Error fetching session:', error.message);
    res.json({ success: false });
  }
});

// Add share route
router.post('/:sessionId/share', async (req, res) => {
  try {
    const SessionHistory = getSessionHistoryModel();
    const session = await SessionHistory.findById(req.params.sessionId);
    
    if (!session) {
      return res.json({ success: false });
    }
    
    // Generate a random token
    const token = Math.random().toString(36).substring(2, 15);
    
    // Store token with session
    session.shareToken = token;
    await session.save();
    
    // Build share URL
    const baseUrl = process.env.SITE_URL || 'https://bambisleep.chat';
    const shareUrl = `${baseUrl}?session=${token}`;
    
    res.json({ success: true, shareUrl });
  } catch (error) {
    logger.error('Error sharing session:', error.message);
    res.json({ success: false });
  }
});

// Get shared session by token
router.get('/shared/:token', async (req, res) => {
  try {
    const SessionHistory = getSessionHistoryModel();
    const session = await SessionHistory.findOne({ shareToken: req.params.token });
    
    if (!session) {
      return res.json({ success: false });
    }
    
    res.json({ success: true, session });
  } catch (error) {
    logger.error('Error fetching shared session:', error.message);
    res.json({ success: false });
  }
});

// Delete session
router.delete('/:sessionId', async (req, res) => {
  try {
    const SessionHistory = await getSessionHistoryModel();
    await SessionHistory.findByIdAndDelete(req.params.sessionId);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting session:', error.message);
    res.json({ success: false });
  }
});

export const basePath = '/sessions';
export { router };