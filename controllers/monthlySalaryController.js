const mongoose = require("mongoose");
const MonthlySalary = require("../models/MonthlySalary");
const SalaryStructure = require("../models/SalaryStructure");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Company = require("../models/Company");
const Branch = require("../models/Branch");

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const getDaysInMonth = (month, year) => {
  return new Date(year, month, 0).getDate();
};

// =====================================================
// GENERATE MONTHLY SALARY (HR PAYROLL FORMULA BASED)
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
      workingDays: manualWorkingDays,
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

    let totalDaysInMonth = getDaysInMonth(monthNum, yearNum);
    if (calculationMode === "THIRTY_DAYS") {
      totalDaysInMonth = 30;
    }

    const totalWorkingDays = manualWorkingDays ? Number(manualWorkingDays) : totalDaysInMonth;

    for (const user of targetUsers) {
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

      // Calculate Attendance Present and LOP Days
      let finalLopDays = 0;
      if (manualLopDays !== undefined && manualLopDays !== null) {
        finalLopDays = Number(manualLopDays) || 0;
      } else {
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

      const presentDays = Math.max(0, totalDaysInMonth - finalLopDays);

      // Formula 8: DAYS PAYABLE = (Total Working Days / Total Days) * Days Present
      const daysPayable = Math.round((totalWorkingDays / totalDaysInMonth) * presentDays);

      // Earnings Components
      const basic = activeStructure.basicSalary || 0;
      const hra = activeStructure.hra || 0;
      const conveyance = activeStructure.conveyanceAllowance || 0;
      const medical = activeStructure.medicalAllowance || 0;
      const special = activeStructure.specialAllowance || activeStructure.allowance || 0;
      const da = activeStructure.dearnessAllowance || 0;
      const otherAllowances = activeStructure.otherAllowances || 0;
      const fixedBonus = activeStructure.fixedBonus || 0;

      // Formula 1: GROSS SALARY = Basic + HRA + Conveyance + Special + DA + Other Allowances + Fixed Bonus + Extra Bonus
      const grossSalary = Number(
        (basic + hra + conveyance + medical + special + da + otherAllowances + fixedBonus + Number(extraBonus)).toFixed(2)
      );

      // Formula 9: BASIC FOR PF = Basic + DA
      const basicForPf = basic + da;

      // Per Day Salary & LOP Deduction
      const perDaySalary = totalDaysInMonth > 0 ? grossSalary / totalDaysInMonth : 0;
      const lopDeduction = Number((perDaySalary * finalLopDays).toFixed(2));

      // Formula 2: PF (Employee) = (Basic + DA) * 12%
      const pfDeduction = activeStructure.pfDeduction || Math.round(basicForPf * 0.12);

      // Formula 3: PF (Employer) = (Basic + DA) * 12%
      const employerPf = Math.round(basicForPf * 0.12);

      // Formula 4: ESI (Employee) = Gross Salary * 0.75%
      const esicDeduction = activeStructure.esicDeduction || Math.round(grossSalary * 0.0075);
      const employerEsic = Math.round(grossSalary * 0.0325);

      // Formula 5: PROFESSIONAL TAX = As per State Rules (Gross > 12000 => 200)
      const professionalTax = activeStructure.professionalTax || (grossSalary > 12000 ? 200 : 0);

      // TDS & Other Deductions
      const tds = activeStructure.tds || 0;
      const fixedDeduction = activeStructure.fixedDeduction || 0;
      const otherDeductions = activeStructure.otherDeductions || 0;

      // Formula 6: TOTAL DEDUCTIONS = PF + ESI + PT + LOP Deduction + TDS + Fixed + Extra + Other Deductions
      const totalDeduction = Number(
        (lopDeduction + pfDeduction + esicDeduction + professionalTax + tds + fixedDeduction + Number(extraDeduction) + otherDeductions).toFixed(2)
      );

      // Formula 7: NET SALARY = Gross Salary - Total Deductions
      const netSalary = Math.max(0, Number((grossSalary - totalDeduction).toFixed(2)));

      // Formula 10: GRATUITY = ((Basic + DA) * 15 * Years) / 26
      const gratuityVal = Math.round((basicForPf * 15 * (activeStructure.yearsOfService || 1)) / 26);

      const salaryMonthStr = `${monthNames[monthNum - 1]} ${yearNum}`;

      const snapshot = {
        basicSalary: basic,
        hra,
        conveyanceAllowance: conveyance,
        medicalAllowance: medical,
        specialAllowance: special,
        dearnessAllowance: da,
        otherAllowances,
        fixedBonus,
        grossSalary,
        basicForPf,
        pfDeduction,
        esicDeduction,
        professionalTax,
        tds,
        totalDeduction,
        netSalary,
        employerContributions: {
          pf: employerPf,
          esic: employerEsic,
          gratuity: gratuityVal,
        },
      };

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
          workingDays: totalWorkingDays,
          presentDays,
          daysPayable,
          leaveDays: 0,
          lopDays: finalLopDays,
          perDaySalary: Number(perDaySalary.toFixed(2)),
          lopDeduction,
          basicSalary: basic,
          hra,
          conveyanceAllowance: conveyance,
          medicalAllowance: medical,
          specialAllowance: special,
          allowance: special,
          dearnessAllowance: da,
          otherAllowances,
          fixedBonus,
          extraBonus: Number(extraBonus),
          grossSalary,
          basicForPf,
          pfDeduction,
          esicDeduction,
          professionalTax,
          tds,
          tdsPercentage: activeStructure.tdsPercentage || 0,
          tdsAmount: tds,
          fixedDeduction,
          extraDeduction: Number(extraDeduction),
          otherDeductions,
          totalDeduction,
          netSalary,
          employerContributions: {
            pf: employerPf,
            esic: employerEsic,
            gratuity: gratuityVal,
          },
          status: "Generated",
          generatedAt: new Date(),
          generatedBy: req.user ? req.user._id : null,
          remarks: remarks || `Generated for ${salaryMonthStr} as per HR Payroll Formulas`,
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
      message: `Generated monthly salary for ${generatedRecords.length} employee(s) using HR Payroll Formulas`,
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
      dearnessAllowance,
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
    if (dearnessAllowance !== undefined) salary.dearnessAllowance = dearnessAllowance;
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

    // Recompute Gross, Deductions, Net
    salary.grossSalary =
      Number(salary.basicSalary || 0) +
      Number(salary.hra || 0) +
      Number(salary.conveyanceAllowance || 0) +
      Number(salary.medicalAllowance || 0) +
      Number(salary.specialAllowance || 0) +
      Number(salary.dearnessAllowance || 0) +
      Number(salary.otherAllowances || 0) +
      Number(salary.fixedBonus || 0) +
      Number(salary.extraBonus || 0);

    salary.basicForPf = Number(salary.basicSalary || 0) + Number(salary.dearnessAllowance || 0);

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
    const targetSalaryId =
      (req.params && (req.params.id || req.params.salaryId)) ||
      (req.body && (req.body.id || req.body.salaryId));
    const { companyId, branchId, remarks } = req.body || {};

    // Support batch approval if salaryIds array is passed
    if (!targetSalaryId && Array.isArray(req.body && req.body.salaryIds) && req.body.salaryIds.length > 0) {
      const filter = { _id: { $in: req.body.salaryIds } };
      const updateData = {
        status: "Approved",
        approvedAt: new Date(),
        approvedBy: req.user ? req.user._id : null,
      };
      if (companyId) updateData.companyId = companyId;
      if (branchId) updateData.branchId = branchId;
      if (remarks) updateData.remarks = remarks;

      await MonthlySalary.updateMany(filter, { $set: updateData });
      const approvedList = await MonthlySalary.find(filter)
        .populate("employeeId userId", "name email uniqueID role designation department")
        .populate("companyId", "name companyName")
        .populate("branchId", "branchName");

      return res.status(200).json({
        success: true,
        message: `${approvedList.length} monthly salaries approved successfully`,
        count: approvedList.length,
        data: approvedList,
      });
    }

    if (!targetSalaryId || !mongoose.Types.ObjectId.isValid(targetSalaryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID",
      });
    }

    const salary = await MonthlySalary.findById(targetSalaryId);
    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Monthly salary record not found",
      });
    }

    if (companyId) {
      if (!mongoose.Types.ObjectId.isValid(companyId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid companyId",
        });
      }
      salary.companyId = companyId;
    }

    if (branchId) {
      if (!mongoose.Types.ObjectId.isValid(branchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branchId",
        });
      }
      salary.branchId = branchId;
    }

    if (remarks) {
      salary.remarks = remarks;
    }

    salary.status = "Approved";
    salary.approvedAt = new Date();
    salary.approvedBy = req.user ? req.user._id : null;

    await salary.save();

    let companyDoc = null;
    let branchDoc = null;
    if (salary.companyId && mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        if (typeof Company.findById === "function") {
          companyDoc = await Company.findById(salary.companyId);
        }
      } catch (_) {}
    }
    if (salary.branchId && mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        if (typeof Branch.findById === "function") {
          branchDoc = await Branch.findById(salary.branchId);
        }
      } catch (_) {}
    }

    const approvedSalary = await MonthlySalary.findById(salary._id)
      .populate("employeeId userId", "name email uniqueID role designation department")
      .populate("companyId", "name companyName")
      .populate("branchId", "branchName")
      .populate("approvedBy", "name email");

    const resultData =
      approvedSalary && approvedSalary.toObject ? approvedSalary.toObject() : (approvedSalary || salary);

    if (resultData) {
      if (companyDoc && !resultData.companyName) {
        resultData.companyName = companyDoc.companyName || companyDoc.name;
      } else if (resultData.companyId && typeof resultData.companyId === "object" && !resultData.companyName) {
        resultData.companyName = resultData.companyId.companyName || resultData.companyId.name;
      }

      if (branchDoc && !resultData.branchName) {
        resultData.branchName = branchDoc.branchName;
      } else if (resultData.branchId && typeof resultData.branchId === "object" && !resultData.branchName) {
        resultData.branchName = resultData.branchId.branchName;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Monthly salary approved successfully",
      data: resultData,
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
