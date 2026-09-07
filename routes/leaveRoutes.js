const express = require("express");
const router = express.Router();

const {
  applyLeave,
  teamLeadApproval,
  hrApproval,
  getMyLeaves,  
  getLeaveBalance,  
  createHoliday,
  getAllHolidays, 
  getAllLeaves,
  adminApproval,
} = require("../controllers/leaveController");

const { protect } = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

// ================= APPLY LEAVE =================
router.post(
  "/apply",
  protect,
  authorizeRoles(
    "intern",
    "employee", 
    "hr",
    "admin",
    "team lead"
  ),
  applyLeave
);

router.put(
  "/admin/approve",
  protect,
  authorizeRoles("admin"),
  adminApproval 
);

router.put(
  "/admin/reject",
  protect,
  authorizeRoles("admin"),
  adminApproval 
);

// ================= TEAM LEAD APPROVAL =================
router.put(
  "/teamlead-approval",
  protect,
  authorizeRoles("team lead"),
  teamLeadApproval
);

// ================= HR APPROVAL =================
router.put(
  "/hr-approval",
  protect, 
  authorizeRoles("hr"),
  hrApproval
);

// ================= GET USER LEAVES =================
router.get(
  "/my-leaves/:userId",
  protect,
  authorizeRoles(
    "intern",
    "employee",
    "hr",
    "admin",
    "team lead"
  ),
  getMyLeaves 
);

// ================= GET LEAVE BALANCE =================
router.get(
  "/leave-balance/:userId",
  protect,
  authorizeRoles(
    "intern",
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
    "intern",
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
    "team lead",
    "intern"
  ),
  getAllLeaves
);

module.exports = router;