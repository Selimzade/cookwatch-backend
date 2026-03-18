const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();
const { register, login, getMe, getQRCode, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

router.post(
  '/register',
  authLimiter,
  [
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('İstifadəçi adı 3-30 simvol olmalıdır'),
    body('email').isEmail().withMessage('Düzgün e-poçt daxil edin').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Şifrə ən azı 6 simvol olmalıdır'),
  ],
  register
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Düzgün e-poçt daxil edin').normalizeEmail(),
    body('password').notEmpty().withMessage('Şifrə tələb olunur'),
  ],
  login
);

router.get('/me',        protect, getMe);
router.get('/qrcode',    protect, getQRCode);
router.patch('/profile', protect, updateProfile);

module.exports = router;
