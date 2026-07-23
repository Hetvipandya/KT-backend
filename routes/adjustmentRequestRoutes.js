

const express = require("express");
const router = express.Router();
const {
  createDirectAdjustment,
  getAdjustmentHistory,
  testGetEmployeeName
} = require("../controllers/adjustmentRequestController");

// Direct adjustment - immediately updates attendance
router.post("/create", createDirectAdjustment);

// Get adjustment history
router.get("/history", getAdjustmentHistory);

// Test endpoint to debug employee name
router.get("/test-name/:id", testGetEmployeeName);

module.exports = router;