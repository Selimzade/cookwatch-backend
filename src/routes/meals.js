const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  getMeals,
  getMeal,
  createMeal,
  updateMeal,
  deleteMeal,
  getSuggestions,
  generateDescription,
  suggestDuration,
} = require('../controllers/mealController');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

router.use(protect);
router.use(apiLimiter);

router.get('/', getMeals);
router.get('/suggestions', getSuggestions);
router.get('/:id', getMeal);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Meal name is required').isLength({ max: 100 }),
    body('defaultDuration').optional().isInt({ min: 1, max: 720 }).withMessage('Duration must be 1-720 minutes'),
  ],
  createMeal
);

router.post('/ai/describe', generateDescription);
router.post('/ai/duration', suggestDuration);

router.patch('/:id', updateMeal);
router.delete('/:id', deleteMeal);

module.exports = router;
