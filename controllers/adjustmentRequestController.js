const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const User = require("../models/User");
const TeamLead = require("../models/Team");
const AdjustmentRequest = require("../models/AdjustmentRequest"); 

// Helper function to parse time
const parseTimeToDate = (dateStr, timeStr) => {
  if (!timeStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30, 0));
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

  const OFFICE_START = 10 * 60 + 10; // 10:10
  const ABSENT_AFTER = 10 * 60 + 30; // 10:30

  // 10:10 or before
  if (checkInMinutes <= OFFICE_START) {
    attendance.isLate = false;
    attendance.status = "present";
    return;
  }

  // 10:10 to 10:30
  if (
    checkInMinutes > OFFICE_START &&
    checkInMinutes <= ABSENT_AFTER
  ) {
    attendance.isLate = true;
    attendance.status = "present";
    return;
  }

  // After 10:30
  attendance.isLate = false;
  attendance.status = "absent";
};

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
    const adjustmentData = {
      userId: employeeId,

      // AdjustmentRequest.date is Date
      date: parseTimeToDate(attendanceDate, "00:00"),

      // These are Date fields
      checkInTime: attendance.checkInTime || null,
      checkOutTime: attendance.checkOutTime || null,
      approvedCheckInTime:
        attendance.approvedCheckInTime || null,

      totalBreakTime:
        attendance.totalBreakTime || 0,

      totalWorkTime:
        attendance.totalWorkTime || 0,

      reason: reason || "Attendance adjusted",

      // Use attendance's final status
      status: attendance.status || "absent",

      approvalStatus: "approved",

      // These fields are String in schema
      sessions: sessions.map((session) => ({
        checkin: session.checkin || "",
        breakStart: session.breakStart || "",
        breakEnd: session.breakEnd || "",
        checkout: session.checkout || "",
      })),
    };

    const adjustment =
      await AdjustmentRequest.findOneAndUpdate(
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
    console.error(
      "Adjustment history save error:",
      error
    );

    throw error;
  }
};

// ==========================================
// Direct Adjustment - Immediate Attendance Update
// ==========================================

exports.patchAttendanceAdjustment = async (req, res) => {
  try {
    const {
      employeeId,
      date,
      checkInTime,
      checkOutTime,
      reason,
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

    const attendance = await Attendance.findOne({
      userId: employeeId,
      date: attendanceDate,
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found.",
      });
    }

    // ==========================================
    // CHECK-IN
    // ==========================================

    if (checkInTime !== undefined) {
      if (!checkInTime) {
        attendance.checkInTime = null;
        attendance.approvedCheckInTime = null;
      } else {
        const parsedCheckIn = parseTimeToDate(
          attendanceDate,
          checkInTime
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

    if (checkOutTime !== undefined) {
      if (!checkOutTime) {
        attendance.checkOutTime = null;
      } else {
        const parsedCheckOut = parseTimeToDate(
          attendanceDate,
          checkOutTime
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
    }

    // ==========================================
    // CHECK-IN BASED STATUS
    // IMPORTANT
    // ==========================================

    applyCheckInStatus(attendance);

    // ==========================================
    // APPROVED
    // ==========================================

    attendance.approvalStatus = "approved";

    await attendance.save();

    // ==========================================
    // SAVE ADJUSTMENT HISTORY
    // ==========================================
const adjustment =
  await createOrUpdateAdjustmentHistory({
    employeeId,
    attendanceDate,
    reason,
    attendance,

    sessions: [
      {
        checkin: checkInTime || "",
        breakStart: "",
        breakEnd: "",
        checkout: checkOutTime || "",
      },
    ],
  });

    const employeeName =
      await getEmployeeName(employeeId);

    return res.status(200).json({
      success: true,
      message:
        "Attendance adjustment updated successfully.",
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
    const {
      employeeId,
      date,
      sessions,
      reason,
    } = req.body;

    if (!employeeId || !date || !reason) {
      return res.status(400).json({
        success: false,
        message: "Employee, Date and Reason are required.",
      });
    }

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Sessions are required.",
      });
    }

    const attendanceDate = normalizeAttendanceDate(date);

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: "Valid date is required.",
      });
    }

    const attendance = await Attendance.findOne({
      userId: employeeId,
      date: attendanceDate,
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found.",
      });
    }

    // ==========================================
    // First session = Check In
    // Last session = Check Out
    // ==========================================

    const firstSession = sessions[0];
    const lastSession = sessions[sessions.length - 1];

    // ==========================================
    // Check In
    // ==========================================

    if (firstSession.checkin) {
      const checkInTime = parseTimeToDate(
        attendanceDate,
        firstSession.checkin
      );

      if (!checkInTime) {
        return res.status(400).json({
          success: false,
          message: "Invalid check-in time.",
        });
      }

      attendance.checkInTime = checkInTime;
      attendance.approvedCheckInTime = checkInTime;
    } else {
      attendance.checkInTime = null;
      attendance.approvedCheckInTime = null;
    }

    // ==========================================
    // Check Out
    // ==========================================

    if (lastSession.checkout) {
      const checkOutTime = parseTimeToDate(
        attendanceDate,
        lastSession.checkout
      );

      if (!checkOutTime) {
        return res.status(400).json({
          success: false,
          message: "Invalid check-out time.",
        });
      }

      attendance.checkOutTime = checkOutTime;
    } else {
      attendance.checkOutTime = null;
    }

    // ==========================================
    // Breaks
    // ==========================================

    attendance.breaks = [];

    let totalBreakMinutes = 0;

    for (const session of sessions) {
      if (session.breakStart && session.breakEnd) {
        const breakStart = parseTimeToDate(
          attendanceDate,
          session.breakStart
        );

        const breakEnd = parseTimeToDate(
          attendanceDate,
          session.breakEnd
        );

        if (!breakStart || !breakEnd) {
          return res.status(400).json({
            success: false,
            message: "Invalid break time.",
          });
        }

        let duration =
          (breakEnd.getTime() - breakStart.getTime()) /
          60000;

        if (duration < 0) {
          duration = 0;
        }

        duration = Number(duration.toFixed(2));

        attendance.breaks.push({
          startTime: breakStart,
          endTime: breakEnd,
          duration,
        });

        totalBreakMinutes += duration;
      }
    }

    attendance.totalBreakTime = Math.min(
      totalBreakMinutes,
      120
    );

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

const adjustment =
  await createOrUpdateAdjustmentHistory({
    employeeId,
    attendanceDate,
    reason,
    attendance,
    sessions,
  });

const employeeName =
  await getEmployeeName(employeeId);

return res.status(200).json({
  success: true,
  message:
    "Complete attendance updated successfully.",
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
        select: "name firstName lastName uniqueID role",
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
      breakStart: request.sessions?.[0]?.breakStart || "",
      breakEnd: request.sessions?.[0]?.breakEnd || "",
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