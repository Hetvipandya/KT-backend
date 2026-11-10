const mongoose = require("mongoose");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const Holiday = require("../models/Holiday");
const AttendanceJobLog = require("../models/AttendanceJobLog");
const { normalizeLeaveDuration, toDateString } = require("../utils/leaveUtils");
const { toISTDate, getISTDateString } = require("./attendanceCalculationService");

/**
 * Helper to normalize role for Attendance schema
 */
const normalizeUserType = (role) => {
  const r = (role || "").toLowerCase().trim();
  if (r.includes("intern")) return "intern";
  if (r.includes("lead")) return "team lead";
  if (r.includes("hr")) return "hr";
  if (r.includes("admin")) return "admin";
  if (r.includes("accountant")) return "accountant";
  if (r.includes("ca")) return "ca";
  return "employee";
};

/**
 * Run Daily Attendance Finalization for a given date in IST
 *
 * @param {Object} options
 * @param {string|Date} [options.targetDate] - Target date string "YYYY-MM-DD" or Date object (default today in IST)
 * @param {string} [options.executionType="SCHEDULED"] - SCHEDULED, CATCH_UP, MANUAL, PREVIEW
 * @param {boolean} [options.dryRun=false] - If true, only previews actions without database modifications
 */
const runDailyAttendanceFinalization = async ({
  targetDate,
  executionType = "SCHEDULED",
  dryRun = false,
} = {}) => {
  const targetDateStr = targetDate ? toDateString(targetDate) : getISTDateString();
  const [year, month, day] = targetDateStr.split("-").map(Number);
  const targetDateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  const summary = {
    date: targetDateStr,
    executionType,
    dryRun,
    isSunday: false,
    isHoliday: false,
    reason: "",
    totalEligibleEmployees: 0,
    checkedIn: 0,
    markedAbsent: 0,
    preservedLeaves: 0,
    preservedHalfDayLeaves: 0,
    pendingLeaves: 0,
    approvedAdjustments: 0,
    skippedFutureJoiners: 0,
    skippedInactive: 0,
    details: [],
    errors: [],
  };

  try {
    // 1. Check if Sunday (Weekly Holiday)
    const dayOfWeek = targetDateObj.getUTCDay(); // 0 = Sunday
    if (dayOfWeek === 0) {
      summary.isSunday = true;
      summary.reason = "Sunday is a weekly holiday. Absent marking is skipped.";

      if (!dryRun) {
        await AttendanceJobLog.findOneAndUpdate(
          { jobName: "DAILY_ATTENDANCE_FINALIZATION", date: targetDateStr },
          {
            $set: {
              targetDate: targetDateObj,
              executedAt: new Date(),
              executionType,
              status: "SKIPPED",
              isSunday: true,
              isHoliday: false,
              reason: summary.reason,
              summary,
            },
          },
          { upsert: true, new: true }
        );
      }

      return { success: true, skipped: true, summary };
    }

    // 2. Check Holiday Master
    const holidayRecords = await Holiday.find({
      holidayDate: {
        $gte: new Date(Date.UTC(year, month - 1, day - 1, 0, 0, 0)),
        $lte: new Date(Date.UTC(year, month - 1, day + 1, 23, 59, 59)),
      },
    });

    const holidayMatch = holidayRecords.find((h) => toDateString(h.holidayDate) === targetDateStr);
    if (holidayMatch) {
      summary.isHoliday = true;
      summary.reason = `Configured holiday in Holiday Master: ${holidayMatch.holidayName || "Company Holiday"}. Absent marking is skipped.`;

      if (!dryRun) {
        await AttendanceJobLog.findOneAndUpdate(
          { jobName: "DAILY_ATTENDANCE_FINALIZATION", date: targetDateStr },
          {
            $set: {
              targetDate: targetDateObj,
              executedAt: new Date(),
              executionType,
              status: "SKIPPED",
              isSunday: false,
              isHoliday: true,
              reason: summary.reason,
              summary,
            },
          },
          { upsert: true, new: true }
        );
      }

      return { success: true, skipped: true, summary };
    }

    // 3. Fetch Active Users expected to work
    const eligibleUsers = await User.find({
      isApproved: { $ne: false },
      isActive: { $ne: false },
      isDeactivated: { $ne: true },
      role: {
        $in: [
          "employee",
          "intern",
          "team lead",
          "Employee",
          "Intern",
          "Team Lead",
          "teamlead",
        ],
      },
    }).select("_id name email role joiningDate dateOfJoining uniqueID status isDeactivated");

    const userIds = eligibleUsers.map((u) => u._id);

    // 4. Fetch Linked Employee Profiles for joiningDate / status checks
    const employeeDocs = await Employee.find({
      $or: [
        { userID: { $in: userIds } },
        { userId: { $in: userIds } },
        { _id: { $in: userIds } },
      ],
    }).select("_id userID userId joiningDate dateOfJoining employeeStatus status isDeactivated");

    const empByUserMap = new Map();
    employeeDocs.forEach((emp) => {
      const uId = emp.userID || emp.userId;
      if (uId) {
        empByUserMap.set(uId.toString(), emp);
      }
      empByUserMap.set(emp._id.toString(), emp);
    });

    // 5. Fetch Existing Attendance Records for this date
    const existingAttendances = await Attendance.find({
      date: targetDateStr,
      userId: { $in: userIds },
    });

    const attendanceByUserMap = new Map();
    existingAttendances.forEach((att) => {
      attendanceByUserMap.set(att.userId.toString(), att);
    });

    // 6. Fetch Leaves Covering Target Date
    const targetDayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const targetDayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const leaveRecords = await Leave.find({
      employeeId: { $in: userIds },
      startDate: { $lte: targetDayEnd },
      endDate: { $gte: targetDayStart },
      status: { $in: ["approved", "pending", "pending_hr", "pending_admin"] },
    });

    const approvedLeaveMap = new Map();
    const pendingLeaveMap = new Map();

    leaveRecords.forEach((l) => {
      const uId = l.employeeId.toString();
      if (l.status === "approved") {
        approvedLeaveMap.set(uId, l);
      } else {
        pendingLeaveMap.set(uId, l);
      }
    });

    // 7. Process Each Eligible Employee
    for (const user of eligibleUsers) {
      const uIdStr = user._id.toString();
      const empDoc = empByUserMap.get(uIdStr);

      // Verify Employment Status
      const empStatus = (empDoc?.employeeStatus || empDoc?.status || user.status || "Active").toLowerCase();
      if (
        empDoc?.isDeactivated === true ||
        user.isDeactivated === true ||
        empStatus === "inactive" ||
        empStatus === "resigned" ||
        empStatus === "terminated"
      ) {
        summary.skippedInactive++;
        continue;
      }

      // Check Joining Date
      const rawJoinDate =
        empDoc?.joiningDate ||
        empDoc?.dateOfJoining ||
        user.joiningDate ||
        user.dateOfJoining;

      if (rawJoinDate) {
        const joinDateStr = toDateString(rawJoinDate);
        if (joinDateStr && joinDateStr > targetDateStr) {
          // Employee has not joined yet as of this date!
          summary.skippedFutureJoiners++;
          summary.details.push({
            userId: user._id,
            userName: user.name,
            action: "SKIPPED_FUTURE_JOINER",
            reason: `Joining date (${joinDateStr}) is after target date (${targetDateStr})`,
          });
          continue;
        }
      }

      summary.totalEligibleEmployees++;

      const existingAtt = attendanceByUserMap.get(uIdStr);
      const approvedLeave = approvedLeaveMap.get(uIdStr);
      const pendingLeave = pendingLeaveMap.get(uIdStr);

      // A. Existing Check-In Punch: NEVER overwrite
      if (existingAtt && existingAtt.checkInTime) {
        summary.checkedIn++;
        summary.details.push({
          userId: user._id,
          userName: user.name,
          action: "PRESERVE_EXISTING_PUNCH",
          checkInTime: existingAtt.checkInTime,
          status: existingAtt.status,
        });
        continue;
      }

      // B. Authorized Attendance Adjustment: NEVER overwrite
      if (
        existingAtt &&
        existingAtt.approvalStatus === "approved" &&
        existingAtt.status !== "absent" &&
        existingAtt.status !== "leave"
      ) {
        summary.approvedAdjustments++;
        summary.details.push({
          userId: user._id,
          userName: user.name,
          action: "PRESERVE_AUTHORIZED_ADJUSTMENT",
          status: existingAtt.status,
          adjustmentReason: existingAtt.adjustmentReason,
        });
        continue;
      }

      const approvedLeaveDuration = approvedLeave
        ? normalizeLeaveDuration(approvedLeave)
        : null;

      // C. Approved Full-Day Leave: Preserve leave, do not mark absent
      const isApprovedFullDay = approvedLeave && !approvedLeaveDuration.isHalfDay;
      if (isApprovedFullDay) {
        summary.preservedLeaves++;
        summary.details.push({
          userId: user._id,
          userName: user.name,
          action: "PRESERVE_APPROVED_FULL_DAY_LEAVE",
          leaveId: approvedLeave._id,
        });

        if (!dryRun) {
          await Attendance.findOneAndUpdate(
            { userId: user._id, date: targetDateStr },
            {
              $setOnInsert: {
                userId: user._id,
                userType: normalizeUserType(user.role),
                date: targetDateStr,
                totalWorkTime: 0,
                totalBreakTime: 0,
                isLate: false,
              },
              $set: {
                status: "leave",
                approvalStatus: "approved",
                adjustmentReason: `Approved Full-Day Leave (${approvedLeave.leaveType})`,
              },
            },
            { upsert: true, new: true }
          );
        }
        continue;
      }

      // D. Approved Half-Day Leave: Only remaining half is unworked
      const isApprovedHalfDay = approvedLeave && approvedLeaveDuration.isHalfDay;
      const approvedHalfDayType = approvedLeaveDuration?.halfDayType || "first-half";

      if (isApprovedHalfDay) {
        summary.preservedHalfDayLeaves++;
        summary.markedAbsent++;
        summary.details.push({
          userId: user._id,
          userName: user.name,
          action: "APPROVED_HALF_DAY_LEAVE_REMAINING_ABSENT",
          leaveId: approvedLeave._id,
          halfDayType: approvedHalfDayType,
        });

        if (!dryRun) {
          await Attendance.findOneAndUpdate(
            { userId: user._id, date: targetDateStr },
            {
              $setOnInsert: {
                userId: user._id,
                userType: normalizeUserType(user.role),
                date: targetDateStr,
                totalWorkTime: 0,
                totalBreakTime: 0,
                isLate: false,
              },
              $set: {
                status: "absent",
                approvalStatus: "approved",
                halfDayType: approvedHalfDayType,
                adjustmentReason: "Approved half-day leave; unworked half marked absent by 4:00 PM attendance finalization",
              },
            },
            { upsert: true, new: true }
          );
        }
        continue;
      }

      // E. Pending Leave Request: Mark provisional absent without extra penalty
      if (pendingLeave) {
        summary.pendingLeaves++;
        summary.markedAbsent++;
        summary.details.push({
          userId: user._id,
          userName: user.name,
          action: "PROVISIONAL_ABSENT_PENDING_LEAVE",
          leaveId: pendingLeave._id,
        });

        if (!dryRun) {
          await Attendance.findOneAndUpdate(
            { userId: user._id, date: targetDateStr },
            {
              $setOnInsert: {
                userId: user._id,
                userType: normalizeUserType(user.role),
                date: targetDateStr,
                totalWorkTime: 0,
                totalBreakTime: 0,
                isLate: false,
              },
              $set: {
                status: "absent",
                approvalStatus: "approved",
                adjustmentReason: "Provisional absent (pending leave approval; extra penalties protected)",
              },
            },
            { upsert: true, new: true }
          );
        }
        continue;
      }

      // F. No Check-In on Working Day: Mark Absent
      summary.markedAbsent++;
      summary.details.push({
        userId: user._id,
        userName: user.name,
        action: "MARK_ABSENT_NO_PUNCH",
      });

      if (!dryRun) {
        await Attendance.findOneAndUpdate(
          { userId: user._id, date: targetDateStr },
          {
            $setOnInsert: {
              userId: user._id,
              userType: normalizeUserType(user.role),
              date: targetDateStr,
              totalWorkTime: 0,
              totalBreakTime: 0,
              isLate: false,
            },
            $set: {
              status: "absent",
              approvalStatus: "approved",
              adjustmentReason: "Auto marked absent by 4:00 PM attendance finalization scheduler",
            },
          },
          { upsert: true, new: true }
        );
      }
    }

    // 8. Record Execution Log
    if (!dryRun) {
      await AttendanceJobLog.findOneAndUpdate(
        { jobName: "DAILY_ATTENDANCE_FINALIZATION", date: targetDateStr },
        {
          $set: {
            targetDate: targetDateObj,
            executedAt: new Date(),
            executionType,
            status: "SUCCESS",
            isSunday: false,
            isHoliday: false,
            reason: `Finalized attendance for ${targetDateStr}. Marked absent: ${summary.markedAbsent}, Preserved leaves: ${summary.preservedLeaves}, Checked in: ${summary.checkedIn}`,
            summary,
          },
        },
        { upsert: true, new: true }
      );
    }

    return { success: true, summary };
  } catch (error) {
    summary.errors.push(error.message);

    if (!dryRun) {
      await AttendanceJobLog.findOneAndUpdate(
        { jobName: "DAILY_ATTENDANCE_FINALIZATION", date: targetDateStr },
        {
          $set: {
            targetDate: targetDateObj,
            executedAt: new Date(),
            executionType,
            status: "FAILED",
            reason: error.message,
            summary,
          },
        },
        { upsert: true, new: true }
      ).catch(() => {});
    }

    throw error;
  }
};

