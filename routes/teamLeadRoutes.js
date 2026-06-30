const express =
  require("express");

const router =
  express.Router();

const {
  getDashboard, 
  getMyTeam,
  getReports,
} = require(
  "../controllers/teamLeadController"
);
 
const {
  protect,
} = require(
  "../middleware/authMiddleware"
);

const {
  authorizeRoles,
} = require(
  "../middleware/roleMiddleware"
);

router.get(
  "/dashboard",
  protect,
  authorizeRoles(
    "teamlead"
  ),
  getDashboard
);

router.get(
  "/team",
  protect,
  authorizeRoles(
    "teamlead"
  ),
  getMyTeam
);

router.get(
  "/reports",
  protect,
  authorizeRoles(
    "teamlead"
  ),
  getReports
);

module.exports =
  router;