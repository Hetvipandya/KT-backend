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
    attendance.checkInTime.getTime() + 5.5 * 60 * 60 * 1000
  );
  const checkInMinutes =
    istCheckIn.getUTCHours() * 60 + istCheckIn.getUTCMinutes();

  attendance.isLate =
    checkInMinutes > 10 * 60 + 10 && checkInMinutes <= 10 * 60 + 30;

  if (checkInMinutes > 10 * 60 + 30) {
    attendance.status = "absent";
  }
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

// ==========================================
// Direct Adjustment - Immediate Attendance Update
// ==========================================

exports.patchAttendanceAdjustment = async (req, res) => {
  try {
    const { employeeId, date, checkInTime, checkOutTime, reason } = req.body;

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
    // Only update fields which are provided
    // ==========================================

    if (checkInTime !== undefined) {
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

    if (checkOutTime !== undefined) {
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

    // Optional reason
    if (reason !== undefined) {
      attendance.adjustmentReason = reason;
    }

    // ==========================================
    // Recalculate work time
    // ==========================================

    if (attendance.checkInTime && attendance.checkOutTime) {
      let totalMinutes =
        (attendance.checkOutTime.getTime() -
          attendance.checkInTime.getTime()) /
        60000;

      totalMinutes -= attendance.totalBreakTime || 0;

      if (totalMinutes < 0) {
        totalMinutes = 0;
      }

      attendance.totalWorkTime = Number(
        (totalMinutes / 60).toFixed(2)
      );

      // ==========================================
      // Status
      // ==========================================

      attendance.status =
        attendance.totalWorkTime >= 8
          ? "present"
          : attendance.totalWorkTime >= 4
          ? "half-day"
          : "absent";
    }

    applyCheckInStatus(attendance);

    attendance.approvalStatus = "approved";

    await attendance.save();

    const employeeName = await getEmployeeName(employeeId);

    return res.status(200).json({
      success: true,
      message: "Attendance partially updated successfully.",
      data: {
        attendance,
        employeeName,
      },
    });
  } catch (error) {
    console.error("PATCH attendance error:", error);

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

    const employeeName = await getEmployeeName(employeeId);

    return res.status(200).json({
      success: true,
      message: "Complete attendance updated successfully.",
      data: {
        attendance,
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