const express = require('express');
const router = express.Router();
const { getPublicView, placeOrder } = require('../controllers/publicController');
const { publicViewLimiter } = require('../middleware/rateLimit');

router.get('/view/:shareId',   publicViewLimiter, getPublicView);
router.post('/order/:shareId', publicViewLimiter, placeOrder);

module.exports = router;
