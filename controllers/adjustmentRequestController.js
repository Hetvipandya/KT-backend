const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const User = require("../models/User");
const TeamLead = require("../models/Team");
const AdjustmentRequest = require("../models/AdjustmentRequest"); 

const normalizeAttendanceDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (typeof value === "string") { 
    const trimmedValue = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
      return trimmedValue;
    }

    const parsedDate = new Date(trimmedValue);
    if (!Number.isNaN(parsedDate.getTime())) {
      const year = parsedDate.getUTCFullYear();
      const month = String(parsedDate.getUTCMonth() + 1).padStart(2, "0");
      const day = String(parsedDate.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  return String(value);
};

const formatDateToISTTimeString = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const istDate = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const hours = String(istDate.getUTCHours()).padStart(2, "0");
  const minutes = String(istDate.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

// Helper function to parse time
const parseTimeToDate = (dateStr, timeStr) => {
  if (!timeStr) return null;
  if (!dateStr) return null;

  if (timeStr instanceof Date) {
    return isNaN(timeStr.getTime()) ? null : timeStr;
  }

  if (typeof timeStr !== "string") {
    return null;
  }

  const trimmed = timeStr.trim();
  if (!trimmed) return null;

  // If already an ISO string with T
  if (trimmed.includes("T")) {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  const normalizedDate = normalizeAttendanceDate(dateStr);
  if (!normalizedDate || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return null;
  }

  const [year, month, day] = normalizedDate.split("-").map(Number);

  // Check 12-hour AM/PM
  const isPM = /pm$/i.test(trimmed);
  const isAM = /am$/i.test(trimmed);
  const cleanTime = trimmed.replace(/\s*(am|pm)$/i, "");
  const parts = cleanTime.split(":");

  if (parts.length >= 2) {
    let hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    const second = parts.length > 2 ? parseInt(parts[2], 10) || 0 : 0;

    if (isPM && hour < 12) hour += 12;
    if (isAM && hour === 12) hour = 0;

    if (
      !isNaN(hour) &&
      !isNaN(minute) &&
      !isNaN(second) &&
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59 &&
      second >= 0 &&
      second <= 59
    ) {
      return new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30, second));
    }
  }

  // Fallback for date strings
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }

  return null;
};

const applyCheckInStatus = (attendance) => {
  if (!attendance.checkInTime) {
    attendance.isLate = false; 
    return;
  }

  const istCheckIn = new Date(
    attendance.checkInTime.getTime() +
      5.5 * 60 * 60 * 1000
  );

  const checkInMinutes =
    istCheckIn.getUTCHours() * 60 +
    istCheckIn.getUTCMinutes();

  const OFFICE_START = 10 * 60 + 10; // 10:10 AM (610 mins)
  const LATE_CUTOFF = 10 * 60 + 30;  // 10:30 AM (630 mins)
  const HALF_DAY_CUTOFF = 15 * 60;   // 3:00 PM / 15:00 (900 mins)

  // 1. 10:00 AM to 10:10 AM: Present & On Time
  if (checkInMinutes <= OFFICE_START) {
    attendance.isLate = false;
    attendance.status = "present";
  } 
  // 2. 10:11 AM to 10:30 AM: Present & Late
  else if (checkInMinutes <= LATE_CUTOFF) {
    attendance.isLate = true;
    attendance.status = "present";
  } 
  // 3. 10:31 AM to 3:00 PM (15:00): Half Day
  else if (checkInMinutes <= HALF_DAY_CUTOFF) {
    attendance.isLate = true;
    attendance.status = "half-day";
  } 
  // 4. After 3:00 PM (15:00): Absent
  else {
    attendance.isLate = false;
    attendance.status = "absent";
  }

  // Work Hours rule: If 8 hours are not completed (totalWorkTime > 0 and < 8), set status to half-day
  if (
    attendance.checkOutTime &&
    attendance.totalWorkTime > 0 &&
    attendance.totalWorkTime < 8
  ) {
    attendance.status = "half-day";
  }
};

