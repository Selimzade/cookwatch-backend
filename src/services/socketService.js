const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CookingSession = require('../models/CookingSession');

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

    // Authenticated users: join their own room via JWT
    socket.on('auth:join', async (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('shareId username');
        if (!user) return;

        socket.join(`user:${user.shareId}`);
        socket.data.userId = user._id;
        socket.data.shareId = user.shareId;
        socket.emit('auth:joined', { shareId: user.shareId });
        console.log(`User ${user.username} joined room user:${user.shareId}`);
      } catch (err) {
        socket.emit('auth:error', { error: 'Invalid token' });
      }
    });

    // Public viewers: join a user's room via shareId (read-only)
    socket.on('view:join', async (shareId) => {
      if (!shareId || typeof shareId !== 'string') return;
      // Sanitize shareId — must be a valid UUID format
      const isValidShareId = /^[0-9a-f-]{36}$/.test(shareId);
      if (!isValidShareId) return;

      socket.join(`user:${shareId}`);
      socket.data.viewingShareId = shareId;
      console.log(`Viewer joined room user:${shareId}`);

      // Send current state immediately on join
      try {
        const user = await User.findOne({ shareId }).select('_id username displayName');
        if (!user) return;

        const today = new Date().toISOString().split('T')[0];
        await CookingSession.autoComplete(user._id);
        const sessions = await CookingSession.find({
          userId: user._id,
          sessionDate: today,
        }).sort({ order: 1, createdAt: 1 });

        socket.emit('sessions:update', { sessions });
      } catch (err) {
        console.error('Error fetching initial state for viewer:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Broadcast session updates every 30s to keep timers in sync for edge cases
  setInterval(() => {
    autoCompleteAndBroadcast();
  }, 30_000);

  return io;
}

async function autoCompleteAndBroadcast() {
  try {
    const now = new Date();
    const expiredSessions = await CookingSession.find({
      status: 'cooking',
      endTime: { $lte: now },
    }).populate('userId', 'shareId');

    if (expiredSessions.length === 0) return;

    const affectedShareIds = new Set();
    for (const session of expiredSessions) {
      session.status = 'completed';
      await session.save();
      if (session.userId?.shareId) {
        affectedShareIds.add(session.userId.shareId);
      }
    }

    // Broadcast updated sessions to affected rooms
    for (const shareId of affectedShareIds) {
      const user = await User.findOne({ shareId }).select('_id');
      if (!user) continue;
      const today = new Date().toISOString().split('T')[0];
      const sessions = await CookingSession.find({
        userId: user._id,
        sessionDate: today,
      }).sort({ order: 1, createdAt: 1 });

      if (io) {
        io.to(`user:${shareId}`).emit('sessions:update', { sessions });
      }
    }
  } catch (err) {
    console.error('autoComplete broadcast error:', err.message);
  }
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO };
