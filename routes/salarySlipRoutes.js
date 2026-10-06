const express = require("express");
const router = express.Router();

const {
  getSalarySlipHtml,
  getSalarySlipPdf,
} = require("../controllers/salarySlipController");

// Printable HTML Salary Slip View
router.get("/:salaryId", getSalarySlipHtml);
router.get("/print/:salaryId", getSalarySlipHtml);
router.get("/html/:salaryId", getSalarySlipHtml);

// PDF Download
router.get("/:salaryId/pdf", getSalarySlipPdf);
router.get("/download/:salaryId", getSalarySlipPdf);

module.exports = router;
