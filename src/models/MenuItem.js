const mongoose = require('mongoose');

// A meal inside a specific named menu
const menuItemSchema = new mongoose.Schema(
  {
    menuId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Menu',
      required: true,
      index: true,
    },
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
  },
  { timestamps: true }
);

menuItemSchema.index({ menuId: 1 });
menuItemSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
