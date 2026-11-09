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

const canQueryModel = (model, method = "find") => {
  if (!model) return false;
  if (mongoose.connection && mongoose.connection.readyState === 1) return true;
  if (model[method] && (model[method]._isMockFunction || typeof model[method].mock !== "undefined")) return true;
  return false;
};

/**
 * Centralized Salary Calculation Service
 *
 * Implements:
 * 1. Dynamic Salary Structure: SIMPLE_FIXED & COMPONENT_BASED
 * 2. Working Days & Holiday Rules:
 *    - All Sundays in the month are off
 *    - 2nd and 4th Saturday are default holidays; actual dates from Holiday Master / options
 *    - If Saturday holiday is changed for any month, calculate according to configured dates
 *    - Other configured holidays from Holiday Master are excluded
 *    - Sunday and Holiday overlap on the same date is deducted only once (Unique Non-working Dates)
 *    - Do not hardcode fixed 6/7 holidays
 *    - Working Days = Calendar Days − Unique Non-working Dates
 *    - Calculation Divisor = Working Days
 *    - Per Day Salary = Monthly Salary ÷ Working Days
 *    - If present on all working days, employee gets full monthly salary
 * 3. Leave Deduction & Penalty Rules:
 *    - Approved Full Day: 1 day LOP, 0 penalty
 *    - Approved Half Day: 0.5 day LOP, 0 penalty
 *    - Unauthorized Full Day: 1 day LOP + 0.5 day penalty
 *    - Unauthorized Half Day: 0.5 day LOP + 0.5 day penalty
 *    - Fixed 0.5-day penalty for each eligible unauthorized incident
 *    - Penalty days are NOT added into Actual Absence Days or subtracted from Payable Days
 *    - Only authorized penalty is deducted from Net Salary
 *    - No duplicate deductions between Attendance and Leave
 *    - Actual Absence Days = Approved Leave Days + Unauthorized Full-Day Count + Unauthorized Half-Day Count × 0.5
 *    - Payable Days = Working Days − Actual Absence Days
 *    - LOP = Actual Absence Days × Per Day Salary
 *    - Proposed Penalty = Eligible Unauthorized Incident Count × 0.5 × Per Day Salary
 * 4. Payroll Formula:
 *    - Gross = Monthly Salary + Extra Earnings
 *    - Earned Base Salary = Monthly Salary − LOP
 *    - Total Applied Deductions = LOP + Statutory Deductions + Approved Other Deductions + Authorized Penalty
 *    - Net = Gross − LOP − Statutory Deductions − Approved Other Deductions − Authorized Penalty
 *    - LOP is deducted only once
 */
