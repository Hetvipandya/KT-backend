const mongoose = require("mongoose");
const MonthlySalary = require("../models/MonthlySalary");
const SalaryStructure = require("../models/SalaryStructure");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Helper to get total days in a given month and year
const getDaysInMonth = (month, year) => {
  return new Date(year, month, 0).getDate();
};

// =====================================================
// GENERATE MONTHLY SALARY
// POST /api/salaries/generate
// =====================================================
const generateMonthlySalary = async (req, res) => {
  try {
    const {
      companyId,
      branchId,
      financialYearId,
      month,
      year,
      employeeId,
      userId,
      calculationMode = "CALENDAR_DAYS",
      lopDays: manualLopDays,
      extraBonus = 0,
      extraDeduction = 0,
      remarks = "",
    } = req.body;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: "month and year are required",
      });
    }

    const monthNum = Number(month);
    const yearNum = Number(year);
    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: "Month must be between 1 and 12",
      });
    }

    const targetEmployeeId = employeeId || userId;

    // Determine target users/employees
    let targetUsers = [];
    if (targetEmployeeId) {
      const user = await User.findById(targetEmployeeId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }
      targetUsers = [user];
    } else {
      const query = { status: "Active" };
      if (companyId) query.companyId = companyId;
      if (branchId) query.branchId = branchId;

      targetUsers = await User.find(query);
      if (targetUsers.length === 0) {
        targetUsers = await User.find({});
      }
    }

    const generatedRecords = [];
    const skippedUsers = [];

    // Calculate total days for the month
    let totalDaysInMonth = getDaysInMonth(monthNum, yearNum);
    if (calculationMode === "THIRTY_DAYS") {
      totalDaysInMonth = 30;
    }

    for (const user of targetUsers) {
      // Find active salary structure for employee
      const activeStructure = await SalaryStructure.findOne({
        $or: [{ userId: user._id }, { employeeId: user._id }],
        isActive: true,
      });

      if (!activeStructure) {
        skippedUsers.push({
          userId: user._id,
          name: user.name,
          reason: "No active salary structure found",
        });
        continue;
      }

      // Calculate LOP (Loss of Pay) Days
      let finalLopDays = 0;
      if (manualLopDays !== undefined && manualLopDays !== null) {
        finalLopDays = Number(manualLopDays) || 0;
      } else {
        // Query Attendance records for the month/year for this user
        const startDateStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-01`;
        const endDateStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(totalDaysInMonth).padStart(2, "0")}`;

        const attendanceRecords = await Attendance.find({
          userId: user._id,
          date: { $gte: startDateStr, $lte: endDateStr },
        });

        let absentCount = 0;
        let halfDayCount = 0;
        attendanceRecords.forEach((att) => {
          if (att.status === "absent") absentCount += 1;
          if (att.status === "half-day") halfDayCount += 1;
        });

        finalLopDays = absentCount + halfDayCount * 0.5;
      }

      const grossSalary = activeStructure.grossSalary;
      const perDaySalary = totalDaysInMonth > 0 ? grossSalary / totalDaysInMonth : 0;
      const lopDeduction = Number((perDaySalary * finalLopDays).toFixed(2));

      const totalDeductionBeforeLop = activeStructure.totalDeduction;
      const totalDeduction = Number((totalDeductionBeforeLop + lopDeduction + Number(extraDeduction)).toFixed(2));
      const totalGross = Number((grossSalary + Number(extraBonus)).toFixed(2));
      const netSalary = Math.max(0, Number((totalGross - totalDeduction).toFixed(2)));

      const salaryMonthStr = `${monthNames[monthNum - 1]} ${yearNum}`;

      // Snapshot of salary structure
      const snapshot = {
        basicSalary: activeStructure.basicSalary,
        hra: activeStructure.hra,
        conveyanceAllowance: activeStructure.conveyanceAllowance,
        medicalAllowance: activeStructure.medicalAllowance,
        specialAllowance: activeStructure.specialAllowance,
        otherAllowances: activeStructure.otherAllowances,
        fixedBonus: activeStructure.fixedBonus,
        pfDeduction: activeStructure.pfDeduction,
        esicDeduction: activeStructure.esicDeduction,
        professionalTax: activeStructure.professionalTax,
        tds: activeStructure.tds,
        fixedDeduction: activeStructure.fixedDeduction,
        otherDeductions: activeStructure.otherDeductions,
        grossSalary: activeStructure.grossSalary,
        totalDeduction: activeStructure.totalDeduction,
        netSalary: activeStructure.netSalary,
      };

      // Create or update monthly salary record
      const monthlySalary = await MonthlySalary.findOneAndUpdate(
        {
          employeeId: user._id,
          month: monthNum,
          year: yearNum,
        },
        {
          companyId: companyId || user.companyId || activeStructure.companyId || null,
          branchId: branchId || user.branchId || activeStructure.branchId || null,
          financialYearId: financialYearId || activeStructure.financialYearId || null,
          employeeId: user._id,
          userId: user._id,
          month: monthNum,
          year: yearNum,
          salaryMonth: salaryMonthStr,
          salaryStructureId: activeStructure._id,
          salaryStructureSnapshot: snapshot,
          calculationMode,
          totalDays: totalDaysInMonth,
          presentDays: Math.max(0, totalDaysInMonth - finalLopDays),
          leaveDays: 0,
          lopDays: finalLopDays,
          perDaySalary: Number(perDaySalary.toFixed(2)),
          lopDeduction,
          basicSalary: activeStructure.basicSalary,
          hra: activeStructure.hra,
          conveyanceAllowance: activeStructure.conveyanceAllowance,
          medicalAllowance: activeStructure.medicalAllowance,
          specialAllowance: activeStructure.specialAllowance,
          allowance: activeStructure.specialAllowance,
          otherAllowances: activeStructure.otherAllowances,
          fixedBonus: activeStructure.fixedBonus,
          extraBonus: Number(extraBonus),
          grossSalary: totalGross,
          pfDeduction: activeStructure.pfDeduction,
          esicDeduction: activeStructure.esicDeduction,
          professionalTax: activeStructure.professionalTax,
          tds: activeStructure.tds,
          tdsPercentage: activeStructure.tdsPercentage,
          tdsAmount: activeStructure.tds,
          fixedDeduction: activeStructure.fixedDeduction,
          extraDeduction: Number(extraDeduction),
          otherDeductions: activeStructure.otherDeductions,
          totalDeduction,
          netSalary,
          status: "Generated",
          generatedAt: new Date(),
          generatedBy: req.user ? req.user._id : null,
          remarks: remarks || `Generated for ${salaryMonthStr}`,
        },
        { upsert: true, new: true, runValidators: true }
      );

      generatedRecords.push(monthlySalary);
    }

    const populatedRecords = await MonthlySalary.find({
      _id: { $in: generatedRecords.map((r) => r._id) },
    }).populate("employeeId userId", "name email uniqueID role designation department");

    return res.status(201).json({
      success: true,
      message: `Generated monthly salary for ${generatedRecords.length} employee(s)`,
      count: generatedRecords.length,
      skipped: skippedUsers,
      data: populatedRecords,
    });
  } catch (error) {
    console.error("Generate Monthly Salary Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate monthly salary",
      error: error.message,
    });
  }
};

