// const express = require("express");

// const router = express.Router();

// const {
//   getDashboard,
//   getMyTeam,
//   getReports,
//   createOrUpdateTeam,
// } = require("../controllers/teamLeadController");

// const { 
//   protect,
// } = require("../middleware/authMiddleware");

// const { 
//   authorizeRoles,
// } = require("../middleware/roleMiddleware");

// router.get(
//   "/dashboard",
//   protect,
//   authorizeRoles(
//     "team lead",
//     "admin"
//   ),
//   getDashboard
// );


// router.post(
//   "/create-team",
//   protect,
//   authorizeRoles("admin"),
//   createOrUpdateTeam
// );

// router.get(
//   "/team",
//   protect,
//   authorizeRoles(
//     "team lead",
//     "admin"
//   ),
//   getMyTeam
// );

// router.get(
//   "/reports",
//   protect,
//   authorizeRoles(
//     "team lead",
//     "admin"
//   ),
//   getReports
// );

// module.exports = router;

// routes/teamLeadRoutes.js
const express = require("express");
const router = express.Router();

const {
  getDashboard,
  getMyTeam,
  getReports,
  createOrUpdateTeam,
  getTeamByTeamLead,
  removeMemberFromTeam,
} = require("../controllers/teamLeadController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

// ===========================
// DASHBOARD ROUTE
// ===========================
router.get(
  "/dashboard",
  protect,
  authorizeRoles("team lead", "admin"),
  getDashboard
);

// ===========================
// TEAM MANAGEMENT ROUTES
// ===========================

// Create or update team (Admin only)
router.post(
  "/create-team",
  protect,
  authorizeRoles("admin"),
  createOrUpdateTeam
);

// Get all teams (Team Lead and Admin)
router.get(
  "/team",
  protect,
  authorizeRoles("team lead", "admin"),
  getMyTeam
);

// Get team by team lead ID
router.get(
  "/team/:teamLeadId",
  protect,
  authorizeRoles("admin", "team lead"),
  getTeamByTeamLead
);

// Remove member from team
router.delete(
  "/team/:teamId/member/:memberId/:type",
  protect,
  authorizeRoles("admin"),
  removeMemberFromTeam
);

// ===========================
// REPORTS ROUTE
// ===========================
router.get(
  "/reports",
  protect,
  authorizeRoles("team lead", "admin"),
  getReports
);

module.exports = router;