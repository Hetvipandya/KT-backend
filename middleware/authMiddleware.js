

const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.protect = async (req, res, next) => {
  try {
    let token;

    // 1. Get token from header
    if (
      req.headers.authorization && 
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 2. If no token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - No token provided",
      });
    }

    // 3. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Token invalid or expired",
      });
    }

    // 4. Find user
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // 5. Optional: check active user (if field exists)
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "User account disabled",
      });
    }

    // 6. Attach user to request
    req.user = user;

    // 7. Debug logs (safe)
    console.log("🔐 Logged User ID:", user._id.toString());
    console.log("👤 Logged User Role:", user.role);

    next();
  } catch (error) {
    console.log("Auth Middleware Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error in authentication",
    });
  }
};