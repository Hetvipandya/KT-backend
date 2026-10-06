const mongoose = require("mongoose");
const MonthlySalary = require("../models/MonthlySalary");
const Company = require("../models/Company");
const { renderPayslipHtml, renderPayslipPdf } = require("../services/payslipRenderService");

// =====================================================
// GET SALARY SLIP HTML VIEW
// GET /api/salary-slips/:salaryId
// =====================================================
const getSalarySlipHtml = async (req, res) => {
  try {
    const salaryId = req.params.salaryId || req.params.id;

    if (!salaryId || !mongoose.Types.ObjectId.isValid(salaryId)) {
      return res.status(400).send("<h3>Invalid Salary ID</h3>");
    }

    const monthlySalary = await MonthlySalary.findById(salaryId).populate(
      "employeeId userId",
      "name firstName lastName employeeCode uniqueID role designation department dateOfJoining joiningDate pan panNumber email"
    );

    if (!monthlySalary) {
      return res.status(404).send("<h3>Salary record not found</h3>");
    }

    let companyData = {};
    if (monthlySalary.companyId) {
      try {
        const company = await Company.findById(monthlySalary.companyId).maxTimeMS(2000);
        if (company) companyData = company.toObject();
      } catch (err) {
        companyData = {};
      }
    }

    const employeeData = monthlySalary.employeeId || monthlySalary.userId || {};

    const salaryObj = typeof monthlySalary.toObject === "function" ? monthlySalary.toObject() : monthlySalary;

    const htmlContent = renderPayslipHtml(salaryObj, employeeData, companyData);

    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(htmlContent);
  } catch (error) {
    console.error("Get Salary Slip HTML Error:", error);
    return res.status(500).send(`<h3>Failed to render salary slip: ${error.message}</h3>`);
  }
};

// =====================================================
// GET SALARY SLIP PDF DOWNLOAD
// GET /api/salary-slips/:salaryId/pdf OR /api/payroll/payslip/pdf/:id
// =====================================================
const getSalarySlipPdf = async (req, res) => {
  try {
    const salaryId = req.params.salaryId || req.params.id;

    if (!salaryId || !mongoose.Types.ObjectId.isValid(salaryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Salary ID",
      });
    }

    const monthlySalary = await MonthlySalary.findById(salaryId).populate(
      "employeeId userId",
      "name firstName lastName employeeCode uniqueID role designation department dateOfJoining joiningDate pan panNumber email"
    );

    if (!monthlySalary) {
      return res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
    }

    let companyData = {};
    if (monthlySalary.companyId) {
      try {
        const company = await Company.findById(monthlySalary.companyId).maxTimeMS(2000);
        if (company) companyData = company.toObject();
      } catch (err) {
        companyData = {};
      }
    }

    const employeeData = monthlySalary.employeeId || monthlySalary.userId || {};
    const salaryObj = typeof monthlySalary.toObject === "function" ? monthlySalary.toObject() : monthlySalary;

    return renderPayslipPdf(res, salaryObj, employeeData, companyData);
  } catch (error) {
    console.error("Get Salary Slip PDF Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate salary slip PDF",
      error: error.message,
    });
  }
};

module.exports = {
  getSalarySlipHtml,
  getSalarySlipPdf,
};
