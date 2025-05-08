const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// In-memory token storage (for demo purposes - in production use Redis or database)
const sessionTokens = {};

// Generate a session token
router.post('/generate', (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required' });
    }
    
    // Generate a random token
    const token = crypto.randomBytes(16).toString('hex');
    
    // Store mapping of token to session ID (with expiration)
    sessionTokens[token] = {
      sessionId,
      created: Date.now(),
      expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };
    
    res.json({ success: true, token });
  } catch (error) {
    console.error('Error generating session token:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Verify and get session by token
router.get('/resolve/:token', (req, res) => {
  try {
    const { token } = req.params;
    
    // Check if token exists and is valid
    const tokenData = sessionTokens[token];
    if (!tokenData) {
      return res.status(404).json({ success: false, message: 'Invalid or expired token' });
    }
    
    // Check if token is expired
    if (tokenData.expires < Date.now()) {
      delete sessionTokens[token];
      return res.status(404).json({ success: false, message: 'Token expired' });
    }
    
    // Fetch the session data from database (placeholder)
    // In a real implementation, you would query your sessions database
    const session = await db.sessions.findById(tokenData.sessionId);
    
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    
    res.json({ success: true, session });
  } catch (error) {
    console.error('Error resolving session token:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;