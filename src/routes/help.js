import express from 'express';
import footerConfig from '../config/footer.config.js';
const router = express.Router();

router.get('/', (req, res) => {
  res.render('help', { footer: footerConfig });
});

export default router;