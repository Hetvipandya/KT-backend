const express = require("express");
const router = express.Router();

const {
  createSalaryStructure,
  getAllSalaryStructures,
  getSalaryStructureById,
  updateSalaryStructure,
  deleteSalaryStructure,
} = require("../controllers/salaryStructureController");

// Create Salary Structure
router.post("/", createSalaryStructure);
router.post("/create", createSalaryStructure);

// Get All Salary Structures
router.get("/", getAllSalaryStructures);
router.get("/all", getAllSalaryStructures);

// Get By Company ID
router.get("/company/:companyId", getAllSalaryStructures);
router.get("/company/:companyId/branch/:branchId", getAllSalaryStructures);

// Get By Structure ID or Employee ID
router.get("/employee/:employeeId", getSalaryStructureById);
router.get("/user/:userId", getSalaryStructureById);
router.get("/:id", getSalaryStructureById);

// Update Salary Structure
router.put("/:id", updateSalaryStructure);
router.patch("/:id", updateSalaryStructure);

// Delete / Deactivate Salary Structure
router.delete("/:id", deleteSalaryStructure);

module.exports = router;
