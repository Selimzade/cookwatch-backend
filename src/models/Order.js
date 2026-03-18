const mongoose = require('mongoose');

const STATUS = {
  PENDING:   'pending',
  COOKING:   'cooking',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const orderSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },

    // Denormalized snapshot
    mealName:        { type: String, required: true, trim: true },
    mealDescription: { type: String, default: '' },
    mealImage:       { type: String, default: '' },

    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.PENDING,
      index: true,
    },
    duration:  { type: Number, default: 30, min: 1, max: 720 }, // minutes
    startTime: { type: Date },
    endTime:   { type: Date },
    date:      { type: String, required: true, index: true },  // YYYY-MM-DD
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

orderSchema.virtual('remainingSeconds').get(function () {
  if (this.status !== STATUS.COOKING || !this.endTime) return null;
  return Math.max(0, Math.ceil((this.endTime - Date.now()) / 1000));
});

orderSchema.index({ userId: 1, date: 1 });

// Auto-complete orders whose timer expired
orderSchema.statics.autoComplete = async function (userId) {
  await this.updateMany(
    { userId, status: STATUS.COOKING, endTime: { $lte: new Date() } },
    { status: STATUS.COMPLETED }
  );
};

orderSchema.statics.STATUS = STATUS;

module.exports = mongoose.model('Order', orderSchema);
