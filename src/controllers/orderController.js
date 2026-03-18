const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const { getIO } = require('../services/socketService');

const today = () => new Date().toISOString().split('T')[0];

const getTodayOrders = async (req, res, next) => {
  try {
    await Order.autoComplete(req.user._id);
    const orders = await Order.find({ userId: req.user._id, date: today() })
      .sort({ createdAt: 1 });
    res.json({ orders });
  } catch (err) { next(err); }
};

const startOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) return res.status(404).json({ error: 'Sifariş tapılmadı' });
    if (order.status === Order.STATUS.COOKING)   return res.status(400).json({ error: 'Artıq bişirilir' });
    if (order.status === Order.STATUS.COMPLETED) return res.status(400).json({ error: 'Artıq tamamlanıb' });
    if (order.status === Order.STATUS.CANCELLED) return res.status(400).json({ error: 'Sifariş ləğv edilib' });

    // Use menu item's default duration unless body overrides
    const duration = req.body.duration || order.duration;
    const now = new Date();
    order.status    = Order.STATUS.COOKING;
    order.duration  = duration;
    order.startTime = now;
    order.endTime   = new Date(now.getTime() + duration * 60_000);
    await order.save();

    await broadcastOrders(req.user.shareId, req.user._id);
    res.json({ order });
  } catch (err) { next(err); }
};

const completeOrder = async (req, res, next) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status: Order.STATUS.COMPLETED },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Sifariş tapılmadı' });

    await broadcastOrders(req.user.shareId, req.user._id);
    res.json({ order });
  } catch (err) { next(err); }
};

const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status: Order.STATUS.CANCELLED },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Sifariş tapılmadı' });

    await broadcastOrders(req.user.shareId, req.user._id);
    res.json({ order });
  } catch (err) { next(err); }
};

async function broadcastOrders(shareId, userId) {
  const io = getIO();
  if (!io) return;
  const orders = await Order.find({ userId, date: new Date().toISOString().split('T')[0] })
    .sort({ createdAt: 1 });
  io.to(`user:${shareId}`).emit('orders:update', { orders });
}

module.exports = { getTodayOrders, startOrder, completeOrder, cancelOrder };
