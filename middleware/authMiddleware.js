const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const FinanceUser = require("../models/FinanceUser");
const Employee = require("../models/Employee");

exports.protect = async (req, res, next) => {
  try {
    if (req.user) {
      return next();
    }
    let token;

    // ================= GET TOKEN =================
    if (req.headers.authorization) {
      const parts = req.headers.authorization.trim().split(/\s+/);
      if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
        token = parts[1];
      } else if (parts.length === 1 && !parts[0].toLowerCase().startsWith("bearer")) {
        token = parts[0];
      }
    }

    // ================= TOKEN CHECK =================
    if (!token || token === "undefined" || token === "null") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - No token provided",
      });
    }

    // ================= VERIFY TOKEN =================
    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "kevalonTechnology"
      );
    } catch (err) {
      try {
        const envConfig = require("../config/env");
        decoded = jwt.verify(
          token,
          envConfig.JWT_ACCESS_SECRET || envConfig.JWT_SECRET || "kevalonTechnology"
        );
      } catch (secondErr) {
        return res.status(401).json({
          success: false,
          message: "Token invalid or expired",
          error: err.message,
        });
      }
    }

    // Support both token payload styles: { id: ... } and { userId: ... }
    const userId = decoded.id || decoded.userId || decoded._id || decoded.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Missing user identifier in token",
      });
    }

    // ================= FIND USER =================
    let user = null;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId).select("-password");
    }
    if (!user) {
      user = await User.findOne({
        $or: [
          { userId: userId },
          { uniqueID: userId },
          { email: typeof userId === "string" ? userId.toLowerCase() : userId },
        ],
      }).select("-password");
    }

    if (!user) {
      const employeeQuery = {
        $or: [
          ...(mongoose.Types.ObjectId.isValid(userId) ? [{ _id: userId }] : []),
          { employeeID: userId },
          { employeeCode: typeof userId === "string" ? userId.toUpperCase() : userId },
          { userID: userId },
          { userId: userId },
        ],
      };
      const employee = await Employee.findOne(employeeQuery).select("userID userId email");

      if (employee) {
        const linkedUserId = employee.userID || employee.userId;
        if (linkedUserId) {
          user = await User.findById(linkedUserId).select("-password");
        }
        if (!user && employee.email) {
          user = await User.findOne({ email: employee.email.toLowerCase() }).select("-password");
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // ================= ACTIVE CHECK =================
    if (user.isActive === false && user.status === "Inactive") {
      return res.status(403).json({
        success: false,
        message: "User account disabled",
      });
    }

    const financeUser = await FinanceUser.findOne({ userId: user._id }).lean();
    if (financeUser) {
      Object.assign(user, financeUser);
    }

    // ================= ATTACH USER =================
    req.user = user;

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error in authentication",
      error: error.message,
    });
  }
};
