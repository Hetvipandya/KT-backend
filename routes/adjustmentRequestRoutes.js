const express = require("express");
const router = express.Router();

const {
  patchAttendanceAdjustment,
  putAttendanceAdjustment,
  getAdjustmentHistory,
  testGetEmployeeName,
} = require("../controllers/adjustmentRequestController");


// Partial update
router.patch("/update/:employeeId/:date", patchAttendanceAdjustment);

// Full update
router.put("/update/:employeeId/:date", putAttendanceAdjustment);

// History
router.get("/history", getAdjustmentHistory);

// Test employee name
router.get("/test/:id", testGetEmployeeName);

module.exports = router;