const express = require("express");
const router = express.Router();

const {
  checkIn,
  checkOut,
  startBreak,
  endBreak,
  getReport,
} = require("../controllers/attendanceController");

// Attendance flow APIs
router.post("/checkin", checkIn);
router.post("/checkout", checkOut);

// Break APIs
router.post("/break/start", startBreak);
router.post("/break/end", endBreak);

// Report API
router.get("/report", getReport);

module.exports = router;