// =====================================================
// GET ALL MONTHLY SALARIES
// GET /api/salaries
// =====================================================
const getMonthlySalaries = async (req, res) => {
  try {
    const { month, year, status, employeeId, userId, companyId, branchId, financialYearId } = req.query;

    const query = {};
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);
    if (status) query.status = status;
    if (companyId) query.companyId = companyId;
    if (branchId) query.branchId = branchId;
    if (financialYearId) query.financialYearId = financialYearId;

    const targetEmp = employeeId || userId;
    if (targetEmp) {
      query.$or = [{ employeeId: targetEmp }, { userId: targetEmp }];
    }

    const salaries = await MonthlySalary.find(query)
      .populate("employeeId userId", "name email uniqueID role designation department")
      .populate("approvedBy", "name email")
      .populate("paidBy", "name email")
      .sort({ year: -1, month: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: salaries.length,
      data: salaries,
    });
  } catch (error) {
    console.error("Get Monthly Salaries Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch monthly salaries",
      error: error.message,
    });
  }
};

// =====================================================
// GET MONTHLY SALARY BY ID
// GET /api/salaries/:id
// =====================================================
const getMonthlySalaryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID",
      });
    }

    const salary = await MonthlySalary.findById(id)
      .populate("employeeId userId", "name email uniqueID role designation department panNumber joiningDate dateOfJoining bankDetails")
      .populate("approvedBy", "name email")
      .populate("paidBy", "name email");

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Monthly salary record not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: salary,
    });
  } catch (error) {
    console.error("Get Monthly Salary By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch monthly salary record",
      error: error.message,
    });
  }
};

