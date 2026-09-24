const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const FinanceUser = require('../models/FinanceUser');

// Ultra-fast in-memory user cache (60s TTL) to bypass MongoDB lookup on repeated API calls
const userCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

const invalidateUserCache = (userId) => {
  if (userId) userCache.delete(userId.toString());
};

/**
 * Express middleware to authenticate requests with JWT access token
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @param {import('express').NextFunction} next 
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token is missing or invalid'
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;

    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Access token has expired or is invalid'
      });
    }

    const userIdStr = decoded.userId;
    const now = Date.now();
    let user;

    // Check fast in-memory cache
    if (userCache.has(userIdStr)) {
      const cached = userCache.get(userIdStr);
      if (now - cached.timestamp < CACHE_TTL_MS) {
        user = cached.user;
      } else {
        userCache.delete(userIdStr);
      }
    }

    // Cache miss: fetch from MongoDB
    if (!user) {
      user = await User.findById(userIdStr);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication failed: User no longer exists'
        });
      }
      userCache.set(userIdStr, { user, timestamp: now });
    }

    const financeUser = await FinanceUser.findOne({ userId: user._id }).lean();
    if (financeUser) {
      const originalUserId = user._id;
      const financeUserData = { ...financeUser };
      delete financeUserData._id;
      delete financeUserData.userId;

      const merged = {
        ...user,
        ...financeUserData,
        companyId: financeUserData.companyId ?? user.companyId ?? null,
        branchId: financeUserData.branchId ?? user.branchId ?? null,
        financialYearId: financeUserData.financialYearId ?? user.financialYearId ?? null,
        companyCreated: financeUserData.companyCreated ?? user.companyCreated ?? false,
        branchCreated: financeUserData.branchCreated ?? user.branchCreated ?? false,
        financialYearCreated: financeUserData.financialYearCreated ?? user.financialYearCreated ?? false,
      };

      Object.assign(user, merged);
      user._id = originalUserId;
      user.userId = originalUserId;
    }

    // Check if user account is locked
    if (user.isLocked) {
      userCache.delete(userIdStr);
      return res.status(403).json({
        success: false,
        message: 'Authentication failed: Account is locked'
      });
    }

    // Attach user document to request object
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticate;
module.exports.invalidateUserCache = invalidateUserCache;
