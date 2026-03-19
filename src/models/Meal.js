const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Meal name is required'],
      trim: true,
      maxlength: [100, 'Meal name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    // Default cooking duration in minutes
    defaultDuration: {
      type: Number,
      default: 30,
      min: [1, 'Duration must be at least 1 minute'],
      max: [720, 'Duration cannot exceed 12 hours'],
    },
    // Track how many times this meal has been cooked (for AI suggestions)
    timesCooked: {
      type: Number,
      default: 0,
    },
    lastCookedAt: {
      type: Date,
    },
    // Base64 compressed image (max ~4MB after compression)
    image: {
      type: String,
      default: '',
    },
    // Category (e.g. "İçki", "Əsas Yemək", "Desert")
    category: {
      type: String,
      trim: true,
      maxlength: [50, 'Category cannot exceed 50 characters'],
      default: '',
    },
    // Tags for better AI suggestions
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 30,
    }],
  },
  {
    timestamps: true,
  }
);

// Compound index for user's meal list queries
mealSchema.index({ userId: 1, name: 1 });
mealSchema.index({ userId: 1, timesCooked: -1 });

module.exports = mongoose.model('Meal', mealSchema);