const parseBreaksFromInput = ({ sessions, breaks, breakStart, breakEnd }, attendanceDate) => {
  // If sessions array is provided
  if (Array.isArray(sessions) && sessions.length > 0) {
    const parsedBreaks = [];
    let totalDuration = 0;

    for (const session of sessions) {
      if (!session || typeof session !== "object") continue;

      const rawStart = session.breakStart ?? session.breakStartTime ?? session.break_start ?? session.breakIn ?? "";
      const rawEnd = session.breakEnd ?? session.breakEndTime ?? session.break_end ?? session.breakOut ?? "";

      const hasStart = Boolean(rawStart && String(rawStart).trim());
      const hasEnd = Boolean(rawEnd && String(rawEnd).trim());

      if (hasStart !== hasEnd) {
        return { error: "Both break start and break end are required." };
      }

      if (hasStart && hasEnd) {
        const start = parseTimeToDate(attendanceDate, rawStart);
        const end = parseTimeToDate(attendanceDate, rawEnd);

        if (!start || !end) {
          return { error: "Invalid break time." };
        }

        let duration = (end.getTime() - start.getTime()) / 60000;
        if (duration < 0) {
          return { error: "Break end must be after break start." };
        }

        duration = Number(duration.toFixed(2));
        parsedBreaks.push({
          startTime: start,
          endTime: end,
          duration,
        });
        totalDuration += duration;
      }
    }

    return {
      breaks: parsedBreaks,
      totalBreakTime: Number(totalDuration.toFixed(2)),
      provided: true,
    };
  }

  // If breaks array is provided
  if (Array.isArray(breaks)) {
    const parsedBreaks = [];
    let totalDuration = 0;

    for (const b of breaks) {
      if (!b || typeof b !== "object") continue;

      const rawStart = b.startTime ?? b.breakStart ?? b.breakStartTime ?? b.break_start ?? "";
      const rawEnd = b.endTime ?? b.breakEnd ?? b.breakEndTime ?? b.break_end ?? "";

      const hasStart = Boolean(rawStart && String(rawStart).trim());
      const hasEnd = Boolean(rawEnd && String(rawEnd).trim());

      if (hasStart !== hasEnd) {
        return { error: "Both break start and break end are required." };
      }

      if (hasStart && hasEnd) {
        const start = parseTimeToDate(attendanceDate, rawStart);
        const end = parseTimeToDate(attendanceDate, rawEnd);

        if (!start || !end) {
          return { error: "Invalid break time." };
        }

        let duration = (end.getTime() - start.getTime()) / 60000;
        if (duration < 0) {
          return { error: "Break end must be after break start." };
        }

        duration = Number(duration.toFixed(2));
        parsedBreaks.push({
          startTime: start,
          endTime: end,
          duration,
        });
        totalDuration += duration;
      }
    }

    return {
      breaks: parsedBreaks,
      totalBreakTime: Number(totalDuration.toFixed(2)),
      provided: true,
    };
  }

  // If top-level breakStart / breakEnd provided
  if (breakStart !== undefined || breakEnd !== undefined) {
    const hasStart = Boolean(breakStart && String(breakStart).trim());
    const hasEnd = Boolean(breakEnd && String(breakEnd).trim());

    if (hasStart !== hasEnd) {
      return { error: "Both break start and break end are required." };
    }

    if (hasStart && hasEnd) {
      const start = parseTimeToDate(attendanceDate, breakStart);
      const end = parseTimeToDate(attendanceDate, breakEnd);

      if (!start || !end) {
        return { error: "Invalid break time." };
      }

      let duration = (end.getTime() - start.getTime()) / 60000;
      if (duration < 0) {
        return { error: "Break end must be after break start." };
      }

      duration = Number(duration.toFixed(2));
      return {
        breaks: [
          {
            startTime: start,
            endTime: end,
            duration,
          },
        ],
        totalBreakTime: duration,
        provided: true,
      };
    } else {
      return {
        breaks: [],
        totalBreakTime: 0,
        provided: true,
      };
    }
  }

  return { provided: false };
};

