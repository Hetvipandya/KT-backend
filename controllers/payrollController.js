const SalaryStructure = require("../models/SalaryStructure");
const Payroll = require("../models/Payroll");
const Payslip = require("../models/Payslip");

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getNumericValue = (value, defaultValue = 0) => {
  const parsed = toNumber(value, defaultValue);
  return parsed < 0 ? 0 : parsed;
};

const buildSalaryStructurePayload = (body = {}) => {
  const basicSalary = getNumericValue(body.basicSalary, 0);
  const hra = getNumericValue(body.hra, 0);
  const allowance = getNumericValue(body.allowance, 0);
  const fixedBonus = getNumericValue(
    body.fixedBonus ?? body.bonus,
    0
  );
  const fixedDeduction = getNumericValue(
    body.fixedDeduction ?? body.deduction,
    0
  );
  const tdsPercentage = Math.min(
    Math.max(getNumericValue(body.tdsPercentage, 0), 0),
    100
  );

  return {
    basicSalary,
    hra,
    allowance,
    fixedBonus,
    fixedDeduction,
    tdsPercentage,
  };
};

// ===============================
// Create Salary Structure
// ===============================
exports.createSalaryStructure = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    const existingSalaryStructure = await SalaryStructure.findOne({
      userId,
      isActive: true,
    });

    if (existingSalaryStructure) {
      return res.status(400).json({
        success: false,
        message: "An active salary structure already exists for this user.",
      });
    }

    const salaryData = buildSalaryStructurePayload(req.body);
    const { basicSalary, hra, allowance, fixedBonus, fixedDeduction, tdsPercentage } = salaryData;

    if (basicSalary < 0 || hra < 0 || allowance < 0 || fixedBonus < 0 || fixedDeduction < 0) {
      return res.status(400).json({
        success: false,
        message: "Salary values cannot be negative.",
      });
    }

    const salaryStructure = await SalaryStructure.create({
      userId,
      basicSalary,
      hra,
      allowance,
      fixedBonus,
      fixedDeduction,
      tdsPercentage,
    });

    return res.status(201).json({
      success: true,
      message: "Salary structure created successfully",
      data: salaryStructure,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An active salary structure already exists for this user.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// Get Salary Structure
// ===============================
exports.getSalaryStructure = async (req, res) => {
  try {
    const salary = await SalaryStructure.find().populate("userId", "name email role");

    return res.status(200).json({
      success: true,
      data: salary,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getSalaryStructureByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const salaryStructure = await SalaryStructure.findOne({
      userId,
      isActive: true,
    }).populate("userId", "firstName lastName email role");

    if (!salaryStructure) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: salaryStructure,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateSalaryStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const existingSalary = await SalaryStructure.findById(id);

    if (!existingSalary) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found",
      });
    }

    const updates = buildSalaryStructurePayload(req.body);

    const finalBasicSalary = req.body.basicSalary !== undefined ? updates.basicSalary : existingSalary.basicSalary;
    const finalHra = req.body.hra !== undefined ? updates.hra : existingSalary.hra;
    const finalAllowance = req.body.allowance !== undefined ? updates.allowance : existingSalary.allowance;
    const finalFixedBonus = req.body.fixedBonus !== undefined || req.body.bonus !== undefined ? updates.fixedBonus : existingSalary.fixedBonus ?? existingSalary.bonus ?? 0;
    const finalFixedDeduction = req.body.fixedDeduction !== undefined || req.body.deduction !== undefined ? updates.fixedDeduction : existingSalary.fixedDeduction ?? existingSalary.deduction ?? 0;
    const finalTdsPercentage = req.body.tdsPercentage !== undefined ? updates.tdsPercentage : existingSalary.tdsPercentage ?? 0;

    if (finalBasicSalary < 0 || finalHra < 0 || finalAllowance < 0 || finalFixedBonus < 0 || finalFixedDeduction < 0) {
      return res.status(400).json({
        success: false,
        message: "Salary values cannot be negative.",
      });
    }

    const grossSalary =
      Number(finalBasicSalary) +
      Number(finalHra) +
      Number(finalAllowance) +
      Number(finalFixedBonus);

    const tdsAmount = (grossSalary * Number(finalTdsPercentage)) / 100;
    const netSalary = grossSalary - Number(finalFixedDeduction) - tdsAmount;

    const updatedSalary = await SalaryStructure.findByIdAndUpdate(
      id,
      {
        userId: req.body.userId || existingSalary.userId,
        basicSalary: finalBasicSalary,
        hra: finalHra,
        allowance: finalAllowance,
        fixedBonus: finalFixedBonus,
        fixedDeduction: finalFixedDeduction,
        tdsPercentage: finalTdsPercentage,
        grossSalary,
        netSalary,
      },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Salary structure updated successfully",
      data: updatedSalary,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// Process Payroll
// ===============================
exports.processPayroll = async (req, res) => {
  try {
    const { userId, month, year, bonus, deduction, extraBonus, extraDeduction } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    const parsedMonth = Number(month);
    const parsedYear = Number(year);

    if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      return res.status(400).json({
        success: false,
        message: "Month must be a valid number between 1 and 12.",
      });
    }

    if (!Number.isInteger(parsedYear) || parsedYear < 2000) {
      return res.status(400).json({
        success: false,
        message: "Year must be a valid 4-digit number.",
      });
    }

    const salaryStructure = await SalaryStructure.findOne({
      userId,
      isActive: true,
    });

    if (!salaryStructure) {
      return res.status(404).json({
        success: false,
        message: "Salary structure not found",
      });
    }

    const alreadyProcessed = await Payroll.findOne({
      userId,
      month: parsedMonth,
      year: parsedYear,
    });

    if (alreadyProcessed) {
      return res.status(400).json({
        success: false,
        message: "Payroll already processed",
      });
    }

    const fixedBonus = getNumericValue(salaryStructure.fixedBonus ?? salaryStructure.bonus ?? 0, 0);
    const fixedDeduction = getNumericValue(salaryStructure.fixedDeduction ?? salaryStructure.deduction ?? 0, 0);
    const extraBonusValue = getNumericValue(extraBonus ?? bonus ?? 0, 0);
    const extraDeductionValue = getNumericValue(extraDeduction ?? deduction ?? 0, 0);

    const grossSalary =
      Number(salaryStructure.basicSalary) +
      Number(salaryStructure.hra) +
      Number(salaryStructure.allowance) +
      fixedBonus +
      extraBonusValue;

    const totalDeduction = fixedDeduction + extraDeductionValue;
    const tdsAmount =
      (grossSalary * Number(salaryStructure.tdsPercentage ?? 0)) / 100;
    const netSalary = grossSalary - totalDeduction - tdsAmount;

    const payroll = await Payroll.create({
      userId,
      salaryStructureId: salaryStructure._id,
      month: parsedMonth,
      year: parsedYear,
      basicSalary: salaryStructure.basicSalary,
      hra: salaryStructure.hra,
      allowance: salaryStructure.allowance,
      fixedBonus,
      fixedDeduction,
      extraBonus: extraBonusValue,
      extraDeduction: extraDeductionValue,
      grossSalary,
      tdsPercentage: salaryStructure.tdsPercentage ?? 0,
      tdsAmount,
      totalDeduction,
      netSalary,
      status: "processed",
    });

    return res.status(201).json({
      success: true,
      message: "Payroll processed successfully",
      data: payroll,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Payroll for this user and month already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// Generate Payslip
// ===============================
exports.generatePayslip = async (req, res) => {
  try {
    const { payrollId } = req.body;

    if (!payrollId) {
      return res.status(400).json({
        success: false,
        message: "Payroll ID is required.",
      });
    }

    const payroll = await Payroll.findById(payrollId);

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    if (payroll.status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Payslip can only be generated when payroll status is paid",
      });
    }

    const existingPayslip = await Payslip.findOne({ payrollId });

    if (existingPayslip) {
      return res.status(400).json({
        success: false,
        message: "Payslip already generated",
      });
    }

    const payslip = await Payslip.create({
      payrollId: payroll._id,
      userId: payroll.userId,
      month: payroll.month,
      year: payroll.year,
      basicSalary: payroll.basicSalary,
      hra: payroll.hra,
      allowance: payroll.allowance,
      fixedBonus: payroll.fixedBonus,
      extraBonus: payroll.extraBonus,
      grossSalary: payroll.grossSalary,
      fixedDeduction: payroll.fixedDeduction,
      extraDeduction: payroll.extraDeduction,
      totalDeduction: payroll.totalDeduction,
      tdsPercentage: payroll.tdsPercentage,
      tdsAmount: payroll.tdsAmount,
      netSalary: payroll.netSalary,
    });

    const populatedPayslip = await Payslip.findById(payslip._id).populate("userId", "name email");

    return res.status(201).json({
      success: true,
      message: "Payslip generated successfully",
      data: populatedPayslip,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// Get Payroll
// ===============================
exports.getPayroll = async (req, res) => {
  try {
    const payroll = await Payroll.find()
      .populate("userId", "name email")
      .populate("salaryStructureId");

    return res.status(200).json({
      success: true,
      data: payroll,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// Get Payslips
// ===============================
exports.getPayslips = async (req, res) => {
  try {
    const payslips = await Payslip.find()
      .populate("userId", "name email")
      .populate("payrollId");

    return res.status(200).json({
      success: true,
      data: payslips,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// Mark Salary Paid
// ===============================
exports.markSalaryPaid = async (req, res) => {
  try {
    const { payrollId } = req.body;

    if (!payrollId) {
      return res.status(400).json({
        success: false,
        message: "Payroll ID is required.",
      });
    }

    const payroll = await Payroll.findByIdAndUpdate(
      payrollId,
      {
        status: "paid",
        paymentDate: new Date(),
      },
      { new: true }
    );

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Salary marked as paid",
      data: payroll,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};