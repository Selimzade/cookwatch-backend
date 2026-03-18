const User     = require('../models/User');
const MenuItem = require('../models/MenuItem');
const Order    = require('../models/Order');
const { getIO } = require('../services/socketService');

const today = () => new Date().toISOString().split('T')[0];

// GET /api/public/view/:shareId
const getPublicView = async (req, res, next) => {
  try {
    const { shareId } = req.params;

    const user = await User.findOne({ shareId }).select('username displayName shareId');
    if (!user) return res.status(404).json({ error: 'Profil tapılmadı' });

    await Order.autoComplete(user._id);

    const [menu, orders] = await Promise.all([
      MenuItem.find({ userId: user._id, date: today(), isActive: true }).sort({ createdAt: 1 }),
      Order.find({ userId: user._id, date: today() }).sort({ createdAt: 1 }),
    ]);

    res.json({
      user: {
        username:    user.username,
        displayName: user.displayName || user.username,
        shareId:     user.shareId,
      },
      date:   today(),
      menu:   menu.map(serializeMenuItem),
      orders: orders.map(serializeOrder),
      serverTime: new Date().toISOString(),
    });
  } catch (err) { next(err); }
};

// POST /api/public/order/:shareId  — unauthenticated order placement
const placeOrder = async (req, res, next) => {
  try {
    const { shareId } = req.params;
    const { menuItemId } = req.body;

    if (!menuItemId) return res.status(400).json({ error: 'menuItemId tələb olunur' });

    const user = await User.findOne({ shareId }).select('_id shareId');
    if (!user) return res.status(404).json({ error: 'Profil tapılmadı' });

    const item = await MenuItem.findOne({ _id: menuItemId, userId: user._id, date: today(), isActive: true });
    if (!item) return res.status(404).json({ error: 'Menyu elementi tapılmadı' });

    const order = await Order.create({
      userId:          user._id,
      menuItemId:      item._id,
      mealName:        item.mealName,
      mealDescription: item.mealDescription,
      mealImage:       item.mealImage,
      duration:        item.defaultDuration,
      date:            today(),
    });

    // Broadcast to parent + all viewers
    const io = getIO();
    if (io) {
      const orders = await Order.find({ userId: user._id, date: today() }).sort({ createdAt: 1 });
      io.to(`user:${shareId}`).emit('orders:update', { orders });
    }

    res.status(201).json({ order: serializeOrder(order) });
  } catch (err) { next(err); }
};

function serializeMenuItem(item) {
  return {
    id:              item._id,
    mealName:        item.mealName,
    mealDescription: item.mealDescription,
    mealImage:       item.mealImage,
    defaultDuration: item.defaultDuration,
  };
}

function serializeOrder(order) {
  const obj = order.toObject ? order.toObject({ virtuals: true }) : order;
  return {
    id:              obj._id,
    menuItemId:      obj.menuItemId,
    mealName:        obj.mealName,
    mealDescription: obj.mealDescription,
    mealImage:       obj.mealImage,
    status:          obj.status,
    duration:        obj.duration,
    startTime:       obj.startTime,
    endTime:         obj.endTime,
    remainingSeconds: obj.remainingSeconds ?? null,
    date:            obj.date,
    createdAt:       obj.createdAt,
  };
}

module.exports = { getPublicView, placeOrder };