// Helper to get employee name from different sources - FIXED
const getEmployeeName = async (employeeId) => {
  if (!employeeId) return 'Unknown Employee';
  
  try {
    // 1. Check in Employee collection
    let employee = await Employee.findById(employeeId).lean();
    if (employee) {
      const firstName = employee.firstName || '';
      const lastName = employee.lastName || '';
      const name = employee.name || '';
      return [firstName, lastName].filter(Boolean).join(' ') || name || 'Unknown Employee';
    }

    // 2. Check in User collection (for interns)
    let user = await User.findById(employeeId).lean();
    if (user) {
      const firstName = user.firstName || '';
      const lastName = user.lastName || '';
      const name = user.name || '';
      return [firstName, lastName].filter(Boolean).join(' ') || name || 'Unknown Employee';
    }

    // 3. Check in TeamLead collection
    const team = await TeamLead.findOne({
      teamLeadUser: employeeId,
    })
      .populate({
        path: "teamLeadUser",
        select: "name",
      })
      .lean();

    if (team?.teamLeadUser?.name) {
      return team.teamLeadUser.name;
    }

    // 4. If not found in any collection, try to find in any collection with different ID field
    // Check Employee with employeeId field
    let employeeByEmpId = await Employee.findOne({ employeeId: employeeId }).lean();
    if (employeeByEmpId) {
      const firstName = employeeByEmpId.firstName || '';
      const lastName = employeeByEmpId.lastName || '';
      const name = employeeByEmpId.name || '';
      return [firstName, lastName].filter(Boolean).join(' ') || name || 'Unknown Employee';
    }

    // Check User with employeeId field
    let userByEmpId = await User.findOne({ employeeId: employeeId }).lean();
    if (userByEmpId) {
      const firstName = userByEmpId.firstName || '';
      const lastName = userByEmpId.lastName || '';
      const name = userByEmpId.name || '';
      return [firstName, lastName].filter(Boolean).join(' ') || name || 'Unknown Employee';
    }

    return 'Unknown Employee';
    
  } catch (error) {
    console.error('Error getting employee name:', error);
    return 'Unknown Employee';
  }
};

