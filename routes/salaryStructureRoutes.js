const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const {
  createSalaryStructure,
  getAllSalaryStructures,
  getSalaryStructureById,
  updateSalaryStructure,
  deleteSalaryStructure,
} = require("../controllers/salaryStructureController");

// Protect all salary structure routes
router.use(protect);

// View Salary Structures (CA, Accountant, Admin, HR, Super Admin, Employee)
router.get("/", authorizeRoles("ca", "accountant", "admin", "hr", "super admin", "employee"), getAllSalaryStructures);
router.get("/all", authorizeRoles("ca", "accountant", "admin", "hr", "super admin", "employee"), getAllSalaryStructures);
router.get("/employee/:employeeId", authorizeRoles("ca", "accountant", "admin", "hr", "super admin", "employee"), getSalaryStructureById);
router.get("/user/:userId", authorizeRoles("ca", "accountant", "admin", "hr", "super admin", "employee"), getSalaryStructureById);
router.get("/:id", authorizeRoles("ca", "accountant", "admin", "hr", "super admin", "employee"), getSalaryStructureById);

// Create, Update, Delete (CA, Accountant, Admin, HR, Super Admin)
router.post("/", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), createSalaryStructure);
router.post("/create", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), createSalaryStructure);
router.put("/:id", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), updateSalaryStructure);
router.patch("/:id", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), updateSalaryStructure);
router.delete("/:id", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), deleteSalaryStructure);

module.exports = router;
