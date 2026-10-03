const express = require("express");
const router = express.Router();
const {
  startSession,
  getSession,
  updateSessionStatus,
  removeSession,
  listUserSessions,
} = require("../controllers/sessionController");

const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Optional JWT authentication helper middleware to attach req.user if token is passed
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded && (decoded.id || decoded.userId)) {
        const userId = decoded.id || decoded.userId;
        const user = await User.findById(userId).select("-password").lean();
        if (user) {
          req.user = user;
        }
      }
    }
  } catch (e) {
    // Ignore invalid/expired token in optionalAuth
  }
  next();
};

router.use(optionalAuth);

// 1. Start a new session
router.post("/start", startSession);
router.post("/create", startSession);
router.post("/", startSession);

// 2. Get active / current session
router.get("/get", getSession);
router.get("/active", getSession);
router.get("/details", getSession);
router.get("/", getSession);

// 3. Update session status / ping heartbeat
router.put("/status", updateSessionStatus);
router.put("/update", updateSessionStatus);
router.put("/heartbeat", updateSessionStatus);

// 4. End / remove session
router.post("/end", removeSession);
router.delete("/remove", removeSession);
router.delete("/:id", removeSession);

// 5. List all sessions for user
router.get("/list", listUserSessions);
router.get("/all", listUserSessions);

module.exports = router;
