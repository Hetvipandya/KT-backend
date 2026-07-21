const express = require("express");

const router = express.Router();

const {
  getDashboard,
  getMyTeam,
  getReports,
} = require("../controllers/teamLeadController");

const {
  protect,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

router.get(
  "/dashboard",
  protect,
  authorizeRoles(
    "team lead",
    "admin"
  ),
  getDashboard
);

router.get(
  "/team",
  protect,
  authorizeRoles(
    "team lead",
    "admin"
  ),
  getMyTeam
);

router.get(
  "/reports",
  protect,
  authorizeRoles(
    "team lead",
    "admin"
  ),
  getReports
);

module.exports = router;