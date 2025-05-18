import express from 'express';
import ChatMessage from '../models/ChatMessage.js';
import Logger from '../utils/logger.js';
import footerConfig from '../config/footer.config.js';
import config from '../config/config.js';
import { getProfile } from '../models/Profile.js';
import { getSessionHistoryModel } from '../models/SessionHistory.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const logger = new Logger('AdvancedChat');

// Base path for this router
export const basePath = '/advanced-chat';

// Main advanced chat page
router.get('/', async (req, res) => {
  try {
    // Get username from cookie
    const username = req.cookies?.bambiname 
      ? decodeURIComponent(req.cookies.bambiname) 
      : 'anonBambi';
    
    // Get recent chat messages for the chat history
    const chatMessages = await ChatMessage.getRecentMessages(100);
    
    // Get profile data if available
    let profile = null;
    if (username && username !== 'anonBambi') {
      try {
        profile = await getProfile(username);
      } catch (error) {
        logger.error(`Error fetching profile for ${username}:`, error);
      }
    }
    
    // Get footer links from config
    const footerLinks = config?.FOOTER_LINKS || footerConfig?.links || [];
    
    // Load trigger data for client if profile exists
    let triggers = [];
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      
      // Read triggers from config file
      const triggersPath = path.resolve(path.dirname(__dirname), 'config', 'triggers.json');
      const triggerData = await fs.readFile(triggersPath, 'utf8');
      triggers = JSON.parse(triggerData).triggers;
    } catch (error) {
      logger.error('Error loading triggers:', error);
      // Use fallback triggers
      triggers = [
        { name: "BAMBI SLEEP", description: "triggers deep trance and receptivity", category: "core" },
        { name: "GOOD GIRL", description: "reinforces obedience and submission", category: "core" }
      ];
    }
    
    // Get session history if user is logged in
    let sessionHistory = [];
    if (username && username !== 'anonBambi') {
      try {
        const SessionHistory = getSessionHistoryModel();
        sessionHistory = await SessionHistory.find({ username })
          .sort({ 'metadata.lastActivity': -1 })
          .limit(10);
      } catch (error) {
        logger.error(`Error fetching session history for ${username}:`, error);
      }
    }
    
    // Render the advanced chat view
    res.render('advanced-chat', {
      title: 'BambiSleep Advanced Chat',
      profile,
      username,
      footerLinks,
      chatMessages,
      triggers,
      sessionHistory
    });
  } catch (error) {
    logger.error('Error rendering advanced chat page:', error);
    
    // Fallback with minimal data
    res.render('advanced-chat', {
      title: 'BambiSleep Advanced Chat',
      profile: null,
      username: '',
      footerLinks: config?.FOOTER_LINKS || footerConfig?.links || [],
      chatMessages: [],
      triggers: [],
      sessionHistory: []
    });
  }
});

// Get session history
router.get('/sessions', async (req, res) => {
  try {
    const username = req.cookies?.bambiname 
      ? decodeURIComponent(req.cookies.bambiname) 
      : null;
    
    if (!username || username === 'anonBambi') {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required'
      });
    }
    
    const SessionHistory = getSessionHistoryModel();
    const sessions = await SessionHistory.find({ username })
      .sort({ 'metadata.lastActivity': -1 })
      .limit(20);
    
    res.json({ 
      success: true, 
      sessions: sessions.map(session => ({
        _id: session._id,
        title: session.title || 'Untitled Session',
        lastActivity: session.metadata?.lastActivity || session.updatedAt,
        messageCount: session.messages?.length || 0,
        triggers: session.metadata?.triggers || []
      }))
    });
  } catch (error) {
    logger.error('Error fetching session history:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching session history'
    });
  }
});

// Get specific session
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const username = req.cookies?.bambiname 
      ? decodeURIComponent(req.cookies.bambiname) 
      : null;
    
    if (!username || username === 'anonBambi') {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required'
      });
    }
    
    const SessionHistory = getSessionHistoryModel();
    const session = await SessionHistory.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found'
      });
    }
    
    // Check if this session belongs to the user
    if (session.username !== username) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to access this session'
      });
    }
    
    res.json({ 
      success: true, 
      session
    });
  } catch (error) {
    logger.error('Error fetching session:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching session'
    });
  }
});

export default router;
