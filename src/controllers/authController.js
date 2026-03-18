const { validationResult } = require('express-validator');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { generateOtp, sendRegisterOtp, sendResetOtp } = require('../services/emailService');
const QRCode = require('qrcode');

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Registration: step 1 — create unverified user + send OTP ─────────────────
// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, email, password, displayName } = req.body;

    // Check duplicates before creating
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      if (existing.email === email.toLowerCase()) {
        return res.status(409).json({ error: 'Bu e-poçt artıq istifadə olunur' });
      }
      return res.status(409).json({ error: 'Bu istifadəçi adı artıq mövcuddur' });
    }

    const otp      = generateOtp();
    const otpExpiry = new Date(Date.now() + OTP_TTL_MS);

    const user = await User.create({
      username, email, password, displayName,
      isVerified: false,
      otp,
      otpExpiry,
    });

    // Send OTP — if email fails in dev, return OTP in response as a hint
    let devOtp = null;
    try {
      await sendRegisterOtp(email, otp);
    } catch (mailErr) {
      console.error('Registration OTP email failed:', mailErr.message);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] Registration OTP for ${email}: ${otp}`);
        devOtp = otp; // expose in response only in dev/test
      }
    }

    res.status(201).json({
      message: devOtp
        ? `E-poçt göndərilmədi (dev rejimi). OTP: ${devOtp}`
        : 'OTP kodu e-poçtunuza göndərildi. Zəhmət olmasa yoxlayın.',
      email: user.email,
      ...(devOtp && { devOtp }),
    });
  } catch (err) { next(err); }
};

// ── Registration: step 2 — verify OTP → activate + return JWT ────────────────
// POST /api/auth/verify-otp
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'E-poçt və OTP kodu tələb olunur' });
    }

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+otp +otpExpiry +password');
    if (!user) return res.status(404).json({ error: 'İstifadəçi tapılmadı' });

    if (user.isVerified) {
      const token = signToken(user._id);
      return res.json({ token, user: user.toPublicProfile() });
    }

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ error: 'OTP kodu yanlışdır' });
    }
    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(400).json({ error: 'OTP kodunun müddəti bitib. Yenidən qeydiyyatdan keçin.' });
    }

    // Activate user
    user.isVerified = true;
    user.otp        = undefined;
    user.otpExpiry  = undefined;
    await user.save();

    const token = signToken(user._id);
    res.json({ token, user: user.toPublicProfile() });
  } catch (err) { next(err); }
};

// ── Login ─────────────────────────────────────────────────────────────────────
// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password +otp +otpExpiry');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'E-poçt və ya şifrə yanlışdır' });
    }

    // Backward-compat: users who registered before OTP was introduced have
    // isVerified=false but no otp set → auto-verify on first login.
    if (!user.isVerified && !user.otp) {
      user.isVerified = true;
      await user.save();
    }

    // If user registered via new flow but hasn't verified yet → resend OTP
    if (!user.isVerified) {
      const otp       = generateOtp();
      const otpExpiry = new Date(Date.now() + OTP_TTL_MS);
      user.otp        = otp;
      user.otpExpiry  = otpExpiry;
      await user.save();

      let devOtp = null;
      try {
        await sendRegisterOtp(user.email, otp);
      } catch (e) {
        console.error('Resend OTP email failed:', e.message);
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[DEV] OTP for ${user.email}: ${otp}`);
          devOtp = otp;
        }
      }

      return res.status(403).json({
        error: 'Hesabınız hələ təsdiqlənməyib',
        requiresVerification: true,
        email: user.email,
        ...(devOtp && { devOtp }),
      });
    }

    const token = signToken(user._id);
    res.json({ token, user: user.toPublicProfile() });
  } catch (err) { next(err); }
};

// ── Forgot password: step 1 — send reset OTP ─────────────────────────────────
// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-poçt tələb olunur' });

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+resetOtp +resetOtpExpiry');

    // Always return success to prevent email enumeration
    if (!user || !user.isVerified) {
      return res.json({ message: 'Əgər bu e-poçt mövcuddursa, OTP kodu göndərildi' });
    }

    const otp            = generateOtp();
    user.resetOtp        = otp;
    user.resetOtpExpiry  = new Date(Date.now() + OTP_TTL_MS);
    await user.save();

    try {
      await sendResetOtp(user.email, otp);
    } catch (e) {
      console.error('Reset OTP email failed:', e.message);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] Reset OTP for ${user.email}: ${otp}`);
      }
    }

    res.json({ message: 'OTP kodu e-poçtunuza göndərildi', email: user.email });
  } catch (err) { next(err); }
};

// ── Forgot password: step 2 — verify OTP + set new password ──────────────────
// POST /api/auth/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ error: 'E-poçt, OTP kodu və yeni şifrə tələb olunur' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Şifrə ən azı 6 simvol olmalıdır' });
    }

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+resetOtp +resetOtpExpiry +password');
    if (!user) return res.status(404).json({ error: 'İstifadəçi tapılmadı' });

    if (!user.resetOtp || user.resetOtp !== otp) {
      return res.status(400).json({ error: 'OTP kodu yanlışdır' });
    }
    if (!user.resetOtpExpiry || user.resetOtpExpiry < new Date()) {
      return res.status(400).json({ error: 'OTP kodunun müddəti bitib' });
    }

    user.password        = password;  // pre-save hook will hash it
    user.resetOtp        = undefined;
    user.resetOtpExpiry  = undefined;
    await user.save();

    const token = signToken(user._id);
    res.json({ token, user: user.toPublicProfile(), message: 'Şifrə uğurla yeniləndi' });
  } catch (err) { next(err); }
};

// ── Profile ───────────────────────────────────────────────────────────────────

const getMe = async (req, res) => {
  res.json({ user: req.user.toPublicProfile() });
};

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

module.exports = { register, verifyOtp, login, forgotPassword, resetPassword, getMe, getQRCode, updateProfile };
