const express = require("express");
const router = express.Router();

const {
  checkIn,
  checkOut,
  startBreak,
  endBreak,
  getReport,
} = require("../controllers/attendanceController");

const { protect } = require("../middleware/authMiddleware");

// ================= ATTENDANCE =================
router.post("/checkin", protect, checkIn);
router.post("/checkout", protect, checkOut);

// ================= BREAK =================
router.post("/break/start", protect, startBreak);
router.post("/break/end", protect, endBreak);

// ================= REPORT =================
router.get("/report", protect, getReport);

module.exports = router;