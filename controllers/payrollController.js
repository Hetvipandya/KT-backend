const SalaryStructure = require("../models/SalaryStructure");
const Payroll = require("../models/Payroll");
const Payslip = require("../models/Payslip");


// ===============================
// Create Salary Structure
// ===============================
exports.createSalaryStructure = 
  async (req, res) => {
    try {
      const {
        userId,
        basicSalary,
        hra,
        allowance,
        bonus,
        deduction,
        tdsPercentage,
      } = req.body;

      const grossSalary =
        basicSalary +
        (hra || 0) +
        (allowance || 0) +
        (bonus || 0);

      const tdsAmount =
        (grossSalary *
          (tdsPercentage || 0)) /
        100;

      const netSalary =
        grossSalary -
        (deduction || 0) -
        tdsAmount;

      const salaryStructure =
        await SalaryStructure.create({
          userId,
          basicSalary,
          hra,
          allowance,
          bonus,
          deduction,
          tdsPercentage,
          netSalary,
        });

      res.status(201).json({
        success: true,
        message:
          "Salary structure created successfully",
        data: salaryStructure,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


// ===============================
// Get Salary Structure
// ===============================
exports.getSalaryStructure =
  async (req, res) => {
    try { 
      const salary =
        await SalaryStructure.find()
          .populate(
  "userId",
  "firstName lastName email"
);

      res.status(200).json({
        success: true,
        data: salary,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


// ===============================
// Process Payroll
// ===============================
exports.processPayroll =
  async (req, res) => {
    try {
      const {
        userId,
        month,
        year,
        bonus,
        deduction,
      } = req.body;

      const salaryStructure =
        await SalaryStructure.findOne({
          userId,
          isActive: true,
        });

      if (!salaryStructure) {
        return res.status(404).json({
          success: false,
          message:
            "Salary structure not found",
        });
      }

      const alreadyProcessed =
        await Payroll.findOne({
          userId,
          month,
          year,
        });

      if (alreadyProcessed) {
        return res.status(400).json({
          success: false,
          message:
            "Payroll already processed",
        });
      }

      const grossSalary =
        salaryStructure.basicSalary +
        salaryStructure.hra +
        salaryStructure.allowance +
        salaryStructure.bonus;

      const finalBonus =
        bonus || 0;

      const finalDeduction =
        deduction || 0;

      const tdsAmount =
        (grossSalary *
          salaryStructure.tdsPercentage) /
        100;

      const netSalary =
        grossSalary +
        finalBonus -
        finalDeduction -
        tdsAmount;

      const payroll =
        await Payroll.create({
          userId,
          salaryStructureId:
            salaryStructure._id,
          month,
          year,
          bonus: finalBonus,
          deduction:
            finalDeduction,
          tdsAmount,
          grossSalary,
          netSalary,
          status: "processed",
        });

      res.status(201).json({
        success: true,
        message:
          "Payroll processed successfully",
        data: payroll,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


// ===============================
// Generate Payslip
// ===============================
exports.generatePayslip =
  async (req, res) => {
    try {
      const { payrollId } =
        req.body;

      const payroll =
        await Payroll.findById(
          payrollId
        );

      if (!payroll) {
        return res.status(404).json({
          success: false,
          message:
            "Payroll not found",
        });
      }

      const existingPayslip =
        await Payslip.findOne({
          payrollId,
        });

      if (existingPayslip) {
        return res.status(400).json({
          success: false,
          message:
            "Payslip already generated",
        });
      }

      const payslip =
        await Payslip.create({
          payrollId:
            payroll._id,
          userId:
            payroll.userId,
          month:
            payroll.month,
          year:
            payroll.year,
          grossSalary:
            payroll.grossSalary,
          totalBonus:
            payroll.bonus,
          totalDeduction:
            payroll.deduction,
          tdsAmount:
            payroll.tdsAmount,
          netSalary:
            payroll.netSalary,
        });

      res.status(201).json({
        success: true,
        message:
          "Payslip generated successfully",
        data: payslip,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


// ===============================
// Get Payroll
// ===============================
exports.getPayroll =
  async (req, res) => {
    try {
      const payroll =
        await Payroll.find()
          .populate(
            "userId",
            "name email"
          )
          .populate(
            "salaryStructureId"
          );

      res.status(200).json({
        success: true,
        data: payroll,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


// ===============================
// Get Payslips
// ===============================
exports.getPayslips =
  async (req, res) => {
    try {
      const payslips =
        await Payslip.find()
          .populate(
            "userId",
            "name email"
          )
          .populate(
            "payrollId"
          );

      res.status(200).json({
        success: true,
        data: payslips,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };


// ===============================
// Mark Salary Paid
// ===============================
exports.markSalaryPaid =
  async (req, res) => {
    try {
      const { payrollId } =
        req.body;

      const payroll =
        await Payroll.findByIdAndUpdate(
          payrollId,
          {
            status: "paid",
            paymentDate:
              new Date(),
          },
          { new: true }
        );

      if (!payroll) {
        return res.status(404).json({
          success: false,
          message:
            "Payroll not found",
        });
      }

      res.status(200).json({
        success: true,
        message:
          "Salary marked as paid",
        data: payroll,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };