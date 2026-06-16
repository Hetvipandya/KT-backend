const express =
  require("express");

const router =
  express.Router();

const {
  getDashboard,
  getAnalytics,
  createAnalytics,
} = require(
  "../controllers/projectMonitoringController"
);

// =====================
// DASHBOARD
// =====================
router.get(
  "/dashboard",
  getDashboard
);

// =====================
// ANALYTICS
// =====================
router.get(
  "/analytics",
  getAnalytics
);

router.post(
  "/analytics",
  createAnalytics
);

module.exports = router;