import express from 'express';
import eventBus from '../utils/eventBus.js';

const router = express.Router();

// Only enable in development
if (process.env.NODE_ENV !== 'production') {
  router.post('/test-event', (req, res) => {
    const { event, data } = req.body;
    eventBus.emit(event, data);
    res.json({ success: true, message: `Event ${event} emitted` });
  });

  // Add to your debug routes
  router.get('/health', (req, res) => {
    const health = {
      uptime: process.uptime(),
      timestamp: Date.now(),
      profile_integration: true,
      event_bus: {
        connected: true,
        events: Array.from(eventBus.eventNames())
      }
    };
    
    res.json(health);
  });
}

export default router;