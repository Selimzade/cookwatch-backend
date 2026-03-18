const rateLimit = require('express-rate-limit');

// Strict limiter for public QR endpoints (unauthenticated)
const publicViewLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
  skip: (req) => process.env.NODE_ENV === 'test',
});

// Auth endpoints limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, try again in 15 minutes' },
  skip: (req) => process.env.NODE_ENV === 'test',
});

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
  skip: (req) => process.env.NODE_ENV === 'test',
});

module.exports = { publicViewLimiter, authLimiter, apiLimiter };
