const express = require("express");

const router = express.Router();

const {
  createSalaryStructure,
  getAllSalaryStructures, 
  getSalaryStructureById, 
  updateSalaryStructure, 
  patchSalaryStructure,
  deleteSalaryStructure,
} = require("../controllers/salary.controller");


// =====================================================
// SALARY STRUCTURE ROUTES
// =====================================================

// Create
router.post("/", createSalaryStructure);
router.post("/create", createSalaryStructure);

// Get All (Supports ?companyId=...&branchId=...&employeeId=...)
router.get("/", getAllSalaryStructures);
router.get("/all", getAllSalaryStructures);

// Get By Company ID
router.get("/company/:companyId", getAllSalaryStructures);
router.get("/company/:companyId/branch/:branchId", getAllSalaryStructures);

// Get By User ID, Employee ID, or Structure ID
router.get("/employee/:employeeId", getSalaryStructureById);
router.get("/user/:userId", getSalaryStructureById);
router.get("/:id", getSalaryStructureById);

// Full Update
router.put("/:id", updateSalaryStructure);

// Partial Update
router.patch("/:id", patchSalaryStructure);

// Delete
router.delete("/:id", deleteSalaryStructure);


module.exports = router;