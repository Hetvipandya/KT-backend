const express =
  require("express");

const router =
  express.Router();

const {
  applyLeave,
  teamLeadApproval,
  hrApproval,
  getMyLeaves,
  getLeaveBalance,
  createHoliday,
  getAllHolidays,
  getAllLeaves,
} = require(
  "../controllers/leaveController"
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

// ================= APPLY LEAVE =================
router.post(
  "/apply",
  protect,
  authorizeRoles(
    "employee",
    "hr",
    "admin"
  ),
  applyLeave
);

// ================= TEAM LEAD APPROVAL =================
router.put(
  "/teamlead-approval",
  protect,
  authorizeRoles(
    "teamlead",
    "hr",
    "admin"
  ),
  teamLeadApproval
);

// ================= HR APPROVAL =================
router.put(
  "/hr-approval",
  protect,
  authorizeRoles(
    "hr",
    "admin"
  ),
  hrApproval
);

// ================= GET USER LEAVES =================
router.get(
  "/my-leaves/:userId",
  protect,
  authorizeRoles(
    "employee",
    "hr",
    "admin"
  ),
  getMyLeaves
);

// ================= GET LEAVE BALANCE =================
router.get(
  "/leave-balance/:userId",
  protect,
  authorizeRoles(
    "employee",
    "hr",
    "admin"
  ),
  getLeaveBalance
);

// ================= CREATE HOLIDAY =================
router.post(
  "/holiday/create",
  protect,
  authorizeRoles(
    "hr",
    "admin"
  ),
  createHoliday
);

// ================= GET ALL HOLIDAYS =================
router.get(
  "/holiday/all",
  protect,
  authorizeRoles(
    "employee",
    "hr",
    "admin"
  ),
  getAllHolidays
);

// ================= GET ALL LEAVES =================
router.get(
  "/all",
  protect,
  authorizeRoles(
    "hr",
    "admin",
    "team lead"
  ),
  getAllLeaves
);

module.exports =
  router;