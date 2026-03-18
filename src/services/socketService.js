const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User  = require('../models/User');
const Menu  = require('../models/Menu');
const Order = require('../models/Order');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Authenticated parent: join own room via JWT
    socket.on('auth:join', async (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('shareId username');
        if (!user) return;

        socket.join(`user:${user.shareId}`);
        socket.data.userId  = user._id;
        socket.data.shareId = user.shareId;
        socket.emit('auth:joined', { shareId: user.shareId });
        console.log(`User ${user.username} joined room user:${user.shareId}`);
      } catch (err) {
        socket.emit('auth:error', { error: 'Invalid token' });
      }
    });

    // Public viewer: join a user's room via shareId (read-only)
    socket.on('view:join', async (shareId) => {
      if (!shareId || typeof shareId !== 'string') return;
      const isValidShareId = /^[0-9a-f-]{36}$/.test(shareId);
      if (!isValidShareId) return;

      socket.join(`user:${shareId}`);
      socket.data.viewingShareId = shareId;
      console.log(`Viewer joined room user:${shareId}`);

      // Send current state immediately on join
      try {
        const user = await User.findOne({ shareId }).select('_id');
        if (!user) return;

        const todayStr = new Date().toISOString().split('T')[0];
        await Order.autoComplete(user._id);

        const [menus, orders] = await Promise.all([
          Menu.find({ userId: user._id, date: todayStr }).sort({ createdAt: 1 }),
          Order.find({ userId: user._id, date: todayStr }).sort({ createdAt: 1 }),
        ]);

        socket.emit('menus:update',  { menus });
        socket.emit('orders:update', { orders });
      } catch (err) {
        console.error('Error fetching initial state for viewer:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Auto-complete expired orders every 30s
  setInterval(() => {
    autoCompleteOrdersAndBroadcast();
  }, 30_000);

  return io;
}

async function autoCompleteOrdersAndBroadcast() {
  try {
    const now     = new Date();
    const expired = await Order.find({ status: 'cooking', endTime: { $lte: now } })
      .populate('userId', 'shareId');

    if (expired.length === 0) return;

    const affected = new Set();
    for (const o of expired) {
      o.status = 'completed';
      await o.save();
      if (o.userId?.shareId) affected.add({ shareId: o.userId.shareId, userId: o.userId._id });
    }

    for (const { shareId, userId } of affected) {
      const todayStr = new Date().toISOString().split('T')[0];
      const orders = await Order.find({ userId, date: todayStr }).sort({ createdAt: 1 });
      if (io) io.to(`user:${shareId}`).emit('orders:update', { orders });
    }
  } catch (err) {
    console.error('autoComplete orders error:', err.message);
  }
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO };
