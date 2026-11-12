const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const {
  createDeductionMaster,
  getDeductionMasters,
  getDeductionMasterById,
  updateDeductionMaster,
  deleteDeductionMaster,
} = require("../controllers/deductionMasterController");

router.use(protect);

// Read routes: Admin, HR, Super Admin, CA, Accountant, Team Lead
router.get(
  "/",
  authorizeRoles("admin", "hr", "super admin", "ca", "accountant", "team lead"),
  getDeductionMasters
);
router.get(
  "/:id",
  authorizeRoles("admin", "hr", "super admin", "ca", "accountant", "team lead"),
  getDeductionMasterById
);

// Write routes: Admin, HR, Super Admin
router.post(
  "/",
  authorizeRoles("admin", "hr", "super admin"),
  createDeductionMaster
);
router.put(
  "/:id",
  authorizeRoles("admin", "hr", "super admin"),
  updateDeductionMaster
);
router.delete(
  "/:id",
  authorizeRoles("admin", "hr", "super admin"),
  deleteDeductionMaster
);

module.exports = router;
