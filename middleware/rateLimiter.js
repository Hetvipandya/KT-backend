const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// Configurable Rate limiter for authentication endpoints: 10 requests per 15 minutes per IP by default
const authLimiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS
    ? Number(process.env.RATE_LIMIT_WINDOW_MS)
    : (env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: process.env.RATE_LIMIT_MAX
    ? Number(process.env.RATE_LIMIT_MAX)
    : (process.env.NODE_ENV === 'test' ? 1000 : (env.RATE_LIMIT_MAX || 10)),
  statusCode: 429,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

module.exports = {
  authLimiter
};
