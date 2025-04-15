import express from 'express';
import ChatMessage from '../models/ChatMessage.js';
import Logger from '../utils/logger.js';

const router = express.Router();
const logger = new Logger('ChatRoutes');

/**
 * @route GET /api/chat/messages
 * @desc Get the most recent chat messages
 * @access Public
 */
router.get('/messages', async (req, res) => {
  try {
    // Get limit from query or use default of 15
    const limit = parseInt(req.query.limit) || 15;
    
    // Get the most recent messages
    const messages = await ChatMessage.getRecentMessages(limit);
    
    // Return messages in chronological order (oldest first)
    res.json(messages.reverse());
  } catch (error) {
    logger.error(`Error fetching chat messages: ${error.message}`);
    res.status(500).json({ error: 'Server error occurred fetching chat messages' });
  }
});

export default router;