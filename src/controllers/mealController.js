const { validationResult } = require('express-validator');
const Meal = require('../models/Meal');
const aiService = require('../services/aiService');

const getMeals = async (req, res, next) => {
  try {
    const { search, sort = '-timesCooked' } = req.query;
    const query = { userId: req.user._id };

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const meals = await Meal.find(query).sort(sort).limit(100);
    res.json({ meals });
  } catch (err) {
    next(err);
  }
};

const getMeal = async (req, res, next) => {
  try {
    const meal = await Meal.findOne({ _id: req.params.id, userId: req.user._id });
    if (!meal) return res.status(404).json({ error: 'Meal not found' });
    res.json({ meal });
  } catch (err) {
    next(err);
  }
};

const createMeal = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, description, defaultDuration, tags } = req.body;

    // Check for duplicate name for this user
    const existing = await Meal.findOne({
      userId: req.user._id,
      name: { $regex: `^${name}$`, $options: 'i' },
    });
    if (existing) {
      return res.status(409).json({ error: 'You already have a meal with that name' });
    }

    const meal = await Meal.create({
      userId: req.user._id,
      name,
      description: description || '',
      defaultDuration: defaultDuration || 30,
      tags: tags || [],
    });

    res.status(201).json({ meal });
  } catch (err) {
    next(err);
  }
};

const updateMeal = async (req, res, next) => {
  try {
    const { name, description, defaultDuration, tags } = req.body;
    const meal = await Meal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { name, description, defaultDuration, tags },
      { new: true, runValidators: true }
    );
    if (!meal) return res.status(404).json({ error: 'Meal not found' });
    res.json({ meal });
  } catch (err) {
    next(err);
  }
};

const deleteMeal = async (req, res, next) => {
  try {
    const meal = await Meal.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!meal) return res.status(404).json({ error: 'Meal not found' });
    res.json({ message: 'Meal deleted' });
  } catch (err) {
    next(err);
  }
};

const getSuggestions = async (req, res, next) => {
  try {
    // Fetch user's meals sorted by frequency
    const meals = await Meal.find({ userId: req.user._id })
      .sort({ timesCooked: -1, lastCookedAt: -1 })
      .limit(20);

    const suggestions = await aiService.suggestMeals(meals);
    res.json({ suggestions });
  } catch (err) {
    // AI is optional — fall back gracefully
    const meals = await Meal.find({ userId: req.user._id })
      .sort({ timesCooked: -1 })
      .limit(5);
    res.json({
      suggestions: meals.map((m) => ({
        name: m.name,
        reason: `Cooked ${m.timesCooked} times`,
        suggestedDuration: m.defaultDuration,
      })),
    });
  }
};

const generateDescription = async (req, res, next) => {
  try {
    const { mealName } = req.body;
    if (!mealName) return res.status(400).json({ error: 'mealName is required' });

    const description = await aiService.generateMealDescription(mealName);
    res.json({ description });
  } catch (err) {
    res.json({ description: '' });
  }
};

const suggestDuration = async (req, res, next) => {
  try {
    const { mealName } = req.body;
    if (!mealName) return res.status(400).json({ error: 'mealName is required' });

    // Check if user already has this meal
    const existing = await Meal.findOne({
      userId: req.user._id,
      name: { $regex: `^${mealName}$`, $options: 'i' },
    });

    if (existing) {
      return res.json({ duration: existing.defaultDuration, source: 'history' });
    }

    const duration = await aiService.suggestDuration(mealName);
    res.json({ duration, source: 'ai' });
  } catch (err) {
    res.json({ duration: 30, source: 'default' });
  }
};

module.exports = {
  getMeals,
  getMeal,
  createMeal,
  updateMeal,
  deleteMeal,
  getSuggestions,
  generateDescription,
  suggestDuration,
};
