const express = require('express');
const router = express.Router();
const footerConfig = require('../config/footer.config');

router.get('/', (req, res) => {
  res.render('help', { footer: footerConfig });
});

module.exports = router;