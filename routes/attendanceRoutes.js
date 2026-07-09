const express = require("express");

const router = express.Router();

const {
  checkIn,
  checkOut,
  startBreak,
  endBreak,
  getReport,
  getPendingAttendance,
  approveAttendance,
  rejectAttendance,
} = require("../controllers/attendanceController");

const { protect } = require("../middleware/authMiddleware");

// ================= CHECK IN =================
router.post(
  "/check-in",
  protect,
  checkIn
);

// ================= CHECK OUT =================
router.post(
  "/check-out",
  protect,
  checkOut
);

// ================= BREAK START =================
router.post(
  "/break/start",
  protect,
  startBreak
);

// ================= BREAK END =================
router.post(
  "/break/end",
  protect,
  endBreak
);

// ================= ATTENDANCE REPORT =================
router.get(
  "/report",
  protect,
  getReport
);

// ================= PENDING ATTENDANCE =================
router.get(
  "/pending",
  protect,
  getPendingAttendance
);

// ================= APPROVE ATTENDANCE =================
router.put(
  "/approve",
  protect,
  approveAttendance
);

// ================= REJECT ATTENDANCE =================
router.put(
  "/reject",
  protect,
  rejectAttendance
);

module.exports = router;