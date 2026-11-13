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

// Salary details are limited to finance and HR roles.
router.get("/", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), getAllSalaryStructures);
router.get("/all", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), getAllSalaryStructures);
router.get("/employee/:employeeId", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), getSalaryStructureById);
router.get("/user/:userId", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), getSalaryStructureById);
router.get("/:id", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), getSalaryStructureById);

// Get By Company ID
router.get("/company/:companyId", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), getAllSalaryStructures);
router.get("/company/:companyId/branch/:branchId", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), getAllSalaryStructures);

// Create, Update, Delete (CA, Accountant, Admin, HR, Super Admin)
router.post("/", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), createSalaryStructure);
router.post("/create", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), createSalaryStructure);
router.put("/:id", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), updateSalaryStructure);
router.patch("/:id", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), updateSalaryStructure);
router.delete("/:id", authorizeRoles("ca", "accountant", "admin", "hr", "super admin"), deleteSalaryStructure);

module.exports = router;
