const express = require('express');
const router = express.Router();
const { getPublicView } = require('../controllers/publicController');
const { publicViewLimiter } = require('../middleware/rateLimit');

// Public route — no auth, rate-limited
router.get('/view/:shareId', publicViewLimiter, getPublicView);

module.exports = router;
