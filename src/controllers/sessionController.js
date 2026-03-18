const { validationResult } = require('express-validator');
const CookingSession = require('../models/CookingSession');
const Meal = require('../models/Meal');
const { getIO } = require('../services/socketService');

const getTodaySessions = async (req, res, next) => {
  try {
    const today = getTodayDate();
    await CookingSession.autoComplete(req.user._id);

    const sessions = await CookingSession.find({
      userId: req.user._id,
      sessionDate: today,
    }).sort({ order: 1, createdAt: 1 });

    res.json({ sessions, date: today });
  } catch (err) {
    next(err);
  }
};

const getSessions = async (req, res, next) => {
  try {
    const { date, limit = 30 } = req.query;
    const query = { userId: req.user._id };
    if (date) query.sessionDate = date;

    const sessions = await CookingSession.find(query)
      .sort({ sessionDate: -1, order: 1 })
      .limit(parseInt(limit));

    res.json({ sessions });
  } catch (err) {
    next(err);
  }
};

const createSession = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { mealId, duration } = req.body;
    const today = getTodayDate();

    const meal = await Meal.findOne({ _id: mealId, userId: req.user._id });
    if (!meal) return res.status(404).json({ error: 'Meal not found' });

    // Count existing sessions today for order
    const count = await CookingSession.countDocuments({ userId: req.user._id, sessionDate: today });

    const session = await CookingSession.create({
      userId: req.user._id,
      mealId,
      mealName: meal.name,
      mealDescription: meal.description,
      mealImage: meal.image || '',
      duration: duration || meal.defaultDuration,
      sessionDate: today,
      status: CookingSession.STATUS.NOT_STARTED,
      order: count,
    });

    emitSessionUpdate(req.user.shareId, await getTodaySessionsData(req.user._id));
    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
};

const startSession = async (req, res, next) => {
  try {
    const session = await CookingSession.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === CookingSession.STATUS.COOKING) {
      return res.status(400).json({ error: 'Session already cooking' });
    }
    if (session.status === CookingSession.STATUS.COMPLETED) {
      return res.status(400).json({ error: 'Session already completed' });
    }

    const now = new Date();
    const endTime = new Date(now.getTime() + session.duration * 60 * 1000);

    session.status = CookingSession.STATUS.COOKING;
    session.startTime = now;
    session.endTime = endTime;
    await session.save();

    // Update meal stats
    await Meal.findByIdAndUpdate(session.mealId, {
      $inc: { timesCooked: 1 },
      lastCookedAt: now,
    });

    emitSessionUpdate(req.user.shareId, await getTodaySessionsData(req.user._id));
    res.json({ session });
  } catch (err) {
    next(err);
  }
};

const completeSession = async (req, res, next) => {
  try {
    const session = await CookingSession.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status: CookingSession.STATUS.COMPLETED },
      { new: true }
    );

    if (!session) return res.status(404).json({ error: 'Session not found' });

    emitSessionUpdate(req.user.shareId, await getTodaySessionsData(req.user._id));
    res.json({ session });
  } catch (err) {
    next(err);
  }
};

const updateSessionDuration = async (req, res, next) => {
  try {
    const { duration } = req.body;
    if (!duration || duration < 1) {
      return res.status(400).json({ error: 'Invalid duration' });
    }

    const session = await CookingSession.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === CookingSession.STATUS.COMPLETED) {
      return res.status(400).json({ error: 'Cannot update completed session' });
    }

    session.duration = duration;
    if (session.status === CookingSession.STATUS.COOKING && session.startTime) {
      session.endTime = new Date(session.startTime.getTime() + duration * 60 * 1000);
    }
    await session.save();

    emitSessionUpdate(req.user.shareId, await getTodaySessionsData(req.user._id));
    res.json({ session });
  } catch (err) {
    next(err);
  }
};

const deleteSession = async (req, res, next) => {
  try {
    const session = await CookingSession.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    emitSessionUpdate(req.user.shareId, await getTodaySessionsData(req.user._id));
    res.json({ message: 'Session removed' });
  } catch (err) {
    next(err);
  }
};

// Helpers
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

async function getTodaySessionsData(userId) {
  const today = getTodayDate();
  return CookingSession.find({ userId, sessionDate: today }).sort({ order: 1, createdAt: 1 });
}

function emitSessionUpdate(shareId, sessionsPromise) {
  Promise.resolve(sessionsPromise).then((sessions) => {
    const io = getIO();
    if (io) {
      io.to(`user:${shareId}`).emit('sessions:update', { sessions });
    }
  }).catch(console.error);
}

module.exports = {
  getTodaySessions,
  getSessions,
  createSession,
  startSession,
  completeSession,
  updateSessionDuration,
  deleteSession,
};
