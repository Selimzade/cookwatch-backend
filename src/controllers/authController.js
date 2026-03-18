const { validationResult } = require('express-validator');
const User    = require('../models/User');
const { signToken } = require('../middleware/auth');
const QRCode  = require('qrcode');

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, email, password, displayName } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      if (existing.email === email.toLowerCase()) {
        return res.status(409).json({ error: 'Bu e-poçt artıq istifadə olunur' });
      }
      return res.status(409).json({ error: 'Bu istifadəçi adı artıq mövcuddur' });
    }

    const user  = await User.create({ username, email, password, displayName });
    const token = signToken(user._id);

    res.status(201).json({ token, user: user.toPublicProfile() });
  } catch (err) { next(err); }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'E-poçt və ya şifrə yanlışdır' });
    }

    const token = signToken(user._id);
    res.json({ token, user: user.toPublicProfile() });
  } catch (err) { next(err); }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ user: req.user.toPublicProfile() });
};

// GET /api/auth/qrcode
const getQRCode = async (req, res, next) => {
  try {
    const baseUrl  = process.env.APP_BASE_URL || 'http://localhost:5173';
    const shareUrl = `${baseUrl}/view/${req.user.shareId}`;

    const qrDataUrl = await QRCode.toDataURL(shareUrl, {
      width: 300, margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    });

    res.json({ qrCode: qrDataUrl, shareUrl, shareId: req.user.shareId });
  } catch (err) { next(err); }
};

// PATCH /api/auth/profile
const updateProfile = async (req, res, next) => {
  try {
    const { displayName } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { displayName },
      { new: true, runValidators: true }
    );
    res.json({ user: user.toPublicProfile() });
  } catch (err) { next(err); }
};

module.exports = { register, login, getMe, getQRCode, updateProfile };