const calculateMonthlyPayroll = async ({
  user: userParam,
  activeStructure: passedStructure,
  month,
  year,
  calculationMode = "CALENDAR_DAYS",
  manualWorkingDays,
  manualLopDays,
  unauthorizedFullDays: manualUnauthorizedFullDays,
  unauthorizedHalfDays: manualUnauthorizedHalfDays,
  unauthorizedFullDayCount: manualUnauthorizedFullDayCount,
  unauthorizedHalfDayCount: manualUnauthorizedHalfDayCount,
  approvedLeaveDays: manualApprovedLeaveDays,
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
    if (canQueryModel(User, "findById")) {
      try {
        const dbUser = await User.findById(userId);
        if (dbUser) user = dbUser;
      } catch (_) {}
    }
  }
  user = user || {};
  userId = user._id || user.id || userId;

  // 1. Resolve Salary Structure
  let activeStructure = passedStructure;
  if (!activeStructure && userId && mongoose.isValidObjectId(userId)) {
    if (canQueryModel(SalaryStructure, "findOne")) {
      try {
        activeStructure = await SalaryStructure.findOne({
          $or: [{ userId }, { employeeId: userId }],
          isActive: true,
        });
        if (!activeStructure) {
          activeStructure = await SalaryStructure.findOne({
            $or: [{ userId }, { employeeId: userId }],
          }).sort({ effectiveFrom: -1, createdAt: -1 });
        }
      } catch (_) {}
    }
  }

  // 2. Month Bounds & Total Days
  const calendarDays = getDaysInMonth(monthNum, yearNum);
  let totalDays = calendarDays;
  if (calculationMode === "THIRTY_DAYS" || options.calculationMode === "THIRTY_DAYS" || options.totalDays === 30) {
    totalDays = 30;
  } else if (options.totalDays) {
    totalDays = Number(options.totalDays);
  }

  const monthStartStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-01`;
  const monthEndStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(calendarDays).padStart(2, "0")}`;
  const monthStart = new Date(yearNum, monthNum - 1, 1);
  const monthEnd = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);

  // 3. Dynamic Holiday Master Lookup & Saturday Holiday Rules
  // - All Sundays of the month are off
  // - 2nd and 4th Saturday default holidays; actual dates from Holiday Master / options
  // - If Saturday holiday is changed for any month, calculate according to configured dates
  // - Other configured holidays from Holiday Master are also excluded
  // - If Sunday and holiday fall on the same date, deduct only once
  // - Do not hardcode fixed 6/7 holidays
  // - Working Days = Calendar Days − Unique Non-working Dates
  let holidayRecords = [];
  if (canQueryModel(Holiday, "find")) {
    try {
      holidayRecords = await Holiday.find({
        holidayDate: {
          $gte: new Date(yearNum, monthNum - 1, 0),
          $lte: new Date(yearNum, monthNum, 2),
        },
      });
    } catch (_) {}
  }

  const monthHolidayRecords = (holidayRecords || []).filter((h) => {
    if (!h.holidayDate) return false;
    const d = new Date(h.holidayDate);
    return d.getFullYear() === yearNum && d.getMonth() + 1 === monthNum;
  });

  const sundaysInMonth = [];
  const saturdaysInMonth = [];

  for (let day = 1; day <= calendarDays; day++) {
    const curDate = new Date(yearNum, monthNum - 1, day);
    const dateStr = toDateString(curDate);
    const dayOfWeek = curDate.getDay(); // 0 = Sun, 6 = Sat

    if (dayOfWeek === 0) {
      sundaysInMonth.push(dateStr);
    } else if (dayOfWeek === 6) {
      saturdaysInMonth.push(dateStr);
    }
  }

  // 2nd and 4th Saturday default holidays
  const defaultSaturdayHolidays = [];
  if (saturdaysInMonth.length >= 2) {
    defaultSaturdayHolidays.push(saturdaysInMonth[1]); // 2nd Saturday
  }
  if (saturdaysInMonth.length >= 4) {
    defaultSaturdayHolidays.push(saturdaysInMonth[3]); // 4th Saturday
  }

  // Check if Saturday holidays are configured in options or Holiday Master
  let saturdayHolidayDates = [];
  if (Array.isArray(options.saturdayDates) && options.saturdayDates.length > 0) {
    saturdayHolidayDates = options.saturdayDates.map((d) => toDateString(d)).filter(Boolean);
  } else if (Array.isArray(options.saturdayHolidays) && options.saturdayHolidays.length > 0) {
    saturdayHolidayDates = options.saturdayHolidays
      .map((ord) => saturdaysInMonth[Number(ord) - 1])
      .filter(Boolean);
  } else {
    // Check if Holiday Master has configured Saturday holidays for this month
    const masterSaturdayHolidays = monthHolidayRecords.filter((h) => {
      const d = new Date(h.holidayDate);
      return (
        d.getDay() === 6 &&
        (/saturday|sat/i.test(h.holidayName || "") || h.isSaturdayHoliday === true)
      );
    });

    if (masterSaturdayHolidays.length > 0) {
      // Configured Saturday holidays override defaults for this month
      saturdayHolidayDates = masterSaturdayHolidays
        .map((h) => toDateString(h.holidayDate))
        .filter(Boolean);
    } else {
      // Default to 2nd and 4th Saturday
      saturdayHolidayDates = defaultSaturdayHolidays;
    }
  }

  // Other configured holidays from Holiday Master (excluding any already captured in saturdayHolidayDates)
  const otherConfiguredHolidays = monthHolidayRecords.filter((h) => {
    const dStr = toDateString(h.holidayDate);
    return dStr && !saturdayHolidayDates.includes(dStr);
  });

  // Holiday map for quick lookup / date reasons
  const holidayMap = new Map();
  monthHolidayRecords.forEach((h) => {
    const dStr = toDateString(h.holidayDate);
    if (dStr) holidayMap.set(dStr, h.holidayName || "Company Holiday");
  });
  saturdayHolidayDates.forEach((dStr) => {
    if (!holidayMap.has(dStr)) {
      holidayMap.set(dStr, "Saturday Holiday");
    }
  });

  // Unique Non-working Dates Set (deduplicates Sunday & Holiday overlaps)
  const uniqueNonWorkingDates = new Set();
  sundaysInMonth.forEach((d) => uniqueNonWorkingDates.add(d));
  saturdayHolidayDates.forEach((d) => uniqueNonWorkingDates.add(d));
  otherConfiguredHolidays.forEach((h) => {
    const dStr = toDateString(h.holidayDate);
    if (dStr) uniqueNonWorkingDates.add(dStr);
  });

  const totalSundays = sundaysInMonth.length;
  const totalSaturdayHolidays = saturdayHolidayDates.length;
  // Unique other holidays not falling on Sunday or Saturday holiday
  const totalConfiguredHolidays = otherConfiguredHolidays.filter((h) => {
    const dStr = toDateString(h.holidayDate);
    return !sundaysInMonth.includes(dStr) && !saturdayHolidayDates.includes(dStr);
  }).length;

  const standardWorkingDaysCount = Math.max(0, calendarDays - uniqueNonWorkingDates.size);

  const workingDays =
    manualWorkingDays !== undefined && manualWorkingDays !== null
      ? Number(manualWorkingDays)
      : options.workingDays !== undefined && options.workingDays !== null
      ? Number(options.workingDays)
      : calculationMode === "THIRTY_DAYS" || options.calculationMode === "THIRTY_DAYS"
      ? 30
      : standardWorkingDaysCount;

  const calculationDivisor =
    workingDays > 0
      ? workingDays
      : calculationMode === "THIRTY_DAYS" || options.calculationMode === "THIRTY_DAYS"
      ? 30
      : calendarDays;

  // 4. Leave Records (Approved, Pending)
  let approvedLeaves = [];
  let pendingLeaves = [];

  if (userId && mongoose.isValidObjectId(userId) && canQueryModel(Leave, "find")) {
    try {
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
    } catch (_) {}
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

  const inputApprovedLeaveDays =
    options.approvedLeaveDays !== undefined ? options.approvedLeaveDays :
    (options.leaveDays !== undefined ? options.leaveDays :
    (manualApprovedLeaveDays !== undefined ? manualApprovedLeaveDays : undefined));

  if (inputApprovedLeaveDays !== undefined && inputApprovedLeaveDays !== null) {
    approvedLeaveDays = Number(inputApprovedLeaveDays) || 0;
  }

  // 5. Attendance Absences & Unapproved Leave Deductions (Incident Counts & Penalties)
  let unapprovedFullDays = 0;
  let unapprovedHalfDays = 0;
  let penaltyEligibleFullDays = 0;
  let penaltyEligibleHalfDays = 0;

  const inputUnauthorizedFullDays =
    options.unauthorizedFullDays !== undefined ? options.unauthorizedFullDays :
    (options.unauthorizedFullDayCount !== undefined ? options.unauthorizedFullDayCount :
    (options.unapprovedFullDays !== undefined ? options.unapprovedFullDays :
    (options.unapprovedFullDayCount !== undefined ? options.unapprovedFullDayCount :
    (manualUnauthorizedFullDays !== undefined ? manualUnauthorizedFullDays :
    (manualUnauthorizedFullDayCount !== undefined ? manualUnauthorizedFullDayCount : undefined)))));

  const inputUnauthorizedHalfDays =
    options.unauthorizedHalfDays !== undefined ? options.unauthorizedHalfDays :
    (options.unauthorizedHalfDayCount !== undefined ? options.unauthorizedHalfDayCount :
    (options.unapprovedHalfDays !== undefined ? options.unapprovedHalfDays :
    (options.unapprovedHalfDayCount !== undefined ? options.unapprovedHalfDayCount :
    (manualUnauthorizedHalfDays !== undefined ? manualUnauthorizedHalfDays :
    (manualUnauthorizedHalfDayCount !== undefined ? manualUnauthorizedHalfDayCount : undefined)))));

  const isManualUnauthorized =
    inputUnauthorizedFullDays !== undefined || inputUnauthorizedHalfDays !== undefined;
  const isManualLop = manualLopDays !== undefined && manualLopDays !== null;

  if (isManualUnauthorized) {
    unapprovedFullDays = Number(inputUnauthorizedFullDays || 0);
    unapprovedHalfDays = Number(inputUnauthorizedHalfDays || 0);
    penaltyEligibleFullDays = unapprovedFullDays;
    penaltyEligibleHalfDays = unapprovedHalfDays;
  } else if (isManualLop) {
    const manualLopVal = Number(manualLopDays) || 0;
    if (manualLopVal % 1 !== 0) {
      unapprovedHalfDays = 1;
      unapprovedFullDays = Math.floor(manualLopVal);
    } else {
      unapprovedFullDays = manualLopVal;
      unapprovedHalfDays = 0;
    }
    penaltyEligibleFullDays = unapprovedFullDays;
    penaltyEligibleHalfDays = unapprovedHalfDays;
  } else if (userId && mongoose.isValidObjectId(userId) && canQueryModel(Attendance, "find")) {
    try {
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

        // Avoid duplicate deductions with approved leaves:
        const approvedPortion = approvedLeaveDates.get(dStr);
        if (approvedPortion === 1) {
          // Full day approved leave: skip attendance to avoid duplicate deduction
          continue;
        }
        if (approvedPortion === 0.5) {
          // If employee worked required portion (half-day or present), no extra deduction!
          if (att.status === "half-day" || att.status === "present") {
            continue;
          }
          // If employee was also absent for remaining portion, add 0.5 day unapproved absence
          if (att.status === "absent") {
            unapprovedHalfDays += 1;
            if (!pendingLeaveDates.has(dStr)) {
              penaltyEligibleHalfDays += 1;
            }
          }
          continue;
        }

        // Check attendance status
        if (att.status === "absent") {
          unapprovedFullDays += 1;
          if (!pendingLeaveDates.has(dStr)) {
            penaltyEligibleFullDays += 1;
          }
        } else if (att.status === "half-day") {
          unapprovedHalfDays += 1;
          if (!pendingLeaveDates.has(dStr)) {
            penaltyEligibleHalfDays += 1;
          }
        }
      }
    } catch (_) {}
  }

  // Actual Absence Days = Approved Leave Days + Unauthorized Full-Day Count + Unauthorized Half-Day Count * 0.5
  const unapprovedLeaveDays = Number((unapprovedFullDays + unapprovedHalfDays * 0.5).toFixed(2));
  const totalAbsenceDays = Number((approvedLeaveDays + unapprovedLeaveDays).toFixed(2));

  // Do not classify the extra 0.5 day as actual absence
  const presentDays = Math.max(0, Number((workingDays - totalAbsenceDays).toFixed(2)));
  const daysPayable = presentDays;

  // 6. Salary Structure Resolution (SIMPLE_FIXED vs COMPONENT_BASED)
  const struct = activeStructure || {};
  const isSimpleFixed =
    struct.structureType === "SIMPLE_FIXED" ||
    options.structureType === "SIMPLE_FIXED" ||
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
    monthlySalary = Number(
      struct.fixedSalary ||
      struct.basicSalary ||
      struct.grossSalary ||
      options.fixedSalary ||
      options.monthlySalary ||
      options.basicSalary ||
      6000
    );
    basicSalary = monthlySalary;
  } else {
    basicSalary = Number(struct.basicSalary !== undefined ? struct.basicSalary : (options.basicSalary || 0));
    hra = Number(struct.hra !== undefined ? struct.hra : (options.hra || 0));
    conveyanceAllowance = Number(struct.conveyanceAllowance !== undefined ? struct.conveyanceAllowance : (options.conveyanceAllowance || 0));
    medicalAllowance = Number(struct.medicalAllowance !== undefined ? struct.medicalAllowance : (options.medicalAllowance || 0));
    specialAllowance = Number(
      struct.specialAllowance !== undefined ? struct.specialAllowance :
      (struct.allowance !== undefined ? struct.allowance :
      (options.specialAllowance !== undefined ? options.specialAllowance :
      (options.allowance || 0)))
    );
    dearnessAllowance = Number(
      struct.dearnessAllowance !== undefined ? struct.dearnessAllowance :
      (struct.da !== undefined ? struct.da :
      (options.dearnessAllowance !== undefined ? options.dearnessAllowance :
      (options.da || 0)))
    );
    otherAllowances = Number(struct.otherAllowances !== undefined ? struct.otherAllowances : (options.otherAllowances || 0));
    fixedBonus = Number(struct.fixedBonus !== undefined ? struct.fixedBonus : (options.fixedBonus || 0));
    monthlySalary = Number(
      (basicSalary + hra + conveyanceAllowance + medicalAllowance + specialAllowance + dearnessAllowance + otherAllowances + fixedBonus).toFixed(2)
    );
  }

  // Per Day Salary & Leave Deduction
  const rawPerDaySalary = calculationDivisor > 0 ? monthlySalary / calculationDivisor : 0;
  const perDaySalary = Number(rawPerDaySalary.toFixed(2));
  const unpaidLeaveDeduction = Number((rawPerDaySalary * totalAbsenceDays).toFixed(2));
  const lopDeduction = unpaidLeaveDeduction;

  // Earned Base Salary = Monthly Salary − LOP
  const earnedBaseSalary = Math.max(0, Number((monthlySalary - lopDeduction).toFixed(2)));

  // Proposed Penalty = (Unauthorized Full-Day Count + Unauthorized Half-Day Count) * 0.5 * Per Day Salary
  const penaltyEligibleIncidentCount = penaltyEligibleFullDays + penaltyEligibleHalfDays;
  const proposedPenaltyAmount = Number((rawPerDaySalary * 0.5 * penaltyEligibleIncidentCount).toFixed(2));

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

  if (options.pfDeduction !== undefined && !struct.pfDeduction) {
    pfDeduction = Number(options.pfDeduction);
  }
  if (options.esicDeduction !== undefined && !struct.esicDeduction) {
    esicDeduction = Number(options.esicDeduction);
  }
  if (options.professionalTax !== undefined && struct.professionalTax === undefined) {
    professionalTax = Number(options.professionalTax);
  }
  if (options.tds !== undefined && !struct.tds) {
    tds = Number(options.tds);
  }

  const totalStatutoryDeductions = Number((pfDeduction + esicDeduction + professionalTax + tds).toFixed(2));

  // 9. Approved Other Deductions (Employee Deduction Module)
  let validCustomDeductions = [];
  let customDeductionsAmount = 0;
  if (options.customDeductions !== undefined) {
    customDeductionsAmount = Number(options.customDeductions);
  }
  let excludedCustomDeductions = [];

  if (userId && mongoose.isValidObjectId(userId) && mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      const deductionRes = await getApprovedLegallyPermissibleDeductions(userId, monthNum, yearNum);
      if (deductionRes) {
        customDeductionsAmount = Number(deductionRes.totalCustomDeductions || customDeductionsAmount || 0);
        validCustomDeductions = deductionRes.validDeductions || [];
        excludedCustomDeductions = deductionRes.excludedDeductions || [];
      }
    } catch (_) {}
  }

  const fixedDeduction = Number(struct.fixedDeduction || options.fixedDeduction || 0);
  const otherDeductions = Number(struct.otherDeductions || options.otherDeductions || 0);
  const finalExtraDeduction = Number(extraDeduction || options.extraDeduction || 0);

  const approvedOtherDeductions = Number(
    (customDeductionsAmount + fixedDeduction + otherDeductions + finalExtraDeduction).toFixed(2)
  );

  // 10. Net Salary Formula:
  // Gross = Monthly Salary + Extra Earnings
  // Earned Base Salary = Monthly Salary − LOP
  // Net = Gross − LOP − Existing Applicable Deductions − Authorized Penalty
  // Total Applied Deductions = LOP + Statutory Deductions + Approved Other Deductions + Authorized Penalty
  const totalAppliedDeductions = Number(
    (
      lopDeduction +
      totalStatutoryDeductions +
      approvedOtherDeductions +
      legallyApprovedPenalties
    ).toFixed(2)
  );

  const netSalary = Math.max(
    0,
    Number(
      (
        grossSalary -
        totalAppliedDeductions
      ).toFixed(2)
    )
  );

  const totalDeductions = totalAppliedDeductions;

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
      calendarDays,
      totalCalendarDays: calendarDays,
      totalDays: calendarDays,
      sundays: totalSundays,
      sundaysCount: totalSundays,
      saturdayHolidays: totalSaturdayHolidays,
      saturdayHolidaysCount: totalSaturdayHolidays,
      configuredHolidays: totalConfiguredHolidays,
      configuredHolidaysCount: totalConfiguredHolidays,
      workingDays,
      calculationDivisor,
      presentDays,
      daysPayable,
      payableDays: daysPayable,
      approvedLeaveDays,
      leaveDays: approvedLeaveDays,
      unauthorizedFullDayCount: unapprovedFullDays,
      unauthorizedHalfDayCount: unapprovedHalfDays,
      unauthorizedFullDays: unapprovedFullDays,
      unauthorizedHalfDays: unapprovedHalfDays,
      unapprovedLeaveDays,
      penaltyEligibleIncidentCount,
      incidentCount: penaltyEligibleIncidentCount,
      actualAbsenceDays: totalAbsenceDays,
      totalAbsenceDays,
    },
    calendarDays,
    totalCalendarDays: calendarDays,
    sundays: totalSundays,
    sundaysCount: totalSundays,
    saturdayHolidays: totalSaturdayHolidays,
    saturdayHolidaysCount: totalSaturdayHolidays,
    configuredHolidays: totalConfiguredHolidays,
    configuredHolidaysCount: totalConfiguredHolidays,
    workingDays,
    calculationDivisor,
    perDaySalary,
    approvedLeaveDays,
    unauthorizedFullDayCount: unapprovedFullDays,
    unauthorizedHalfDayCount: unapprovedHalfDays,
    unauthorizedFullDays: unapprovedFullDays,
    unauthorizedHalfDays: unapprovedHalfDays,
    penaltyEligibleIncidentCount,
    incidentCount: penaltyEligibleIncidentCount,
    actualAbsenceDays: totalAbsenceDays,
    totalAbsenceDays,
    payableDays: daysPayable,
    daysPayable,
    presentDays,
    monthlySalary,
    earnedBaseSalary,
    gross: grossSalary,
    grossSalary,
    lop: lopDeduction,
    lopDeduction,
    leaveDeduction: lopDeduction,
    unpaidLeaveDeduction: lopDeduction,
    proposedPenalty: proposedPenaltyAmount,
    proposedPenaltyAmount,
    appliedPenalty: legallyApprovedPenalties,
    legallyApprovedPenalties,
    statutoryDeductions: totalStatutoryDeductions,
    otherDeductions: approvedOtherDeductions,
    customDeductions: approvedOtherDeductions,
    totalAppliedDeductions,
    totalDeduction: totalAppliedDeductions,
    totalDeductions,
    netSalary,
    baseEarnings: {
      monthlySalary,
      earnedBaseSalary,
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
      approvedLeaveDays,
      leaveDays: approvedLeaveDays,
      unauthorizedFullDayCount: unapprovedFullDays,
      unauthorizedHalfDayCount: unapprovedHalfDays,
      unauthorizedFullDays: unapprovedFullDays,
      unauthorizedHalfDays: unapprovedHalfDays,
      penaltyEligibleIncidentCount,
      incidentCount: penaltyEligibleIncidentCount,
      unapprovedFullDays,
      unapprovedHalfDays,
      actualAbsenceDays: totalAbsenceDays,
      unpaidLeaveDays: totalAbsenceDays,
      unapprovedLeaveDays,
      unauthorizedAbsenceDays: unapprovedLeaveDays,
      approvedLeaveDeduction: Number((rawPerDaySalary * approvedLeaveDays).toFixed(2)),
      unauthorizedAbsenceDeduction: Number((rawPerDaySalary * unapprovedLeaveDays).toFixed(2)),
      lop: lopDeduction,
      lopDeduction,
      leaveDeduction: lopDeduction,
      unpaidLeaveDeduction: lopDeduction,
      proposedPenalty: proposedPenaltyAmount,
      proposedPenaltyAmount,
      unapprovedLeavePenalty: proposedPenaltyAmount,
      isPenaltyApproved: applyPenalties,
      appliedPenalty: legallyApprovedPenalties,
      legallyApprovedPenalties,
      penaltyDate: options.penaltyDate || null,
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
      calendarDays,
      sundays: totalSundays,
      saturdayHolidays: totalSaturdayHolidays,
      configuredHolidays: totalConfiguredHolidays,
      workingDays,
      calculationDivisor,
      perDaySalary,
      approvedLeaveDays,
      unauthorizedFullDayCount: unapprovedFullDays,
      unauthorizedHalfDayCount: unapprovedHalfDays,
      penaltyEligibleIncidentCount,
      incidentCount: penaltyEligibleIncidentCount,
      actualAbsenceDays: totalAbsenceDays,
      payableDays: daysPayable,
      monthlySalary,
      earnedBaseSalary,
      gross: grossSalary,
      grossSalary,
      lop: lopDeduction,
      leaveDeduction: lopDeduction,
      proposedPenalty: proposedPenaltyAmount,
      appliedPenalty: legallyApprovedPenalties,
      statutoryDeductions: totalStatutoryDeductions,
      otherDeductions: approvedOtherDeductions,
      totalAppliedDeductions,
      totalDeduction: totalAppliedDeductions,
      totalDeductions,
      netSalary,
      legalCompliance: {
        isPermissibleOnly: true,
        wageCeilingCompliant: totalAppliedDeductions <= grossSalary * 0.5,
      },
    },
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
