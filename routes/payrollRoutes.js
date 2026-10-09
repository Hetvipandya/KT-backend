const express = require("express");

const router = express.Router();

const {
  createSalaryStructure,
  getSalaryStructure,
  getSalaryStructureByUserId,
  updateSalaryStructure, 
  processPayroll,
  approvePayroll,
  approveMonthlySalary,
  generatePayslip,  
  getPayroll, 
  getPayslips,
  markSalaryPaid,
  downloadPrintablePayslip, 
  downloadPayslipPdf
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

router.get( 
  "/salary/user/:userId",
  getSalaryStructureByUserId
);

router.put(
  "/update-salary/:id",
  updateSalaryStructure
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

router.post(
  "/approve",
  approvePayroll || approveMonthlySalary
);

router.put(
  "/approve",
  approvePayroll || approveMonthlySalary
);

router.post(
  "/approve/:id",
  approvePayroll || approveMonthlySalary
);

router.put(
  "/approve/:id",
  approvePayroll || approveMonthlySalary
);

router.post(
  "/salary/approve",
  approvePayroll || approveMonthlySalary
);

router.put(
  "/salary/approve",
  approvePayroll || approveMonthlySalary
);


// ==========================
// Payslip
// ==========================
router.post(
  "/payslip/generate",
  generatePayslip
);
router.get(
  "/payslip/generate",
  generatePayslip
);

router.get(
  "/payslips",
  getPayslips
);

// Printable UI & PDF Download Endpoints
router.get(
  "/payslip/print/:id",
  downloadPrintablePayslip
);

router.get(
  "/payslip/download/:id",
  downloadPrintablePayslip
);

router.get(
  "/payslip/html/:id",
  downloadPrintablePayslip
);

router.get(
  "/payslip/pdf/:id",
  downloadPayslipPdf
);

module.exports = router;