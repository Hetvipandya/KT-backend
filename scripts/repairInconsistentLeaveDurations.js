require("dotenv").config();

const mongoose = require("mongoose");
const Leave = require("../models/Leave");
const Attendance = require("../models/Attendance");
const MonthlySalary = require("../models/MonthlySalary");
const Payslip = require("../models/Payslip");
const {
  calculateWorkingLeaveDays,
  normalizeLeaveDuration,
  toDateString,
} = require("../utils/leaveUtils");

const isApplyMode = process.argv.includes("--apply");
const sameValue = (left, right) => String(left ?? "") === String(right ?? "");
const isFinalizedPayroll = (salary, payslip) =>
  Boolean(salary.approvedAt || salary.paidAt) ||
  /approved|paid|final/i.test(String(salary.status || "")) ||
  Boolean(payslip?.paymentDate) ||
  /approved|paid|final/i.test(String(payslip?.status || "")) ||
  /paid|final/i.test(String(payslip?.paymentStatus || ""));

const getHalfDayRepair = async (leave) => {
  const duration = normalizeLeaveDuration(leave);
  const proposed = {
    leaveType: duration.leaveType,
    isHalfDay: duration.isHalfDay,
    halfDayType: duration.halfDayType,
    totalDays: leave.totalDays,
  };

  if (duration.isHalfDay) {
    const startDate = toDateString(leave.startDate);
    const endDate = toDateString(leave.endDate || leave.startDate);
    if (!startDate || startDate !== endDate) {
      return {
        proposed,
        manualReview: "Half-day record spans multiple dates or has invalid dates.",
      };
    }

    const calculation = await calculateWorkingLeaveDays(
      leave.startDate,
      leave.endDate || leave.startDate,
      true,
    );
    if (calculation.workingDays !== 0.5) {
      return {
        proposed,
        manualReview: "Half-day record is not on a valid working date.",
      };
    }
    proposed.totalDays = 0.5;
  } else if (["full_day", "half_day"].includes(String(leave.leaveType || "").toLowerCase())) {
    proposed.leaveType = "full_day";
    proposed.isHalfDay = false;
    proposed.halfDayType = null;
  }

  const changes = {};
  for (const [field, value] of Object.entries(proposed)) {
    if (!sameValue(leave[field], value)) changes[field] = value;
  }

  return { proposed, changes };
};

const run = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required to inspect leave records.");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const leaves = await Leave.find({});
  const affected = [];
  const manualReview = [];

  for (const leave of leaves) {
    const repair = await getHalfDayRepair(leave);
    if (repair.manualReview) {
      manualReview.push({
        leaveId: String(leave._id),
        reason: repair.manualReview,
        proposed: repair.proposed,
      });
      continue;
    }
    if (Object.keys(repair.changes || {}).length) {
      affected.push({
        leave,
        changes: repair.changes,
      });
    }
  }

  const candidateLeaves = affected.filter(({ leave }) =>
    normalizeLeaveDuration(leave).isHalfDay,
  );
  const attendanceById = new Map();
  for (const { leave } of candidateLeaves) {
    const date = toDateString(leave.startDate);
    const records = await Attendance.find({
      userId: leave.employeeId,
      date,
    }).select("_id userId date status halfDayType adjustmentReason approvalStatus");

    for (const record of records) {
      const generatedAsFullDay =
        record.status === "leave" &&
        String(record.adjustmentReason || "").startsWith("Approved Full-Day Leave");
      const attendanceId = String(record._id);
      const existing = attendanceById.get(attendanceId);
      if (existing) {
        existing.leaveIds.push(String(leave._id));
      } else {
        attendanceById.set(attendanceId, {
          attendanceId,
          leaveIds: [String(leave._id)],
          userId: String(record.userId),
          date: record.date,
          status: record.status,
          halfDayType: record.halfDayType,
          adjustmentReason: record.adjustmentReason,
          suspectedIncorrect: generatedAsFullDay,
        });
      }
    }
  }

  const payrollById = new Map();
  for (const { leave } of candidateLeaves) {
    const date = toDateString(leave.startDate);
    const [year, month] = date.split("-").map(Number);
    const payrollRecords = await MonthlySalary.find({
      $or: [{ employeeId: leave.employeeId }, { userId: leave.employeeId }],
      month,
      year,
    }).select("_id employeeId userId month year status approvedAt paidAt approvedLeaveDays");

    for (const salary of payrollRecords) {
      const salaryId = String(salary._id);
      const payslip = await Payslip.findOne({ payrollId: salary._id })
        .select("_id status paymentStatus paymentDate approvedLeaveDays leaveDays");
      const existing = payrollById.get(salaryId);
      if (existing) {
        existing.leaveIds.push(String(leave._id));
        existing.likelyIncorrectLeaveDays = existing.likelyIncorrectLeaveDays || (
          !Boolean(leave.isHalfDay) && normalizeLeaveDuration(leave).isHalfDay
        );
        continue;
      }
      payrollById.set(salaryId, {
        payrollId: salaryId,
        leaveIds: [String(leave._id)],
        employeeId: String(salary.employeeId || salary.userId),
        month,
        year,
        status: salary.status,
        approvedAt: salary.approvedAt,
        paidAt: salary.paidAt,
        recordedApprovedLeaveDays: salary.approvedLeaveDays,
        payslip: payslip
          ? {
              payslipId: String(payslip._id),
              status: payslip.status,
              paymentStatus: payslip.paymentStatus,
              paymentDate: payslip.paymentDate,
              recordedApprovedLeaveDays: payslip.approvedLeaveDays ?? payslip.leaveDays,
            }
          : null,
        finalized: isFinalizedPayroll(salary, payslip),
        likelyIncorrectLeaveDays:
          !Boolean(leave.isHalfDay) && normalizeLeaveDuration(leave).isHalfDay,
      });
    }
  }

  const relevantAttendance = Array.from(attendanceById.values());
  const relevantPayroll = Array.from(payrollById.values());
  const report = {
    mode: isApplyMode ? "apply" : "dry-run",
    repairs: affected.map(({ leave, changes }) => ({
      leaveId: String(leave._id),
      changes,
      status: leave.status,
    })),
    manualReview,
    attendanceImpact: {
      records: relevantAttendance,
      suspectedIncorrect: relevantAttendance.filter((record) => record.suspectedIncorrect),
    },
    payrollImpact: {
      records: relevantPayroll,
      finalized: relevantPayroll.filter((record) => record.finalized),
      likelyIncorrect: relevantPayroll.filter((record) => record.likelyIncorrectLeaveDays),
      note: "Payroll records are reported for review only; this script never changes salary or payslip data.",
    },
  };
  console.log(JSON.stringify(report, null, 2));

  if (isApplyMode) {
    for (const { leave, changes } of affected) {
      await Leave.updateOne({ _id: leave._id }, { $set: changes });
    }
    console.log(`Applied ${affected.length} leave duration repair(s).`);
  } else {
    console.log("Dry run only. Re-run with --apply to update the reported leave fields.");
  }
};

run()
  .catch((error) => {
    console.error("Leave duration repair failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
