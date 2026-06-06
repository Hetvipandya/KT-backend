const express = require("express");

const router = express.Router();

const {
  createSalaryStructure,
  getSalaryStructure,
  processPayroll,
  generatePayslip,
  getPayroll,
  getPayslips,
  markSalaryPaid,
} = require(
  "../controllers/payrollController"
);


// ==========================
// Salary Structure
// ==========================
router.post(
  "/salary/create",
  createSalaryStructure
);

router.get(
  "/salary",
  getSalaryStructure
);


// ==========================
// Payroll
// ==========================
router.post(
  "/process",
  processPayroll
);

router.get(
  "/",
  getPayroll
);

router.put(
  "/pay",
  markSalaryPaid
);


// ==========================
// Payslip
// ==========================
router.post(
  "/payslip/generate",
  generatePayslip
);

router.get(
  "/payslips",
  getPayslips
);

module.exports = router;