const Menu     = require('../models/Menu');
const MenuItem = require('../models/MenuItem');
const Meal     = require('../models/Meal');
const { getIO } = require('../services/socketService');

const today = () => new Date().toISOString().split('T')[0];

// ── Menu CRUD ────────────────────────────────────────────────────────────────

// GET /api/menus
const getTodayMenus = async (req, res, next) => {
  try {
    const menus = await Menu.find({ userId: req.user._id, date: today() })
      .sort({ createdAt: 1 });
    res.json({ menus });
  } catch (err) { next(err); }
};

// POST /api/menus  { name }
const createMenu = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Menyu adı tələb olunur' });

    const menu = await Menu.create({
      userId: req.user._id,
      name:   name.trim(),
      date:   today(),
    });

    await broadcastMenus(req.user.shareId, req.user._id);
    res.status(201).json({ menu });
  } catch (err) { next(err); }
};

// DELETE /api/menus/:id
const deleteMenu = async (req, res, next) => {
  try {
    const menu = await Menu.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!menu) return res.status(404).json({ error: 'Menyu tapılmadı' });

    // Cascade — remove all items in this menu
    await MenuItem.deleteMany({ menuId: menu._id });

    await broadcastMenus(req.user.shareId, req.user._id);
    res.json({ message: 'Menyu silindi' });
  } catch (err) { next(err); }
};

// ── Menu Items ────────────────────────────────────────────────────────────────

// GET /api/menus/:menuId/items
const getMenuItems = async (req, res, next) => {
  try {
    const menu = await Menu.findOne({ _id: req.params.menuId, userId: req.user._id });
    if (!menu) return res.status(404).json({ error: 'Menyu tapılmadı' });

    const items = await MenuItem.find({ menuId: menu._id }).sort({ createdAt: 1 });
    res.json({ items });
  } catch (err) { next(err); }
};

// POST /api/menus/:menuId/items  { mealId }
const addMenuItem = async (req, res, next) => {
  try {
    const { mealId } = req.body;
    if (!mealId) return res.status(400).json({ error: 'mealId tələb olunur' });

    const menu = await Menu.findOne({ _id: req.params.menuId, userId: req.user._id });
    if (!menu) return res.status(404).json({ error: 'Menyu tapılmadı' });

    const meal = await Meal.findOne({ _id: mealId, userId: req.user._id });
    if (!meal) return res.status(404).json({ error: 'Yemək tapılmadı' });

    const exists = await MenuItem.findOne({ menuId: menu._id, mealId });
    if (exists) return res.status(409).json({ error: 'Bu yemək artıq menyudadır' });

    const item = await MenuItem.create({
      menuId:          menu._id,
      userId:          req.user._id,
      mealId,
      mealName:        meal.name,
      mealDescription: meal.description,
      mealImage:       meal.image || '',
      defaultDuration: meal.defaultDuration,
      date:            today(),
    });

    await broadcastMenuItems(req.user.shareId, menu._id);
    res.status(201).json({ item });
  } catch (err) { next(err); }
};

// DELETE /api/menus/:menuId/items/:itemId
const removeMenuItem = async (req, res, next) => {
  try {
    const menu = await Menu.findOne({ _id: req.params.menuId, userId: req.user._id });
    if (!menu) return res.status(404).json({ error: 'Menyu tapılmadı' });

    const item = await MenuItem.findOneAndDelete({ _id: req.params.itemId, menuId: menu._id });
    if (!item) return res.status(404).json({ error: 'Menyu elementi tapılmadı' });

    await broadcastMenuItems(req.user.shareId, menu._id);
    res.json({ message: 'Menyudan silindi' });
  } catch (err) { next(err); }
};

// ── Broadcast helpers ────────────────────────────────────────────────────────

async function broadcastMenus(shareId, userId) {
  const io = getIO();
  if (!io) return;
  const menus = await Menu.find({ userId, date: new Date().toISOString().split('T')[0] })
    .sort({ createdAt: 1 });
  io.to(`user:${shareId}`).emit('menus:update', { menus });
}

async function broadcastMenuItems(shareId, menuId) {
  const io = getIO();
  if (!io) return;
  const items = await MenuItem.find({ menuId }).sort({ createdAt: 1 });
  io.to(`user:${shareId}`).emit('menu:items:update', { menuId, items });
}

module.exports = {
  getTodayMenus, createMenu, deleteMenu,
  getMenuItems, addMenuItem, removeMenuItem,
  broadcastMenus,
};
