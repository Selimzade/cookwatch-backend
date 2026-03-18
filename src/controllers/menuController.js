const MenuItem = require('../models/MenuItem');
const Meal = require('../models/Meal');
const { getIO } = require('../services/socketService');

const today = () => new Date().toISOString().split('T')[0];

const getTodayMenu = async (req, res, next) => {
  try {
    const items = await MenuItem.find({ userId: req.user._id, date: today(), isActive: true })
      .sort({ createdAt: 1 });
    res.json({ menu: items });
  } catch (err) { next(err); }
};

const addToMenu = async (req, res, next) => {
  try {
    const { mealId } = req.body;
    if (!mealId) return res.status(400).json({ error: 'mealId tələb olunur' });

    const meal = await Meal.findOne({ _id: mealId, userId: req.user._id });
    if (!meal) return res.status(404).json({ error: 'Yemək tapılmadı' });

    // Prevent duplicates for today
    const exists = await MenuItem.findOne({ userId: req.user._id, mealId, date: today(), isActive: true });
    if (exists) return res.status(409).json({ error: 'Bu yemək artıq bu günün menyusundadır' });

    const item = await MenuItem.create({
      userId: req.user._id,
      mealId,
      mealName:        meal.name,
      mealDescription: meal.description,
      mealImage:       meal.image || '',
      defaultDuration: meal.defaultDuration,
      date: today(),
    });

    await broadcastMenu(req.user.shareId, req.user._id);
    res.status(201).json({ item });
  } catch (err) { next(err); }
};

const removeFromMenu = async (req, res, next) => {
  try {
    const item = await MenuItem.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!item) return res.status(404).json({ error: 'Menyu elementi tapılmadı' });

    await broadcastMenu(req.user.shareId, req.user._id);
    res.json({ message: 'Menyudan silindi' });
  } catch (err) { next(err); }
};

async function broadcastMenu(shareId, userId) {
  const io = getIO();
  if (!io) return;
  const menu = await MenuItem.find({ userId, date: new Date().toISOString().split('T')[0], isActive: true })
    .sort({ createdAt: 1 });
  io.to(`user:${shareId}`).emit('menu:update', { menu });
}

module.exports = { getTodayMenu, addToMenu, removeFromMenu };