// =====================================================
// UPDATE MONTHLY SALARY (BEFORE APPROVAL)
// PUT /api/salaries/:id
// =====================================================
const updateMonthlySalary = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID",
      });
    }

    const salary = await MonthlySalary.findById(id);
    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Monthly salary record not found",
      });
    }

    // Rule: Once approved or paid, salary cannot be edited casually without resetting approval.
    if (salary.status === "Approved" || salary.status === "Paid") {
      return res.status(400).json({
        success: false,
        message: `Salary record is already ${salary.status} and cannot be modified directly. Reset approval status first if modification is required.`,
      });
    }

    const {
      basicSalary,
      hra,
      conveyanceAllowance,
      medicalAllowance,
      specialAllowance,
      otherAllowances,
      fixedBonus,
      extraBonus,
      pfDeduction,
      esicDeduction,
      professionalTax,
      tds,
      fixedDeduction,
      extraDeduction,
      otherDeductions,
      lopDays,
      remarks,
    } = req.body;

    if (basicSalary !== undefined) salary.basicSalary = basicSalary;
    if (hra !== undefined) salary.hra = hra;
    if (conveyanceAllowance !== undefined) salary.conveyanceAllowance = conveyanceAllowance;
    if (medicalAllowance !== undefined) salary.medicalAllowance = medicalAllowance;
    if (specialAllowance !== undefined) salary.specialAllowance = specialAllowance;
    if (otherAllowances !== undefined) salary.otherAllowances = otherAllowances;
    if (fixedBonus !== undefined) salary.fixedBonus = fixedBonus;
    if (extraBonus !== undefined) salary.extraBonus = extraBonus;

    if (pfDeduction !== undefined) salary.pfDeduction = pfDeduction;
    if (esicDeduction !== undefined) salary.esicDeduction = esicDeduction;
    if (professionalTax !== undefined) salary.professionalTax = professionalTax;
    if (tds !== undefined) salary.tds = tds;
    if (fixedDeduction !== undefined) salary.fixedDeduction = fixedDeduction;
    if (extraDeduction !== undefined) salary.extraDeduction = extraDeduction;
    if (otherDeductions !== undefined) salary.otherDeductions = otherDeductions;
    if (remarks !== undefined) salary.remarks = remarks;

    if (lopDays !== undefined) {
      salary.lopDays = Number(lopDays);
      salary.perDaySalary = salary.totalDays > 0 ? salary.grossSalary / salary.totalDays : 0;
      salary.lopDeduction = Number((salary.perDaySalary * salary.lopDays).toFixed(2));
    }

    // Recompute Gross, Total Deduction, Net Salary
    salary.grossSalary =
      Number(salary.basicSalary || 0) +
      Number(salary.hra || 0) +
      Number(salary.conveyanceAllowance || 0) +
      Number(salary.medicalAllowance || 0) +
      Number(salary.specialAllowance || 0) +
      Number(salary.otherAllowances || 0) +
      Number(salary.fixedBonus || 0) +
      Number(salary.extraBonus || 0);

    salary.totalDeduction =
      Number(salary.pfDeduction || 0) +
      Number(salary.esicDeduction || 0) +
      Number(salary.professionalTax || 0) +
      Number(salary.tds || 0) +
      Number(salary.fixedDeduction || 0) +
      Number(salary.extraDeduction || 0) +
      Number(salary.otherDeductions || 0) +
      Number(salary.lopDeduction || 0);

    salary.netSalary = Math.max(0, Number((salary.grossSalary - salary.totalDeduction).toFixed(2)));

    await salary.save();

    const updatedSalary = await MonthlySalary.findById(salary._id).populate(
      "employeeId userId",
      "name email uniqueID role designation department"
    );

    return res.status(200).json({
      success: true,
      message: "Monthly salary updated successfully",
      data: updatedSalary,
    });
  } catch (error) {
    console.error("Update Monthly Salary Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update monthly salary record",
      error: error.message,
    });
  }
};

