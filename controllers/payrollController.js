const {
  createSalaryStructure,
  getAllSalaryStructures,
  getSalaryStructureById,
  updateSalaryStructure,
} = require("./salaryStructureController");

const {
  generateMonthlySalary,
  getMonthlySalaries,
  getMonthlySalaryById,
  approveMonthlySalary,
  payMonthlySalary,
} = require("./monthlySalaryController");

const {
  getSalarySlipHtml,
  getSalarySlipPdf,
} = require("./salarySlipController");

module.exports = {
  createSalaryStructure,
  getSalaryStructure: getAllSalaryStructures,
  getSalaryStructureByUserId: getSalaryStructureById,
  updateSalaryStructure,
  processPayroll: generateMonthlySalary,
  approvePayroll: approveMonthlySalary,
  approveMonthlySalary,
  generatePayslip: getSalarySlipHtml,
  getPayroll: getMonthlySalaries,
  getPayslips: getMonthlySalaries,
  markSalaryPaid: payMonthlySalary,
  downloadPrintablePayslip: getSalarySlipHtml,
  downloadPayslipPdf: getSalarySlipPdf,
};