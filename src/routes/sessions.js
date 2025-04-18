import express from 'express';
import mongoose from 'mongoose';
import { getModel } from '../config/db.js';
import Logger from '../utils/logger.js';
import crypto from 'crypto';
import SessionHistoryModel from '../models/SessionHistory.js';  // Import the model directly

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
    
    const sessions = await SessionHistoryModel.find({ username })
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
    
    const session = await SessionHistoryModel.findById(sessionId);
    
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
    
    const session = await SessionHistoryModel.findById(sessionId);
    
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
    
    const session = await SessionHistoryModel.findOne({ shareToken });
    
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
    
    const session = await SessionHistoryModel.findById(sessionId);
    
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
    
    const session = await SessionHistoryModel.findById(sessionId);
    
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

// Dashboard view
router.get('/dashboard', async (req, res) => {
  try {
    const username = getUsernameFromCookies(req);
    if (!username) {
      return res.redirect('/login?redirect=/sessions/dashboard');
    }
    
    // Parse query parameters
    const { 
      page = 1, 
      q: searchQuery = '', 
      dateFrom = '', 
      dateTo = '', 
      visibility = 'all',
      sortBy = 'newest'
    } = req.query;
    
    // Build filter query
    const query = { username };
    
    // Add search filter
    if (searchQuery) {
      query.title = { $regex: searchQuery, $options: 'i' };
    }
    
    // Add date filters
    if (dateFrom || dateTo) {
      query['metadata.createdAt'] = {};
      if (dateFrom) {
        query['metadata.createdAt'].$gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add one day to include the end date fully
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        query['metadata.createdAt'].$lt = endDate;
      }
    }
    
    // Add visibility filter
    if (visibility === 'public') {
      query.isPublic = true;
    } else if (visibility === 'private') {
      query.isPublic = false;
    }
    
    // Determine sort order
    let sort = {};
    switch(sortBy) {
      case 'oldest':
        sort = { 'metadata.createdAt': 1 };
        break;
      case 'most_views':
        sort = { 'stats.views': -1 };
        break;
      case 'most_likes':
        sort = { 'stats.likes': -1 };
        break;
      case 'most_comments':
        sort = { 'comments.length': -1 };
        break;
      default: // newest
        sort = { 'metadata.createdAt': -1 };
    }
    
    // Pagination
    const limit = 9;
    const currentPage = parseInt(page) || 1;
    const skip = (currentPage - 1) * limit;
    
    // Get total count for pagination
    const totalSessions = await SessionHistoryModel.countDocuments(query);
    const totalPages = Math.ceil(totalSessions / limit);
    
    // Calculate pagination range
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4 && totalPages > 5) {
      startPage = Math.max(1, endPage - 4);
    }
    
    // Build pagination query string
    const queryParams = new URLSearchParams();
    if (searchQuery) queryParams.append('q', searchQuery);
    if (dateFrom) queryParams.append('dateFrom', dateFrom);
    if (dateTo) queryParams.append('dateTo', dateTo);
    if (visibility !== 'all') queryParams.append('visibility', visibility);
    if (sortBy !== 'newest') queryParams.append('sortBy', sortBy);
    
    const paginationQuery = queryParams.toString() ? `&${queryParams.toString()}` : '';
    
    // Fetch sessions with pagination
    const sessions = await SessionHistoryModel.find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip);
    
    // Calculate user stats
    const userSessionsCount = await SessionHistoryModel.countDocuments({ username });
    const totalViews = await SessionHistoryModel.aggregate([
      { $match: { username } },
      { $group: { _id: null, count: { $sum: "$stats.views" } } }
    ]);
    const totalLikes = await SessionHistoryModel.aggregate([
      { $match: { username } },
      { $group: { _id: null, count: { $sum: "$stats.likes" } } }
    ]);
    
    // Render dashboard with data
    res.render('sessions/dashboard', {
      title: 'Sessions Dashboard',
      sessions,
      currentPage,
      totalPages,
      startPage,
      endPage,
      paginationQuery,
      totalSessions: userSessionsCount,
      totalViews: totalViews.length ? totalViews[0].count : 0,
      totalLikes: totalLikes.length ? totalLikes[0].count : 0,
      searchQuery,
      filters: {
        dateFrom,
        dateTo,
        visibility,
        sortBy
      },
      username
    });
  } catch (error) {
    logger.error(`Error loading dashboard: ${error.message}`);
    res.status(500).render('error', { 
      message: 'Failed to load dashboard',
      error: req.app.get('env') === 'development' ? error : {}
    });
  }
});

