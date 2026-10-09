const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const createAuthLimiter = () => {
  return rateLimit({
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
};

let activeLimiter = createAuthLimiter();

const authLimiter = (req, res, next) => {
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    return next();
  }
  return activeLimiter(req, res, next);
};

module.exports = {
  authLimiter
};
