import express from 'express';
import { Logger } from '../utils/logger.js';
import { Bambi } from '../models/Bambi.js';  // Named import

const router = express.Router();
const logger = new Logger('HelpRoutes');

// Helper function to get bambiname from cookies
function getBambiNameFromCookies(req) {
  if (req.cookies && req.cookies.bambiname) {
    return decodeURIComponent(req.cookies.bambiname);
  }
  return null;
}

router.get('/', (req, res) => {
  // Get bambiname from cookies
  const bambiname = getBambiNameFromCookies(req);
  
  res.render('help', { 
    title: 'Help & Documentation',
    bambiname: bambiname,
    validConstantsCount: 5
  });
});

export default router;