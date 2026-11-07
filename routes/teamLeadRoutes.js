const express = require("express");

const router = express.Router();

const {  
  getDashboard,
  getMyTeam,
  getReports,  
  createOrUpdateTeam,
  removeTeamLead,
  getTeamDeductions,
  approveTeamDeduction,
  rejectTeamDeduction,
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

router.post( 
  "/create-team",
  protect,
  authorizeRoles("admin", "hr"),
  createOrUpdateTeam
);

router.get(
  "/team",
  protect,
  authorizeRoles(
    "team lead",
    "employee",
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

// Team Lead Deduction Management
router.get(
  "/deductions",
  protect,
  authorizeRoles("team lead", "admin", "hr"),
  getTeamDeductions
);

router.post(
  "/deductions/:id/approve",
  protect,
  authorizeRoles("team lead", "admin", "hr"),
  approveTeamDeduction
);

router.post(
  "/deductions/:id/reject",
  protect,
  authorizeRoles("team lead", "admin", "hr"),
  rejectTeamDeduction
);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/team-lead/remove-team-lead
// Admin only — unassigns a Team Lead, reverts User.role → "employee",
// sets Employee.isTeamLead → false, and clears the Team document's lead.
// ─────────────────────────────────────────────────────────────────────────────
router.put(
  "/remove-team-lead",
  protect,
  authorizeRoles("admin"),
  removeTeamLead
);

module.exports = router;
