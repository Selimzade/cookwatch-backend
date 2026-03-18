const User = require('../models/User');
const CookingSession = require('../models/CookingSession');

const getPublicView = async (req, res, next) => {
  try {
    const { shareId } = req.params;

    const user = await User.findOne({ shareId }).select('username displayName shareId');
    if (!user) return res.status(404).json({ error: 'Profile not found' });

    const today = new Date().toISOString().split('T')[0];
    await CookingSession.autoComplete(user._id);

    const sessions = await CookingSession.find({
      userId: user._id,
      sessionDate: today,
    }).sort({ order: 1, createdAt: 1 });

    // Determine overall status
    const activeCooking = sessions.find((s) => s.status === 'cooking');
    const allDone = sessions.length > 0 && sessions.every((s) => s.status === 'completed');
    const noneStarted = sessions.every((s) => s.status === 'not_started');

    let overallStatus = 'idle';
    if (activeCooking) overallStatus = 'cooking';
    else if (allDone) overallStatus = 'done';
    else if (!noneStarted) overallStatus = 'partial';

    res.json({
      user: {
        username: user.username,
        displayName: user.displayName || user.username,
        shareId: user.shareId,
      },
      date: today,
      sessions: sessions.map(serializeSession),
      overallStatus,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
};

// Serialize session with live remaining seconds
function serializeSession(session) {
  const obj = session.toObject({ virtuals: true });
  return {
    id: obj._id,
    mealName: obj.mealName,
    mealDescription: obj.mealDescription,
    duration: obj.duration,
    status: obj.status,
    startTime: obj.startTime,
    endTime: obj.endTime,
    remainingSeconds: obj.remainingSeconds,
    elapsedSeconds: obj.elapsedSeconds,
    sessionDate: obj.sessionDate,
  };
}

module.exports = { getPublicView };