// =====================================================
// APPROVE MONTHLY SALARY
// POST /api/salaries/:id/approve
// =====================================================
const approveMonthlySalary = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID",
      });
    }

    const salary = await MonthlySalary.findById(id);
    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Monthly salary record not found",
      });
    }

    if (salary.status === "Approved") {
      return res.status(200).json({
        success: true,
        message: "Salary is already approved",
        data: salary,
      });
    }

    salary.status = "Approved";
    salary.approvedAt = new Date();
    salary.approvedBy = req.user ? req.user._id : null;

    await salary.save();

    const approvedSalary = await MonthlySalary.findById(salary._id)
      .populate("employeeId userId", "name email uniqueID role designation department")
      .populate("approvedBy", "name email");

    return res.status(200).json({
      success: true,
      message: "Monthly salary approved successfully",
      data: approvedSalary,
    });
  } catch (error) {
    console.error("Approve Monthly Salary Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve monthly salary",
      error: error.message,
    });
  }
};

// =====================================================
// MARK MONTHLY SALARY AS PAID
// POST /api/salaries/:id/pay
// =====================================================
const payMonthlySalary = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMode = "BANK_TRANSFER", paidAt, remarks } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID",
      });
    }

    const salary = await MonthlySalary.findById(id);
    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Monthly salary record not found",
      });
    }

    salary.status = "Paid";
    salary.paidAt = paidAt ? new Date(paidAt) : new Date();
    salary.paidBy = req.user ? req.user._id : null;
    salary.paymentMode = paymentMode;
    if (remarks) salary.remarks = remarks;

    await salary.save();

    const paidSalary = await MonthlySalary.findById(salary._id)
      .populate("employeeId userId", "name email uniqueID role designation department")
      .populate("paidBy", "name email");

    return res.status(200).json({
      success: true,
      message: "Monthly salary marked as Paid successfully",
      data: paidSalary,
    });
  } catch (error) {
    console.error("Pay Monthly Salary Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark monthly salary as paid",
      error: error.message,
    });
  }
};

// =====================================================
// CANCEL MONTHLY SALARY
// POST /api/salaries/:id/cancel
// =====================================================
const cancelMonthlySalary = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID",
      });
    }

    const salary = await MonthlySalary.findById(id);
    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Monthly salary record not found",
      });
    }

    salary.status = "Cancelled";
    await salary.save();

    return res.status(200).json({
      success: true,
      message: "Monthly salary record cancelled successfully",
      data: salary,
    });
  } catch (error) {
    console.error("Cancel Monthly Salary Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel monthly salary",
      error: error.message,
    });
  }
};

module.exports = {
  generateMonthlySalary,
  getMonthlySalaries,
  getMonthlySalaryById,
  updateMonthlySalary,
  approveMonthlySalary,
  payMonthlySalary,
  cancelMonthlySalary,
};
