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
    "employee"
  ),
  applyLeave
);

// ================= TEAM LEAD APPROVAL =================
router.put(
  "/teamlead-approval",
  protect,
  authorizeRoles(
    "teamlead"
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
  getMyLeaves
);

// ================= GET LEAVE BALANCE =================
router.get(
  "/leave-balance/:userId",
  protect,
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
  getAllHolidays
);

router.get(
  "/all-leaves",
  protect,
  getAllLeaves
);

module.exports =
  router;