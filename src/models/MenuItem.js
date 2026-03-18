const mongoose = require('mongoose');

// Today's menu — meals parent makes available for children to order
const menuItemSchema = new mongoose.Schema(
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
    // Denormalized snapshot
    mealName:        { type: String, required: true, trim: true },
    mealDescription: { type: String, default: '' },
    mealImage:       { type: String, default: '' },
    defaultDuration: { type: Number, default: 30, min: 1, max: 720 },
    date:            { type: String, required: true, index: true }, // YYYY-MM-DD
    isActive:        { type: Boolean, default: true },
  },
  { timestamps: true }
);

menuItemSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
