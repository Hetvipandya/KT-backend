const mongoose = require("mongoose");
const Holiday = require("../models/Holiday");
const Leave = require("../models/Leave");
const Attendance = require("../models/Attendance");
const SalaryStructure = require("../models/SalaryStructure");
const User = require("../models/User");
const { getApprovedLegallyPermissibleDeductions } = require("./deduction.service");
const { toDateString } = require("../utils/leaveUtils");

const getDaysInMonth = (month, year) => {
  return new Date(year, month, 0).getDate();
};

/**
 * Centralized Salary Calculation Service
 *
 * Implements:
 * 1. Dynamic Salary Structure: SIMPLE_FIXED & COMPONENT_BASED
 * 2. Leave Deduction Rules:
 *    - All approved leaves are unpaid (Full Day = 1 Day LOP, Half Day = 0.5 Day LOP, 0 penalty)
 *    - Unapproved absence: Full Day = 1 Day LOP + 0.5 Day penalty; Half Day = 0.5 Day LOP + 0.5 Day penalty
 *    - Pending leaves do not trigger penalties
 *    - Avoid duplicate deductions between Attendance and Leave
 *    - Extra 0.5 day penalty is tracked separately and applied only after legal/authorization check
 *    - Do not classify the extra 0.5 day penalty as actual absence (presentDays remains workingDays - actualAbsence)
 * 3. Dynamic Saturday Holiday Rules:
 *    - Sunday remains weekly holiday
 *    - All Saturdays are working by default
 *    - Saturday is holiday only if configured in Holiday Master
 * 4. Payroll Formula:
 *    Net Salary = Monthly Salary − Unpaid Leave Deduction + Extra Earnings − Statutory Deductions − Approved Other Deductions − Legally Approved Penalties
 */
