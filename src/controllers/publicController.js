const User     = require('../models/User');
const Menu     = require('../models/Menu');
const MenuItem = require('../models/MenuItem');
const Order    = require('../models/Order');
const { getIO } = require('../services/socketService');

const today = () => new Date().toISOString().split('T')[0];

// GET /api/public/view/:shareId  — list of today's menus
const getPublicView = async (req, res, next) => {
  try {
    const { shareId } = req.params;
    const user = await User.findOne({ shareId }).select('username displayName shareId');
    if (!user) return res.status(404).json({ error: 'Profil tapılmadı' });

    const menus = await Menu.find({ userId: user._id, date: today() }).sort({ createdAt: 1 });

    res.json({
      user: {
        username:    user.username,
        displayName: user.displayName || user.username,
        shareId:     user.shareId,
      },
      date:  today(),
      menus: menus.map(serializeMenu),
      serverTime: new Date().toISOString(),
    });
  } catch (err) { next(err); }
};

// GET /api/public/:shareId/menu/:menuId  — items + orders for one menu
const getPublicMenu = async (req, res, next) => {
  try {
    const { shareId, menuId } = req.params;
    const user = await User.findOne({ shareId }).select('_id shareId');
    if (!user) return res.status(404).json({ error: 'Profil tapılmadı' });

    const menu = await Menu.findOne({ _id: menuId, userId: user._id, date: today() });
    if (!menu) return res.status(404).json({ error: 'Menyu tapılmadı' });

    await Order.autoComplete(user._id);

    const [items, orders] = await Promise.all([
      MenuItem.find({ menuId: menu._id }).sort({ createdAt: 1 }),
      Order.find({ userId: user._id, menuId: menu._id, date: today() }).sort({ createdAt: 1 }),
    ]);

    res.json({
      menu:   serializeMenu(menu),
      items:  items.map(serializeMenuItem),
      orders: orders.map(serializeOrder),
    });
  } catch (err) { next(err); }
};

// POST /api/public/:shareId/menu/:menuId/order  { menuItemId }  — unauthenticated
const placeOrder = async (req, res, next) => {
  try {
    const { shareId, menuId } = req.params;
    const { menuItemId } = req.body;
    if (!menuItemId) return res.status(400).json({ error: 'menuItemId tələb olunur' });

    const user = await User.findOne({ shareId }).select('_id shareId');
    if (!user) return res.status(404).json({ error: 'Profil tapılmadı' });

    const menu = await Menu.findOne({ _id: menuId, userId: user._id, date: today() });
    if (!menu) return res.status(404).json({ error: 'Menyu tapılmadı' });
    if (!menu.isAccepting) return res.status(403).json({ error: 'Bu menyu üçün sifariş qəbulu bağlıdır' });

    const item = await MenuItem.findOne({ _id: menuItemId, menuId: menu._id });
    if (!item) return res.status(404).json({ error: 'Menyu elementi tapılmadı' });

    // One order per menu item — regardless of status (even if cancelled)
    const existing = await Order.findOne({ menuItemId: item._id, date: today() });
    if (existing) return res.status(409).json({ error: 'Bu yemək artıq sifariş edilib' });

    const order = await Order.create({
      userId:          user._id,
      menuId:          menu._id,
      menuItemId:      item._id,
      mealName:        item.mealName,
      mealDescription: item.mealDescription,
      mealImage:       item.mealImage,
      duration:        item.defaultDuration,
      date:            today(),
    });

    // Broadcast updated orders to the room
    const io = getIO();
    if (io) {
      const orders = await Order.find({ userId: user._id, date: today() }).sort({ createdAt: 1 });
      io.to(`user:${shareId}`).emit('orders:update', { orders });
    }

    res.status(201).json({ order: serializeOrder(order) });
  } catch (err) { next(err); }
};

// ── Serializers ───────────────────────────────────────────────────────────────

function serializeMenu(m) {
  return { id: m._id, name: m.name, date: m.date, isAccepting: m.isAccepting };
}

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
    menuId:          obj.menuId,
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

module.exports = { getPublicView, getPublicMenu, placeOrder };
