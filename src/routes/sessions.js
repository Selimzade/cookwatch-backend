const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  getTodaySessions,
  getSessions,
  createSession,
  startSession,
  completeSession,
  updateSessionDuration,
  deleteSession,
} = require('../controllers/sessionController');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

router.use(protect);
router.use(apiLimiter);

router.get('/today', getTodaySessions);
router.get('/', getSessions);

router.post(
  '/',
  [
    body('mealId').notEmpty().withMessage('mealId is required'),
    body('duration').optional().isInt({ min: 1, max: 720 }).withMessage('Duration must be 1-720 minutes'),
  ],
  createSession
);

router.post('/:id/start', startSession);
router.post('/:id/complete', completeSession);
router.patch('/:id/duration', updateSessionDuration);
router.delete('/:id', deleteSession);

module.exports = router;