const createOrUpdateAdjustmentHistory = async ({
  employeeId,
  attendanceDate,
  reason,
  attendance,
  sessions = [],
}) => {
  try {
    const finalSessions =
      Array.isArray(sessions) && sessions.length > 0
        ? sessions.map((session) => ({
            checkin:
              session.checkin ||
              session.checkIn ||
              session.checkInTime ||
              "",
            breakStart:
              session.breakStart ||
              session.breakStartTime ||
              session.break_start ||
              session.breakIn ||
              "",
            breakEnd:
              session.breakEnd ||
              session.breakEndTime ||
              session.break_end ||
              session.breakOut ||
              "",
            checkout:
              session.checkout ||
              session.checkOut ||
              session.checkOutTime ||
              "",
          }))
        : attendance.breaks && attendance.breaks.length > 0
        ? attendance.breaks.map((b, idx) => ({
            checkin:
              idx === 0
                ? formatDateToISTTimeString(attendance.checkInTime)
                : "",
            breakStart: formatDateToISTTimeString(b.startTime),
            breakEnd: formatDateToISTTimeString(b.endTime),
            checkout:
              idx === attendance.breaks.length - 1
                ? formatDateToISTTimeString(attendance.checkOutTime)
                : "",
          }))
        : [
            {
              checkin: formatDateToISTTimeString(attendance.checkInTime),
              breakStart: "",
              breakEnd: "",
              checkout: formatDateToISTTimeString(attendance.checkOutTime),
            },
          ];

    const adjustmentData = {
      userId: employeeId,

      // AdjustmentRequest.date is Date
      date: parseTimeToDate(attendanceDate, "00:00"),

      // These are Date fields
      checkInTime: attendance.checkInTime || null,
      checkOutTime: attendance.checkOutTime || null,
      approvedCheckInTime: attendance.approvedCheckInTime || null,

      totalBreakTime: attendance.totalBreakTime || 0,
      totalWorkTime: attendance.totalWorkTime || 0,

      breakStart: finalSessions?.[0]?.breakStart || "",
      breakEnd: finalSessions?.[0]?.breakEnd || "",

      reason: reason || "Attendance adjusted",

      // Use attendance's final status
      status: attendance.status || "absent",

      approvalStatus: "approved",

      sessions: finalSessions,
    };

    const adjustment = await AdjustmentRequest.findOneAndUpdate(
      {
        userId: employeeId,
        date: adjustmentData.date,
      },
      {
        $set: adjustmentData,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return adjustment;
  } catch (error) {
    console.error("Adjustment history save error:", error);
    throw error;
  }
};

// ==========================================
// Direct Adjustment - Immediate Attendance Update
// ==========================================

exports.patchAttendanceAdjustment = async (req, res) => {
  try {
    const employeeId =
      req.body.employeeId ||
      req.body.userId ||
      req.params.employeeId;

    const date =
      req.body.date ||
      req.params.date;

    const {
      checkInTime,
      checkOutTime,
      checkin,
      checkout,
      checkIn,
      checkOut,
      breakStart,
      breakEnd,
      breakStartTime,
      breakEndTime,
      break_start,
      break_end,
      breakIn,
      breakOut,
      sessions,
      breaks,
      reason,
      totalBreakTime,
    } = req.body;

    if (!employeeId || !date) {
      return res.status(400).json({
        success: false,
        message: "Employee and Date are required.",
      });
    }

    const attendanceDate = normalizeAttendanceDate(date);

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: "Valid date is required.",
      });
    }

    let targetUserId = employeeId;
    let userObj = await User.findById(employeeId);
    if (!userObj) {
      const empObj = await Employee.findById(employeeId);
      if (empObj && empObj.userID) {
        targetUserId = empObj.userID;
        userObj = await User.findById(targetUserId);
      }
    }

    let attendance = await Attendance.findOne({
      userId: targetUserId,
      date: attendanceDate,
    });

    if (!attendance) {
      attendance = new Attendance({
        userId: targetUserId,
        userType: userObj?.role || "employee",
        date: attendanceDate,
        status: "absent",
        approvalStatus: "approved",
      });
    }

    // ==========================================
    // CHECK-IN
    // ==========================================
    const effectiveCheckIn =
      checkInTime !== undefined
        ? checkInTime
        : checkin !== undefined
        ? checkin
        : checkIn;

    if (effectiveCheckIn !== undefined) {
      if (!effectiveCheckIn) {
        attendance.checkInTime = null;
        attendance.approvedCheckInTime = null;
      } else {
        const parsedCheckIn = parseTimeToDate(
          attendanceDate,
          effectiveCheckIn
        );

        if (!parsedCheckIn) {
          return res.status(400).json({
            success: false,
            message: "Invalid check-in time.",
          });
        }

        attendance.checkInTime = parsedCheckIn;
        attendance.approvedCheckInTime = parsedCheckIn;
      }
    }

    // ==========================================
    // CHECK-OUT
    // ==========================================
    const effectiveCheckOut =
      checkOutTime !== undefined
        ? checkOutTime
        : checkout !== undefined
        ? checkout
        : checkOut;

    if (effectiveCheckOut !== undefined) {
      if (!effectiveCheckOut) {
        attendance.checkOutTime = null;
      } else {
        const parsedCheckOut = parseTimeToDate(
          attendanceDate,
          effectiveCheckOut
        );

        if (!parsedCheckOut) {
          return res.status(400).json({
            success: false,
            message: "Invalid check-out time.",
          });
        }

        attendance.checkOutTime = parsedCheckOut;
      }
    }

    // ==========================================
    // BREAKS
    // ==========================================
    const bStartInput =
      breakStart ?? breakStartTime ?? break_start ?? breakIn;
    const bEndInput =
      breakEnd ?? breakEndTime ?? break_end ?? breakOut;

    const breaksResult = parseBreaksFromInput(
      {
        sessions,
        breaks,
        breakStart: bStartInput,
        breakEnd: bEndInput,
      },
      attendanceDate
    );

    if (breaksResult.error) {
      return res.status(400).json({
        success: false,
        message: breaksResult.error,
      });
    }

    if (breaksResult.provided) {
      attendance.breaks = breaksResult.breaks;
      attendance.totalBreakTime = breaksResult.totalBreakTime;
    } else if (totalBreakTime !== undefined) {
      attendance.totalBreakTime = Number(totalBreakTime) || 0;
    }

    // ==========================================
    // REASON
    // ==========================================
    if (reason !== undefined) {
      attendance.adjustmentReason = reason;
    }

    // ==========================================
    // WORK TIME
    // ==========================================
    if (
      attendance.checkInTime &&
      attendance.checkOutTime
    ) {
      let totalMinutes =
        (
          attendance.checkOutTime.getTime() -
          attendance.checkInTime.getTime()
        ) / 60000;

      totalMinutes -= attendance.totalBreakTime || 0;

      if (totalMinutes < 0) {
        totalMinutes = 0;
      }

      attendance.totalWorkTime = Number(
        (totalMinutes / 60).toFixed(2)
      );

      // Work-hour based status
      if (attendance.totalWorkTime >= 8) {
        attendance.status = "present";
      } else if (attendance.totalWorkTime >= 4) {
        attendance.status = "half-day";
      } else {
        attendance.status = "absent";
      }
    } else {
      attendance.totalWorkTime = 0;
    }

    // ==========================================
    // CHECK-IN BASED STATUS
    // ==========================================
    applyCheckInStatus(attendance);

    // ==========================================
    // APPROVED
    // ==========================================
    attendance.approvalStatus = "approved";

    await attendance.save();

    // ==========================================
    // SESSIONS FOR HISTORY
    // ==========================================
    let historySessions =
      Array.isArray(sessions) && sessions.length > 0
        ? sessions
        : attendance.breaks && attendance.breaks.length > 0
        ? attendance.breaks.map((b, idx) => ({
            checkin:
              idx === 0
                ? (effectiveCheckIn || formatDateToISTTimeString(attendance.checkInTime))
                : "",
            breakStart: formatDateToISTTimeString(b.startTime),
            breakEnd: formatDateToISTTimeString(b.endTime),
            checkout:
              idx === attendance.breaks.length - 1
                ? (effectiveCheckOut || formatDateToISTTimeString(attendance.checkOutTime))
                : "",
          }))
        : [
            {
              checkin:
                effectiveCheckIn ||
                formatDateToISTTimeString(attendance.checkInTime),
              breakStart: "",
              breakEnd: "",
              checkout:
                effectiveCheckOut ||
                formatDateToISTTimeString(attendance.checkOutTime),
            },
          ];

    // ==========================================
    // SAVE ADJUSTMENT HISTORY
    // ==========================================
    const adjustment = await createOrUpdateAdjustmentHistory({
      employeeId,
      attendanceDate,
      reason,
      attendance,
      sessions: historySessions,
    });

    const employeeName = await getEmployeeName(employeeId);

    return res.status(200).json({
      success: true,
      message: "Attendance adjustment updated successfully.",
      data: {
        attendance,
        adjustment,
        employeeName,
      },
    });

  } catch (error) {
    console.error(
      "PATCH attendance error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.putAttendanceAdjustment = async (req, res) => {
  try {
    const employeeId =
      req.body.employeeId ||
      req.body.userId ||
      req.params.employeeId;

    const date =
      req.body.date ||
      req.params.date;

    let {
      sessions,
      breaks,
      checkInTime,
      checkOutTime,
      checkin,
      checkout,
      checkIn,
      checkOut,
      breakStart,
      breakEnd,
      breakStartTime,
      breakEndTime,
      break_start,
      break_end,
      breakIn,
      breakOut,
      reason,
    } = req.body;

    if (!employeeId || !date || !reason) {
      return res.status(400).json({
        success: false,
        message: "Employee, Date and Reason are required.",
      });
    }

    if (sessions !== undefined) {
      if (!Array.isArray(sessions) || sessions.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Sessions are required.",
        });
      }

      if (
        sessions.some(
          (session) =>
            !session || typeof session !== "object" || Array.isArray(session)
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Each session must be an object.",
        });
      }
    }

    // If sessions not provided, check if flat timing fields or breaks provided
    if (!Array.isArray(sessions) || sessions.length === 0) {
      const cin = checkInTime ?? checkin ?? checkIn ?? "";
      const cout = checkOutTime ?? checkout ?? checkOut ?? "";
      const bstart =
        breakStart ?? breakStartTime ?? break_start ?? breakIn ?? "";
      const bend =
        breakEnd ?? breakEndTime ?? break_end ?? breakOut ?? "";

      if (cin || cout || bstart || bend || breaks) {
        sessions = [
          {
            checkin: cin,
            checkout: cout,
            breakStart: bstart,
            breakEnd: bend,
          },
        ];
      } else {
        return res.status(400).json({
          success: false,
          message: "Sessions are required.",
        });
      }
    }

    const attendanceDate = normalizeAttendanceDate(date);

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: "Valid date is required.",
      });
    }

    let targetUserId = employeeId;
    let userObj = await User.findById(employeeId);
    if (!userObj) {
      const empObj = await Employee.findById(employeeId);
      if (empObj && empObj.userID) {
        targetUserId = empObj.userID;
        userObj = await User.findById(targetUserId);
      }
    }

    let attendance = await Attendance.findOne({
      userId: targetUserId,
      date: attendanceDate,
    });

    if (!attendance) {
      attendance = new Attendance({
        userId: targetUserId,
        userType: userObj?.role || "employee",
        date: attendanceDate,
        status: "absent",
        approvalStatus: "approved",
      });
    }

    // ==========================================
    // First session = Check In
    // Last session = Check Out
    // ==========================================
    const firstSession = sessions[0];
    const lastSession = sessions[sessions.length - 1];

    const firstCheckIn =
      firstSession.checkin ?? firstSession.checkIn ?? firstSession.checkInTime;
    const lastCheckOut =
      lastSession.checkout ?? lastSession.checkOut ?? lastSession.checkOutTime;

    if (firstCheckIn) {
      const checkInParsed = parseTimeToDate(
        attendanceDate,
        firstCheckIn
      );

      if (!checkInParsed) {
        return res.status(400).json({
          success: false,
          message: "Invalid check-in time.",
        });
      }

      attendance.checkInTime = checkInParsed;
      attendance.approvedCheckInTime = checkInParsed;
    } else {
      attendance.checkInTime = null;
      attendance.approvedCheckInTime = null;
    }

    if (lastCheckOut) {
      const checkOutParsed = parseTimeToDate(
        attendanceDate,
        lastCheckOut
      );

      if (!checkOutParsed) {
        return res.status(400).json({
          success: false,
          message: "Invalid check-out time.",
        });
      }

      attendance.checkOutTime = checkOutParsed;
    } else {
      attendance.checkOutTime = null;
    }

    // ==========================================
    // Breaks
    // ==========================================
    const breaksResult = parseBreaksFromInput(
      { sessions, breaks },
      attendanceDate
    );

    if (breaksResult.error) {
      return res.status(400).json({
        success: false,
        message: breaksResult.error,
      });
    }

    attendance.breaks = breaksResult.breaks || [];
    attendance.totalBreakTime = breaksResult.totalBreakTime || 0;

    // ==========================================
    // Calculate Work Time
    // ==========================================
    if (
      attendance.checkInTime &&
      attendance.checkOutTime
    ) {
      let totalMinutes =
        (attendance.checkOutTime.getTime() -
          attendance.checkInTime.getTime()) /
        60000;

      totalMinutes -= attendance.totalBreakTime;

      if (totalMinutes < 0) {
        totalMinutes = 0;
      }

      attendance.totalWorkTime = Number(
        (totalMinutes / 60).toFixed(2)
      );
    } else {
      attendance.totalWorkTime = 0;
    }

    // ==========================================
    // Status
    // ==========================================
    attendance.status =
      attendance.totalWorkTime >= 8
        ? "present"
        : attendance.totalWorkTime >= 4
        ? "half-day"
        : "absent";

    applyCheckInStatus(attendance);

    attendance.approvalStatus = "approved";

    // Store reason if schema has this field
    if (attendance.schema.path("adjustmentReason")) {
      attendance.adjustmentReason = reason;
    }

    await attendance.save();

    // ==========================================
    // SAVE / UPDATE ADJUSTMENT HISTORY
    // ==========================================
    const adjustment = await createOrUpdateAdjustmentHistory({
      employeeId,
      attendanceDate,
      reason,
      attendance,
      sessions,
    });

    const employeeName = await getEmployeeName(employeeId);

    return res.status(200).json({
      success: true,
      message: "Complete attendance updated successfully.",
      data: {
        attendance,
        adjustment,
        employeeName,
      },
    });
  } catch (error) {
    console.error("PUT attendance error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// Get Adjustment History - FIXED
// ==========================================
exports.getAdjustmentHistory = async (req, res) => {
  try {
    const { employeeId } = req.query;

    const query = {};
    if (employeeId) {
      query.userId = employeeId;
    }

    const adjustmentRequests = await AdjustmentRequest.find(query)
      .populate({
        path: "userId",
        select: "name firstName lastName role",
      })
      .sort({ date: -1, createdAt: -1 })
      .limit(20);

    const adjustments = adjustmentRequests.map((request) => ({
      _id: request._id,
      employeeId: request.userId?._id,
      employeeName:
        request.userId?.name ||
        `${request.userId?.firstName || ""} ${request.userId?.lastName || ""}`.trim() ||
        "Unknown Employee",
      date: request.date,
      checkInTime: request.checkInTime,
      checkOutTime: request.checkOutTime,
      breakStart: request.sessions?.[0]?.breakStart || request.breakStart || "",
      breakEnd: request.sessions?.[0]?.breakEnd || request.breakEnd || "",
      sessions: request.sessions || [],
      totalBreakTime: request.totalBreakTime,
      totalWorkTime: request.totalWorkTime,
      status: request.status,
      approvalStatus: request.approvalStatus,
      reason: request.reason,
    }));

    res.status(200).json({
      success: true,
      data: adjustments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ==========================================
// Test endpoint to debug employee name
// ==========================================

exports.testGetEmployeeName = async (req, res) => {
  try {
    const { id } = req.params;
    const name = await getEmployeeName(id);
    res.json({
      success: true,
      employeeId: id,
      employeeName: name
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};