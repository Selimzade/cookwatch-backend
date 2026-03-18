const express = require('express');
const router = express.Router();
const { getTodayOrders, startOrder, completeOrder, cancelOrder } = require('../controllers/orderController');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

router.use(protect, apiLimiter);

router.get('/',              getTodayOrders);
router.post('/:id/start',    startOrder);
router.post('/:id/complete', completeOrder);
router.post('/:id/cancel',   cancelOrder);

module.exports = router;
