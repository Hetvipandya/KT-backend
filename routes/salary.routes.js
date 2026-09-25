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
router.post("/create", createSalaryStructure);

// Get All
router.get("/all", getAllSalaryStructures);

// Get By User ID or Structure ID
router.get("/user/:userId", getSalaryStructureById);
router.get("/:id", getSalaryStructureById);

// Full Update
router.put("/:id", updateSalaryStructure);

// Partial Update
router.patch("/:id", patchSalaryStructure);

// Delete
router.delete("/:id", deleteSalaryStructure);


module.exports = router;