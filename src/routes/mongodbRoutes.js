// Basic MongoDB routes file
import express from 'express';

// Create router
export const router = express.Router();

// Default route
router.get('/', (req, res) => {
  res.status(200).json({ message: 'MongoDB Routes API' });
});