/**
 * Global timer and watchdog references
 */
let schedulerTimer = null;
let watchdogInterval = null;

/**
 * Compute milliseconds until next 16:00 IST (4:00 PM Asia/Kolkata)
 */
const getMsUntilNextIST4PM = (now = new Date()) => {
  const istNow = toISTDate(now);
  const targetIST = new Date(istNow);

  // Set target to 16:00:00.000 IST in UTC representation
  targetIST.setUTCHours(16, 0, 0, 0);

  // If 16:00 IST has already passed today, target tomorrow 16:00 IST
  if (targetIST.getTime() <= istNow.getTime()) {
    targetIST.setUTCDate(targetIST.getUTCDate() + 1);
  }

  return targetIST.getTime() - istNow.getTime();
};

/**
 * Start the 4:00 PM Asia/Kolkata Attendance Scheduler
 * Includes automatic catch-up on server restarts and missed runs.
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceCatchUp=false] - If true, forces catch-up evaluation regardless of current time
 */
const startAttendanceScheduler = async (options = {}) => {
  // Clear any existing timers
  if (schedulerTimer) clearTimeout(schedulerTimer);
  if (watchdogInterval) clearInterval(watchdogInterval);

  console.log("⏰ [Attendance Scheduler] Initializing Daily 4:00 PM Asia/Kolkata Attendance Scheduler...");

  // 1. Immediate Catch-Up Check on Startup
  try {
    const istNow = toISTDate();
    const currentISTMinutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();
    const cutoffMinutes = 16 * 60; // 16:00 IST (960 minutes)

    if (options.forceCatchUp || currentISTMinutes >= cutoffMinutes) {
      const todayISTStr = getISTDateString();
      const existingSuccessLog = await AttendanceJobLog.findOne({
        jobName: "DAILY_ATTENDANCE_FINALIZATION",
        date: todayISTStr,
        status: { $in: ["SUCCESS", "SKIPPED"] },
      });

      if (!existingSuccessLog) {
        console.log(`⚡ [Attendance Scheduler] Catch-up triggered for ${todayISTStr} (Server started after 4:00 PM IST)...`);
        await runDailyAttendanceFinalization({
          targetDate: todayISTStr,
          executionType: "CATCH_UP",
        });
        console.log(`✅ [Attendance Scheduler] Catch-up completed successfully for ${todayISTStr}.`);
      }
    }
  } catch (catchUpErr) {
    console.error(`⚠️ [Attendance Scheduler] Catch-up check error:`, catchUpErr.message);
  }

  // 2. Schedule Next 4:00 PM IST Execution
  const scheduleNextRun = () => {
    const msUntilRun = getMsUntilNextIST4PM();
    const hours = (msUntilRun / (1000 * 60 * 60)).toFixed(2);
    console.log(`⏳ [Attendance Scheduler] Next finalization scheduled in ${hours} hours.`);

    schedulerTimer = setTimeout(async () => {
      try {
        const todayISTStr = getISTDateString();
        console.log(`🚀 [Attendance Scheduler] Running 4:00 PM IST Attendance Finalization for ${todayISTStr}...`);
        await runDailyAttendanceFinalization({
          targetDate: todayISTStr,
          executionType: "SCHEDULED",
        });
        console.log(`✅ [Attendance Scheduler] Completed 4:00 PM IST Attendance Finalization for ${todayISTStr}.`);
      } catch (err) {
        console.error(`❌ [Attendance Scheduler] Execution error:`, err.message);
      } finally {
        scheduleNextRun();
      }
    }, msUntilRun);
  };

  scheduleNextRun();

  // 3. Periodic Watchdog (Every 15 minutes)
  // Ensures any missed schedule due to clock jumps, sleep, or restarts is caught up
  watchdogInterval = setInterval(async () => {
    try {
      const istNow = toISTDate();
      const currentISTMinutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();
      if (currentISTMinutes >= 16 * 60) {
        const todayISTStr = getISTDateString();
        const existingLog = await AttendanceJobLog.findOne({
          jobName: "DAILY_ATTENDANCE_FINALIZATION",
          date: todayISTStr,
          status: { $in: ["SUCCESS", "SKIPPED"] },
        });

        if (!existingLog) {
          console.log(`⚡ [Attendance Scheduler Watchdog] Running missed finalization for ${todayISTStr}...`);
          await runDailyAttendanceFinalization({
            targetDate: todayISTStr,
            executionType: "CATCH_UP",
          });
        }
      }
    } catch (_) {}
  }, 15 * 60 * 1000);
};

const stopAttendanceScheduler = () => {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
};

module.exports = {
  runDailyAttendanceFinalization,
  startAttendanceScheduler,
  stopAttendanceScheduler,
  getMsUntilNextIST4PM,
  normalizeUserType,
};
