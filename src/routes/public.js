const express = require('express');
const router  = express.Router();
const { getPublicView, getPublicMenu, placeOrder } = require('../controllers/publicController');
const { publicViewLimiter } = require('../middleware/rateLimit');

// List of today's menus
router.get('/view/:shareId', publicViewLimiter, getPublicView);

// Items + orders for a specific menu
router.get('/:shareId/menu/:menuId', publicViewLimiter, getPublicMenu);

// Place an order (unauthenticated)
router.post('/:shareId/menu/:menuId/order', publicViewLimiter, placeOrder);

module.exports = router;
