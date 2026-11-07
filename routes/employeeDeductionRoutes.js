const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const {
  createEmployeeDeduction,
  getEmployeeDeductions,
  getMyDeductions,
  getEmployeeDeductionById,
  updateEmployeeDeduction,
  deleteEmployeeDeduction,
  approveEmployeeDeduction,
  rejectEmployeeDeduction,
  batchApproveDeductions,
  unlockEmployeeDeduction,
  previewPayrollWithDeductions,
  getDeductionsReport,
} = require("../controllers/employeeDeductionController");

router.use(protect);

// 1. Employee Self-Service (Web & Mobile portal)
router.get(
  "/my-deductions",
  authorizeRoles("employee", "intern", "team lead", "admin", "hr", "super admin"),
  getMyDeductions
);

// 2. Payroll Preview
router.post(
  "/preview",
  authorizeRoles("admin", "hr", "super admin", "ca", "accountant"),
  previewPayrollWithDeductions
);
router.get(
  "/preview",
  authorizeRoles("admin", "hr", "super admin", "ca", "accountant"),
  previewPayrollWithDeductions
);

// 3. Deductions Reporting
router.get(
  "/report",
  authorizeRoles("admin", "hr", "super admin", "ca", "accountant"),
  getDeductionsReport
);
router.get(
  "/reports",
  authorizeRoles("admin", "hr", "super admin", "ca", "accountant"),
  getDeductionsReport
);

// 4. Batch Operations
router.post(
  "/batch-approve",
  authorizeRoles("admin", "hr", "super admin"),
  batchApproveDeductions
);

// 5. List Deductions
router.get(
  "/",
  authorizeRoles("admin", "hr", "super admin", "ca", "accountant", "team lead", "employee"),
  getEmployeeDeductions
);

// 6. Get Single Deduction
router.get(
  "/:id",
  authorizeRoles("admin", "hr", "super admin", "ca", "accountant", "team lead", "employee"),
  getEmployeeDeductionById
);

// 7. Create Deduction (Admin, HR, Super Admin, Team Lead)
router.post(
  "/",
  authorizeRoles("admin", "hr", "super admin", "team lead"),
  createEmployeeDeduction
);

// 8. Update Deduction (Admin, HR, Super Admin, Team Lead - protected by payroll locking)
router.put(
  "/:id",
  authorizeRoles("admin", "hr", "super admin", "team lead"),
  updateEmployeeDeduction
);

// 9. Delete Deduction (Admin, HR, Super Admin - protected by payroll locking)
router.delete(
  "/:id",
  authorizeRoles("admin", "hr", "super admin"),
  deleteEmployeeDeduction
);

// 10. Approval & Rejection (Admin, HR, Super Admin, Team Lead)
router.post(
  "/:id/approve",
  authorizeRoles("admin", "hr", "super admin", "team lead"),
  approveEmployeeDeduction
);
router.put(
  "/:id/approve",
  authorizeRoles("admin", "hr", "super admin", "team lead"),
  approveEmployeeDeduction
);

router.post(
  "/:id/reject",
  authorizeRoles("admin", "hr", "super admin", "team lead"),
  rejectEmployeeDeduction
);
router.put(
  "/:id/reject",
  authorizeRoles("admin", "hr", "super admin", "team lead"),
  rejectEmployeeDeduction
);

// 11. Admin Unlock Operation
router.post(
  "/:id/unlock",
  authorizeRoles("admin", "super admin"),
  unlockEmployeeDeduction
);

module.exports = router;
