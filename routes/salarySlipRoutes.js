const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const {
  getSalarySlipHtml,
  getSalarySlipPdf,
} = require("../controllers/salarySlipController");

// Protect all salary slip routes
router.use(protect);

// View & Download Salary Slips (CA, Accountant, Admin, HR, Super Admin, Employee)
router.get("/:salaryId", authorizeRoles("ca", "accountant", "admin", "hr", "super admin", "employee"), getSalarySlipHtml);
router.get("/print/:salaryId", authorizeRoles("ca", "accountant", "admin", "hr", "super admin", "employee"), getSalarySlipHtml);
router.get("/html/:salaryId", authorizeRoles("ca", "accountant", "admin", "hr", "super admin", "employee"), getSalarySlipHtml);
router.get("/:salaryId/pdf", authorizeRoles("ca", "accountant", "admin", "hr", "super admin", "employee"), getSalarySlipPdf);
router.get("/download/:salaryId", authorizeRoles("ca", "accountant", "admin", "hr", "super admin", "employee"), getSalarySlipPdf);

module.exports = router;
