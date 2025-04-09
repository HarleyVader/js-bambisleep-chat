import express from 'express';

const router = express.Router();

// Only enable in development
if (process.env.NODE_ENV !== 'production') {
  router.post('/emit', (req, res) => {
    const { event, data } = req.body;
    res.json({ success: true, message: `Event emission disabled` });
  });

  // Add to your debug routes
  router.get('/health', (req, res) => {
    const health = {
      uptime: process.uptime(),
      timestamp: Date.now(),
      bambi_integration: true,
      event_bus: {
        connected: true,
        events: []
      }
    };
    
    res.json(health);
  });

  router.get('/events', (req, res) => {
    res.json({
        success: true,
        events: []
    });
  });
}

export default router;