const mongoose = require('mongoose');

// A named menu for a specific day (e.g. "Səhər yeməyi", "Nahar")
const menuSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name:        { type: String, required: true, trim: true },
    date:        { type: String, required: true, index: true }, // YYYY-MM-DD
    // When false, children can no longer place orders (parent accepted the first order)
    isAccepting: { type: Boolean, default: true },
  },
  { timestamps: true }
);

menuSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Menu', menuSchema);
