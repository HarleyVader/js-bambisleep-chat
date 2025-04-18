import express from 'express';
import mongoose from 'mongoose';
import { getModel } from '../config/db.js';
import Logger from '../utils/logger.js';
import crypto from 'crypto';

const router = express.Router();
const logger = new Logger('SessionRoutes');

// Define the base path for this router
export const basePath = '/sessions';

// Helper function to get username from cookies
const getUsernameFromCookies = (req) => {
  try {
    return req.cookies && req.cookies.bambiname 
      ? decodeURIComponent(req.cookies.bambiname) 
      : null;
  } catch (error) {
    return null;
  }
};

// List user's sessions
router.get('/', async (req, res) => {
  try {
    const username = getUsernameFromCookies(req);
    if (!username) {
      return res.redirect('/login?redirect=/sessions');
    }
    
    const SessionHistory = getModel('SessionHistory');
    const sessions = await SessionHistory.find({ username })
      .sort({ 'metadata.lastActivity': -1 })
      .limit(20)
      .select('title metadata.createdAt metadata.lastActivity stats isPublic shareToken');
    
    res.render('sessions/list', {
      title: 'Your Chat Sessions',
      sessions,
      username
    });
  } catch (error) {
    logger.error(`Error fetching sessions: ${error.message}`);
    res.status(500).render('error', { 
      message: 'Failed to load sessions',
      error: req.app.get('env') === 'development' ? error : {}
    });
  }
});

// View a specific session
router.get('/:id', async (req, res) => {
  try {
    const username = getUsernameFromCookies(req);
    const sessionId = req.params.id;
    
    const SessionHistory = getModel('SessionHistory');
    const session = await SessionHistory.findById(sessionId);
    
    if (!session) {
      return res.status(404).render('error', { 
        message: 'Session not found',
        error: { status: 404 }
      });
    }
    
    // Check if user has permission to view the session
    const canView = session.isPublic || session.username === username;
    if (!canView) {
      return res.status(403).render('error', { 
        message: 'You do not have permission to view this session',
        error: { status: 403 }
      });
    }
    
    // Increment view count if not the owner
    if (session.username !== username) {
      session.stats.views += 1;
      await session.save();
    }
    
    res.render('sessions/view', {
      title: session.title,
      session,
      username,
      isOwner: session.username === username
    });
  } catch (error) {
    logger.error(`Error viewing session: ${error.message}`);
    res.status(500).render('error', { 
      message: 'Failed to load session',
      error: req.app.get('env') === 'development' ? error : {}
    });
  }
});

// Share a session
router.post('/:id/share', async (req, res) => {
  try {
    const username = getUsernameFromCookies(req);
    const sessionId = req.params.id;
    
    // Check if user is logged in
    if (!username) {
      return res.status(401).json({ 
        success: false, 
        message: 'You must be logged in to share a session' 
      });
    }
    
    const SessionHistory = getModel('SessionHistory');
    const session = await SessionHistory.findById(sessionId);
    
    // Check if session exists
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }
    
    // Check if user owns the session
    if (session.username !== username) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to share this session' 
      });
    }
    
    // Generate share token if it doesn't exist
    if (!session.shareToken) {
      session.shareToken = crypto.randomBytes(16).toString('hex');
    }
    
    // Make the session public
    session.isPublic = true;
    await session.save();
    
    // Return the share URL
    const shareUrl = `${req.protocol}://${req.get('host')}/sessions/shared/${session.shareToken}`;
    res.json({ 
      success: true, 
      shareUrl,
      message: 'Session shared successfully'
    });
  } catch (error) {
    logger.error(`Error sharing session: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to share session' 
    });
  }
});

// Access a shared session by token
router.get('/shared/:token', async (req, res) => {
  try {
    const shareToken = req.params.token;
    const username = getUsernameFromCookies(req);
    
    const SessionHistory = getModel('SessionHistory');
    const session = await SessionHistory.findOne({ shareToken });
    
    if (!session || !session.isPublic) {
      return res.status(404).render('error', { 
        message: 'Shared session not found or no longer available',
        error: { status: 404 }
      });
    }
    
    // Increment view count if not the owner
    if (session.username !== username) {
      session.stats.views += 1;
      await session.save();
    }
    
    res.render('sessions/view', {
      title: session.title,
      session,
      username,
      isOwner: session.username === username,
      isShared: true
    });
  } catch (error) {
    logger.error(`Error accessing shared session: ${error.message}`);
    res.status(500).render('error', { 
      message: 'Failed to load shared session',
      error: req.app.get('env') === 'development' ? error : {}
    });
  }
});

// Like/dislike a session
router.post('/:id/react', async (req, res) => {
  try {
    const username = getUsernameFromCookies(req);
    const sessionId = req.params.id;
    const { action } = req.body; // 'like' or 'dislike'
    
    if (!username) {
      return res.status(401).json({ 
        success: false, 
        message: 'You must be logged in to react to a session' 
      });
    }
    
    if (!['like', 'dislike'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid reaction type' 
      });
    }
    
    const SessionHistory = getModel('SessionHistory');
    const session = await SessionHistory.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }
    
    // Check if session is public or user owns it
    if (!session.isPublic && session.username !== username) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to react to this session' 
      });
    }
    
    // Handle the reaction
    await session.handleReaction(username, action);
    
    res.json({ 
      success: true, 
      likes: session.stats.likes,
      dislikes: session.stats.dislikes,
      yourReaction: action
    });
  } catch (error) {
    logger.error(`Error reacting to session: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process reaction' 
    });
  }
});

// Add a comment to a session
router.post('/:id/comment', async (req, res) => {
  try {
    const username = getUsernameFromCookies(req);
    const sessionId = req.params.id;
    const { content } = req.body;
    
    if (!username) {
      return res.status(401).json({ 
        success: false, 
        message: 'You must be logged in to comment' 
      });
    }
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Comment cannot be empty' 
      });
    }
    
    const SessionHistory = getModel('SessionHistory');
    const session = await SessionHistory.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }
    
    // Check if session is public or user owns it
    if (!session.isPublic && session.username !== username) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to comment on this session' 
      });
    }
    
    // Add the comment
    await session.addComment(username, content);
    
    // Return the updated comments
    res.json({ 
      success: true, 
      comments: session.comments,
      message: 'Comment added successfully'
    });
  } catch (error) {
    logger.error(`Error adding comment: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add comment' 
    });
  }
});

export default router;