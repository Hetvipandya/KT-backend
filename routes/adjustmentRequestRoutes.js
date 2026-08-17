const express = require("express");
const router = express.Router();

const {
  updateDirectAdjustment,
  getAdjustmentHistory,
  testGetEmployeeName,
} = require("../controllers/adjustmentRequestController");

// Update existing attendance through adjustment
router.patch("/update", updateDirectAdjustment);

// Optional: PUT if you want full replacement/update
router.put("/update", updateDirectAdjustment);

// Get adjustment history
router.get("/history", getAdjustmentHistory);

// Test employee name
router.get("/test-name/:id", testGetEmployeeName);

module.exports = router;