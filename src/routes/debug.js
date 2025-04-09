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
}

export default router;