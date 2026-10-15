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
router.patch("/update", patchAttendanceAdjustment);

// Full update
router.put("/update/:employeeId/:date", putAttendanceAdjustment);
router.put("/update", putAttendanceAdjustment);
router.post("/update/:employeeId/:date", putAttendanceAdjustment);
router.post("/update", putAttendanceAdjustment);
router.post("/create", putAttendanceAdjustment);
router.post("/request", putAttendanceAdjustment);
router.post("/", putAttendanceAdjustment);

// History
router.get("/history", getAdjustmentHistory);

// Test employee name
router.get("/test/:id", testGetEmployeeName);

module.exports = router;