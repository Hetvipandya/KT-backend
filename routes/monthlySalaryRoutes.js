const express = require("express");
const router = express.Router();

const {
  generateMonthlySalary,
  getMonthlySalaries,
  getMonthlySalaryById,
  updateMonthlySalary,
  approveMonthlySalary,
  payMonthlySalary,
  cancelMonthlySalary,
} = require("../controllers/monthlySalaryController");

// Generate Monthly Salary
router.post("/generate", generateMonthlySalary);
router.post("/process", generateMonthlySalary);

// Get Monthly Salaries
router.get("/", getMonthlySalaries);
router.get("/all", getMonthlySalaries);

// Get Single Monthly Salary
router.get("/:id", getMonthlySalaryById);

// Update Monthly Salary Draft
router.put("/:id", updateMonthlySalary);

// Workflow Actions: Approve, Pay, Cancel
router.post("/:id/approve", approveMonthlySalary);
router.post("/:id/pay", payMonthlySalary);
router.put("/:id/pay", payMonthlySalary);
router.post("/:id/cancel", cancelMonthlySalary);

module.exports = router;