// Get session details for editing
router.get('/:id/details', async (req, res) => {
  try {
    const username = getUsernameFromCookies(req);
    const sessionId = req.params.id;
    
    if (!username) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    const session = await SessionHistoryModel.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }
    
    if (session.username !== username) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }
    
    res.json({
      success: true,
      title: session.title,
      id: session._id
    });
  } catch (error) {
    logger.error(`Error getting session details: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Update session title
router.post('/:id/update-title', async (req, res) => {
  try {
    const username = getUsernameFromCookies(req);
    const sessionId = req.params.id;
    const { title } = req.body;
    
    if (!username) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title is required' 
      });
    }
    
    const session = await SessionHistoryModel.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }
    
    if (session.username !== username) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }
    
    session.title = title.trim();
    await session.save();
    
    res.json({
      success: true,
      message: 'Title updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating session title: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Delete a session
router.delete('/:id', async (req, res) => {
  try {
    const username = getUsernameFromCookies(req);
    const sessionId = req.params.id;
    
    if (!username) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    const session = await SessionHistoryModel.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }
    
    if (session.username !== username) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }
    
    // Remove reference from user's profile
    await mongoose.model('Profile').findOneAndUpdate(
      { username },
      { $pull: { sessionHistories: session._id } }
    );
    
    // Delete the session
    await session.deleteOne();
    
    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting session: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Batch delete sessions
router.post('/batch/delete', async (req, res) => {
  try {
    const username = getUsernameFromCookies(req);
    const { sessionIds } = req.body;
    
    if (!username) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No sessions selected' 
      });
    }
    
    const sessions = await SessionHistoryModel.find({
      _id: { $in: sessionIds },
      username
    });
    
    if (sessions.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No sessions found' 
      });
    }
    
    // Get IDs of sessions to delete
    const idsToDelete = sessions.map(session => session._id);
    
    // Remove references from user's profile
    await mongoose.model('Profile').findOneAndUpdate(
      { username },
      { $pull: { sessionHistories: { $in: idsToDelete } } }
    );
    
    // Delete the sessions
    await SessionHistoryModel.deleteMany({
      _id: { $in: idsToDelete }
    });
    
    res.json({
      success: true,
      message: `${idsToDelete.length} sessions deleted successfully`
    });
  } catch (error) {
    logger.error(`Error batch deleting sessions: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Batch share sessions
router.post('/batch/share', async (req, res) => {
  try {
    const username = getUsernameFromCookies(req);
    const { sessionIds } = req.body;
    
    if (!username) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No sessions selected' 
      });
    }
    
    const sessions = await SessionHistoryModel.find({
      _id: { $in: sessionIds },
      username
    });
    
    if (sessions.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No sessions found' 
      });
    }
    
    // Share all sessions
    const results = await Promise.all(sessions.map(async (session) => {
      if (!session.isPublic) {
        session.isPublic = true;
        
        // Generate share token if it doesn't exist
        if (!session.shareToken) {
          session.shareToken = crypto.randomBytes(16).toString('hex');
        }
        
        await session.save();
        return true;
      }
      return false;
    }));
    
    // Count how many were newly shared
    const sharedCount = results.filter(result => result).length;
    
    res.json({
      success: true,
      message: `${sharedCount} sessions shared successfully`
    });
  } catch (error) {
    logger.error(`Error batch sharing sessions: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Export sessions
router.post('/export', async (req, res) => {
  try {
    const username = getUsernameFromCookies(req);
    const { sessionIds } = req.body;
    
    if (!username) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No sessions selected' 
      });
    }
    
    const sessions = await SessionHistoryModel.find({
      _id: { $in: sessionIds },
      username
    }).select('-__v'); // Exclude version field
    
    if (sessions.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No sessions found' 
      });
    }
    
    // Prepare data for export
    const exportData = {
      exportDate: new Date(),
      username,
      sessions: sessions.map(session => {
        // Convert Mongoose document to plain object
        const sessionObj = session.toObject();
        
        // Add formatted dates for readability
        sessionObj.createdAt = new Date(session.metadata.createdAt).toISOString();
        sessionObj.lastActivity = new Date(session.metadata.lastActivity).toISOString();
        
        return sessionObj;
      })
    };
    
    // Set the appropriate headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=bambi-sessions-${Date.now()}.json`);
    
    // Send the file
    res.json(exportData);
  } catch (error) {
    logger.error(`Error exporting sessions: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

export default router;