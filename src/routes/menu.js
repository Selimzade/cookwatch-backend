const express = require('express');
const router = express.Router();
const { getTodayMenu, addToMenu, removeFromMenu } = require('../controllers/menuController');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

router.use(protect, apiLimiter);

router.get('/',          getTodayMenu);
router.post('/',         addToMenu);
router.delete('/:id',    removeFromMenu);

module.exports = router;