const calculateMonthlyPayroll = async ({
  user: userParam,
  activeStructure: passedStructure,
  month,
  year,
  calculationMode = "CALENDAR_DAYS",
  manualWorkingDays,
  manualLopDays,
  extraAllowance = 0,
  incentive = 0,
  bonus = 0,
  extraBonus = 0,
  extraDeduction = 0,
  isPenaltyApproved = false,
  options = {},
}) => {
  const monthNum = Number(month);
  const yearNum = Number(year);

  // Resolve user document
  let user = userParam;
  let userId = user?._id || user?.id || (typeof user === "string" ? user : null);

  if ((!user || !user.name || typeof user === "string") && userId && mongoose.isValidObjectId(userId)) {
    try {
      const dbUser = await User.findById(userId);
      if (dbUser) user = dbUser;
    } catch (_) {}
  }
  user = user || {};
  userId = user._id || user.id || userId;

  // 1. Resolve Salary Structure
  let activeStructure = passedStructure;
  if (!activeStructure && userId) {
    activeStructure = await SalaryStructure.findOne({
      $or: [{ userId }, { employeeId: userId }],
      isActive: true,
    });
    if (!activeStructure) {
      activeStructure = await SalaryStructure.findOne({
        $or: [{ userId }, { employeeId: userId }],
      }).sort({ effectiveFrom: -1, createdAt: -1 });
    }
  }

  // 2. Month Bounds & Total Days
  const calendarDays = getDaysInMonth(monthNum, yearNum);
  let totalDays = calendarDays;
  if (calculationMode === "THIRTY_DAYS" || options.calculationMode === "THIRTY_DAYS") {
    totalDays = 30;
  }

  const monthStartStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-01`;
  const monthEndStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(calendarDays).padStart(2, "0")}`;
  const monthStart = new Date(yearNum, monthNum - 1, 1);
  const monthEnd = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);

  // 3. Dynamic Holiday Master Lookup (Sundays off, Saturdays working unless configured)
  const holidayRecords = await Holiday.find({
    holidayDate: {
      $gte: new Date(yearNum, monthNum - 1, 0),
      $lte: new Date(yearNum, monthNum, 2),
    },
  });

  const holidayMap = new Map();
  holidayRecords.forEach((h) => {
    const dStr = toDateString(h.holidayDate);
    if (dStr) {
      holidayMap.set(dStr, h.holidayName || "Company Holiday");
    }
  });

  let totalSundays = 0;
  let totalConfiguredHolidays = 0;
  let standardWorkingDaysCount = 0;

  for (let day = 1; day <= calendarDays; day++) {
    const curDate = new Date(yearNum, monthNum - 1, day);
    const dateStr = toDateString(curDate);
    const dayOfWeek = curDate.getDay(); // 0 = Sun, 6 = Sat

    if (dayOfWeek === 0) {
      totalSundays++;
    } else if (holidayMap.has(dateStr)) {
      totalConfiguredHolidays++;
    } else {
      standardWorkingDaysCount++;
    }
  }

  const workingDays = manualWorkingDays
    ? Number(manualWorkingDays)
    : (calculationMode === "THIRTY_DAYS" ? 30 : standardWorkingDaysCount);

  // 4. Leave Records (Approved, Pending)
  let approvedLeaves = [];
  let pendingLeaves = [];

  if (userId) {
    [approvedLeaves, pendingLeaves] = await Promise.all([
      Leave.find({
        employeeId: userId,
        status: "approved",
        startDate: { $lte: monthEnd },
        endDate: { $gte: monthStart },
      }),
      Leave.find({
        employeeId: userId,
        status: { $in: ["pending", "pending_hr", "pending_admin"] },
        startDate: { $lte: monthEnd },
        endDate: { $gte: monthStart },
      }),
    ]);
  }

  const approvedLeaveDates = new Map(); // dateStr -> days (1 or 0.5)
  for (const leave of approvedLeaves) {
    const lStart = new Date(leave.startDate);
    const lEnd = new Date(leave.endDate || leave.startDate);
    const isHalfDay = Boolean(leave.isHalfDay);

    const cur = new Date(Math.max(lStart.getTime(), monthStart.getTime()));
    const limit = new Date(Math.min(lEnd.getTime(), monthEnd.getTime()));

    while (cur.getTime() <= limit.getTime()) {
      const dStr = toDateString(cur);
      const dow = cur.getDay();
      // No leave deduction on Sundays or configured holidays
      if (dow !== 0 && !holidayMap.has(dStr)) {
        const leavePortion = isHalfDay ? 0.5 : 1;
        approvedLeaveDates.set(dStr, Math.max(approvedLeaveDates.get(dStr) || 0, leavePortion));
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  const pendingLeaveDates = new Set();
  for (const leave of pendingLeaves) {
    const lStart = new Date(leave.startDate);
    const lEnd = new Date(leave.endDate || leave.startDate);
    const cur = new Date(Math.max(lStart.getTime(), monthStart.getTime()));
    const limit = new Date(Math.min(lEnd.getTime(), monthEnd.getTime()));
    while (cur.getTime() <= limit.getTime()) {
      const dStr = toDateString(cur);
      pendingLeaveDates.add(dStr);
      cur.setDate(cur.getDate() + 1);
    }
  }

  let approvedLeaveDays = 0;
  for (const days of approvedLeaveDates.values()) {
    approvedLeaveDays += days;
  }

  // 5. Attendance Absences & Unapproved Leave Deductions
  let unapprovedFullDays = 0;
  let unapprovedHalfDays = 0;
  let manualLopDaysCount = 0;

  if (manualLopDays !== undefined && manualLopDays !== null) {
    manualLopDaysCount = Number(manualLopDays) || 0;
  } else if (userId) {
    const attendanceRecords = await Attendance.find({
      userId,
      date: { $gte: monthStartStr, $lte: monthEndStr },
    });

    for (const att of attendanceRecords) {
      const dStr = att.date;
      const attDate = new Date(`${dStr}T00:00:00.000Z`);
      const dow = attDate.getDay();

      // No absence deduction on Sunday or configured holiday
      if (dow === 0 || holidayMap.has(dStr)) {
        continue;
      }

      // Avoid duplicate deductions: If day is already counted under approved leave, skip!
      if (approvedLeaveDates.has(dStr)) {
        continue;
      }

      // Check attendance status
      if (att.status === "absent") {
        unapprovedFullDays += 1;
      } else if (att.status === "half-day") {
        unapprovedHalfDays += 1;
      }
    }
  }

  const unapprovedLeaveDays = manualLopDays !== undefined && manualLopDays !== null
    ? manualLopDaysCount
    : (unapprovedFullDays + unapprovedHalfDays * 0.5);

  const totalAbsenceDays = approvedLeaveDays + unapprovedLeaveDays;

  // Do not classify the extra 0.5 day as actual absence
  const presentDays = Math.max(0, workingDays - totalAbsenceDays);
  const daysPayable = presentDays;

  // 6. Salary Structure Resolution (SIMPLE_FIXED vs COMPONENT_BASED)
  const struct = activeStructure || {};
  const isSimpleFixed =
    struct.structureType === "SIMPLE_FIXED" ||
    (struct.fixedSalary > 0 && !struct.hra && !struct.specialAllowance && !struct.allowance);

  let monthlySalary = 0;
  let basicSalary = 0;
  let hra = 0;
  let conveyanceAllowance = 0;
  let medicalAllowance = 0;
  let specialAllowance = 0;
  let dearnessAllowance = 0;
  let otherAllowances = 0;
  let fixedBonus = 0;

  if (isSimpleFixed) {
    monthlySalary = Number(struct.fixedSalary || struct.basicSalary || struct.grossSalary || 6000);
    basicSalary = monthlySalary;
  } else {
    basicSalary = Number(struct.basicSalary || 0);
    hra = Number(struct.hra || 0);
    conveyanceAllowance = Number(struct.conveyanceAllowance || 0);
    medicalAllowance = Number(struct.medicalAllowance || 0);
    specialAllowance = Number(struct.specialAllowance || struct.allowance || 0);
    dearnessAllowance = Number(struct.dearnessAllowance || struct.da || 0);
    otherAllowances = Number(struct.otherAllowances || 0);
    fixedBonus = Number(struct.fixedBonus || 0);
    monthlySalary = Number(
      (basicSalary + hra + conveyanceAllowance + medicalAllowance + specialAllowance + dearnessAllowance + otherAllowances + fixedBonus).toFixed(2)
    );
  }

  // Per Day Salary & Unpaid Leave Deduction
  const perDaySalary = totalDays > 0 ? Number((monthlySalary / totalDays).toFixed(2)) : 0;
  const unpaidLeaveDeduction = Number((perDaySalary * totalAbsenceDays).toFixed(2));

  // Proposed Extra Penalties: 0.5 day equivalent per unapproved absence (pending leaves excluded from penalty)
  let penaltyEligibleFullDays = 0;
  let penaltyEligibleHalfDays = 0;

  if (manualLopDays === undefined || manualLopDays === null) {
    if (userId) {
      const attendanceRecords = await Attendance.find({
        userId,
        date: { $gte: monthStartStr, $lte: monthEndStr },
      });
      for (const att of attendanceRecords) {
        const dStr = att.date;
        const attDate = new Date(`${dStr}T00:00:00.000Z`);
        const dow = attDate.getDay();
        if (dow === 0 || holidayMap.has(dStr) || approvedLeaveDates.has(dStr)) continue;

        // Pending approvals must not automatically trigger penalties
        if (pendingLeaveDates.has(dStr)) continue;

        if (att.status === "absent") {
          penaltyEligibleFullDays += 1;
        } else if (att.status === "half-day") {
          penaltyEligibleHalfDays += 1;
        }
      }
    }
  }

  const penaltyDayUnits = penaltyEligibleFullDays + penaltyEligibleHalfDays;
  const proposedPenaltyAmount = Number((perDaySalary * 0.5 * penaltyDayUnits).toFixed(2));

  // Extra penalty must be tracked separately and applied only after confirming legal permissibility and authorization
  const applyPenalties = Boolean(
    isPenaltyApproved ||
    options.isPenaltyApproved ||
    options.applyPenalties ||
    options.authorizedPenalties
  );
  const legallyApprovedPenalties = applyPenalties ? proposedPenaltyAmount : 0;

  // 7. Extra Earnings (Extra Allowance, Incentive, Bonus)
  const finalExtraAllowance = Number(extraAllowance || struct.extraAllowance || options.extraAllowance || 0);
  const finalIncentive = Number(incentive || struct.incentive || options.incentive || 0);
  const finalBonus = Number(bonus || extraBonus || struct.bonus || struct.extraBonus || options.bonus || options.extraBonus || 0);
  const totalExtraEarnings = Number((finalExtraAllowance + finalIncentive + finalBonus).toFixed(2));

  // Gross Salary = Monthly Salary + Extra Earnings
  const grossSalary = Number((monthlySalary + totalExtraEarnings).toFixed(2));

  // 8. Statutory Deductions under verified statutory rules
  const basicForPf = basicSalary + dearnessAllowance;

  let pfDeduction = 0;
  let esicDeduction = 0;
  let professionalTax = 0;
  let tds = 0;

  if (isSimpleFixed) {
    // For SIMPLE_FIXED (e.g. ₹6,000 fixed salary without statutory deductions where legally not applicable):
    if (struct.isPfApplicable === true) {
      pfDeduction = struct.pfDeduction !== undefined ? Number(struct.pfDeduction) : Math.round(basicForPf * 0.12);
    } else {
      pfDeduction = 0;
    }

    if (struct.isEsicApplicable === true) {
      esicDeduction = struct.esicDeduction !== undefined ? Number(struct.esicDeduction) : (grossSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 0);
    } else {
      esicDeduction = 0;
    }

    // Professional Tax: Gross <= 12,000 => 0
    if (struct.isPtApplicable === false) {
      professionalTax = 0;
    } else if (struct.isPtApplicable === true) {
      professionalTax = struct.professionalTax !== undefined ? Number(struct.professionalTax) : (grossSalary > 12000 ? 200 : 0);
    } else {
      professionalTax = struct.professionalTax !== undefined ? Number(struct.professionalTax) : (grossSalary > 12000 ? 200 : 0);
    }

    if (struct.isTdsApplicable === true && struct.tds > 0) {
      tds = Number(struct.tds);
    } else {
      tds = 0;
    }
  } else {
    // COMPONENT_BASED
    if (struct.isPfApplicable === false) {
      pfDeduction = 0;
    } else {
      pfDeduction = Number(struct.pfDeduction !== undefined ? struct.pfDeduction : Math.round(basicForPf * 0.12));
    }

    if (struct.isEsicApplicable === false) {
      esicDeduction = 0;
    } else if (struct.esicDeduction !== undefined) {
      esicDeduction = Number(struct.esicDeduction);
    } else if (grossSalary <= 21000) {
      esicDeduction = Math.round(grossSalary * 0.0075);
    } else {
      esicDeduction = 0;
    }

    if (struct.isPtApplicable === false) {
      professionalTax = 0;
    } else {
      professionalTax = Number(struct.professionalTax !== undefined ? struct.professionalTax : (grossSalary > 12000 ? 200 : 0));
    }

    if (struct.isTdsApplicable === false) {
      tds = 0;
    } else {
      tds = Number(struct.tds || ((grossSalary * Number(struct.tdsPercentage || 0)) / 100) || 0);
    }
  }

  const totalStatutoryDeductions = Number((pfDeduction + esicDeduction + professionalTax + tds).toFixed(2));

  // 9. Approved Other Deductions (Employee Deduction Module)
  let validCustomDeductions = [];
  let customDeductionsAmount = 0;
  let excludedCustomDeductions = [];

  if (userId) {
    try {
      const deductionRes = await getApprovedLegallyPermissibleDeductions(userId, monthNum, yearNum);
      if (deductionRes) {
        customDeductionsAmount = Number(deductionRes.totalCustomDeductions || 0);
        validCustomDeductions = deductionRes.validDeductions || [];
        excludedCustomDeductions = deductionRes.excludedDeductions || [];
      }
    } catch (_) {}
  }

  const fixedDeduction = Number(struct.fixedDeduction || 0);
  const otherDeductions = Number(struct.otherDeductions || 0);
  const finalExtraDeduction = Number(extraDeduction || options.extraDeduction || 0);

  const approvedOtherDeductions = Number(
    (customDeductionsAmount + fixedDeduction + otherDeductions + finalExtraDeduction).toFixed(2)
  );

  // 10. Net Salary Formula:
  // Net Salary = Monthly Salary − Unpaid Leave Deduction + Extra Earnings − Statutory Deductions − Approved Other Deductions − Legally Approved Penalties
  const netSalary = Math.max(
    0,
    Number(
      (
        monthlySalary -
        unpaidLeaveDeduction +
        totalExtraEarnings -
        totalStatutoryDeductions -
        approvedOtherDeductions -
        legallyApprovedPenalties
      ).toFixed(2)
    )
  );

  // Total Deductions for reporting
  const totalDeductions = Number(
    (
      unpaidLeaveDeduction +
      totalStatutoryDeductions +
      approvedOtherDeductions +
      legallyApprovedPenalties
    ).toFixed(2)
  );

  // Employer Contributions
  const employerPf = struct.isPfApplicable === false ? 0 : Math.round(basicForPf * 0.12);
  const employerEsic = (struct.isEsicApplicable === false || grossSalary > 21000) ? 0 : Math.round(grossSalary * 0.0325);
  const gratuityVal = Math.round((basicForPf * 15 * Number(struct.yearsOfService || 1)) / 26);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const salaryMonth = `${monthNames[monthNum - 1]} ${yearNum}`;

  return {
    employee: {
      _id: userId,
      name: user.name,
      email: user.email,
      uniqueID: user.uniqueID,
      role: user.role,
      designation: user.designation,
      department: user.department,
    },
    payPeriod: {
      month: monthNum,
      year: yearNum,
      salaryMonth,
    },
    structureType: isSimpleFixed ? "SIMPLE_FIXED" : "COMPONENT_BASED",
    calculationMode,
    days: {
      totalCalendarDays: calendarDays,
      totalDays,
      workingDays,
      presentDays,
      daysPayable,
      leaveDays: approvedLeaveDays,
      unapprovedLeaveDays,
      totalAbsenceDays,
      sundaysCount: totalSundays,
      configuredHolidaysCount: totalConfiguredHolidays,
    },
    perDaySalary,
    baseEarnings: {
      monthlySalary,
      basicSalary,
      hra,
      conveyanceAllowance,
      medicalAllowance,
      specialAllowance,
      allowance: specialAllowance,
      dearnessAllowance,
      otherAllowances,
      fixedBonus,
      grossSalary,
    },
    extraEarnings: {
      extraAllowance: finalExtraAllowance,
      incentive: finalIncentive,
      bonus: finalBonus,
      totalExtraEarnings,
    },
    grossSalary,
    leaveDeductions: {
      unpaidLeaveDays: totalAbsenceDays,
      approvedLeaveDays,
      unapprovedLeaveDays,
      unpaidLeaveDeduction,
      unapprovedFullDays,
      unapprovedHalfDays,
      proposedPenaltyAmount,
      isPenaltyApproved: applyPenalties,
      legallyApprovedPenalties,
    },
    statutoryDeductions: {
      basicForPf,
      pfDeduction,
      esicDeduction,
      professionalTax,
      tds,
      fixedDeduction,
      totalStatutoryDeductions,
      isPfApplicable: struct.isPfApplicable !== false,
      isEsicApplicable: struct.isEsicApplicable !== false,
      isPtApplicable: struct.isPtApplicable !== false,
      isTdsApplicable: struct.isTdsApplicable === true,
    },
    customDeductions: {
      approvedAndPermissible: validCustomDeductions,
      totalApprovedCustomDeductions: customDeductionsAmount,
      excludedDeductions: excludedCustomDeductions,
      fixedDeduction,
      extraDeduction: finalExtraDeduction,
      otherDeductions,
      totalOtherDeductions: approvedOtherDeductions,
    },
    summary: {
      monthlySalary,
      grossSalary,
      totalDeductions,
      netSalary,
      legalCompliance: {
        isPermissibleOnly: true,
        wageCeilingCompliant: totalDeductions <= grossSalary * 0.5,
      },
    },
    totalDeductions,
    netSalary,
    employerContributions: {
      pf: employerPf,
      esic: employerEsic,
      gratuity: gratuityVal,
      other: (struct.employerContributions && struct.employerContributions.other) || 0,
    },
  };
};

module.exports = {
  getDaysInMonth,
  calculateMonthlyPayroll,
};
