const express = require('express');
const router  = express.Router();
const {
  getTodayMenus, createMenu, deleteMenu,
  getMenuItems, addMenuItem, removeMenuItem,
} = require('../controllers/menuController');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

router.use(protect, apiLimiter);

// Menu CRUD
router.get('/',    getTodayMenus);
router.post('/',   createMenu);
router.delete('/:id', deleteMenu);

// Items within a menu
router.get('/:menuId/items',          getMenuItems);
router.post('/:menuId/items',         addMenuItem);
router.delete('/:menuId/items/:itemId', removeMenuItem);

module.exports = router;
