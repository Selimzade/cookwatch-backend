const mongoose = require('mongoose');

const STATUS = {
  NOT_STARTED: 'not_started',
  COOKING: 'cooking',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const cookingSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meal',
      required: true,
    },
    // Denormalized for display even if meal is deleted
    mealName: {
      type: String,
      required: true,
      trim: true,
    },
    mealDescription: {
      type: String,
      default: '',
    },
    // Duration in minutes
    duration: {
      type: Number,
      required: true,
      min: 1,
      max: 720,
    },
    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.NOT_STARTED,
      index: true,
    },
    // Set when user clicks "Start Cooking"
    startTime: {
      type: Date,
    },
    // Calculated: startTime + duration in ms
    endTime: {
      type: Date,
    },
    // Date string YYYY-MM-DD for "today's meals" queries
    sessionDate: {
      type: String,
      required: true,
      index: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    // Order within a day's sessions
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: remaining seconds (positive = time left, negative = overdue)
cookingSessionSchema.virtual('remainingSeconds').get(function () {
  if (this.status !== STATUS.COOKING || !this.endTime) return null;
  return Math.ceil((this.endTime - Date.now()) / 1000);
});

// Virtual: elapsed seconds since start
cookingSessionSchema.virtual('elapsedSeconds').get(function () {
  if (!this.startTime) return 0;
  return Math.floor((Date.now() - this.startTime) / 1000);
});

// Compound indexes for common queries
cookingSessionSchema.index({ userId: 1, sessionDate: 1 });
cookingSessionSchema.index({ userId: 1, status: 1 });

// Auto-complete sessions that exceeded their duration
cookingSessionSchema.statics.autoComplete = async function (userId) {
  const now = new Date();
  await this.updateMany(
    {
      userId,
      status: STATUS.COOKING,
      endTime: { $lte: now },
    },
    { status: STATUS.COMPLETED }
  );
};

cookingSessionSchema.statics.STATUS = STATUS;

module.exports = mongoose.model('CookingSession', cookingSessionSchema);
