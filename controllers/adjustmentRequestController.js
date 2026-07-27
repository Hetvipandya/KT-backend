const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const User = require("../models/User");
const TeamLead = require("../models/Team");

// Helper function to parse time
const parseTimeToDate = (dateStr, timeStr) => {
  if (!timeStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30, 0));
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
  // Team Lead
const team = await TeamLead.findOne({
    teamLeadUser: employeeId
})
.populate({
    path: "teamLeadUser",
    select: "name"
})
.lean();

if (team && team.teamLeadUser) {
    return team.teamLeadUser.name;
}
    if (teamLead) {
      const firstName = teamLead.firstName || '';
      const lastName = teamLead.lastName || '';
      const name = teamLead.name || '';
      return [firstName, lastName].filter(Boolean).join(' ') || name || 'Unknown Employee';
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

exports.createDirectAdjustment = async (req, res) => {
  try {
    const {
      employeeId,
      date,
      sessions,
      reason,
    } = req.body;

    // Validate required fields
    if (!employeeId || !date || !reason) {
      return res.status(400).json({
        success: false,
        message: "Employee, Date and Reason are required.",
      });
    }

    // Check if any session has data
    let hasAnyTime = false;
    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        if (session.checkin || session.breakStart || session.breakEnd || session.checkout) {
          hasAnyTime = true;
          break;
        }
      }
    }

    if (!hasAnyTime) {
      return res.status(400).json({
        success: false,
        message: "At least one time field is required.",
      });
    }

    // Get employee name from any source
    const employeeName = await getEmployeeName(employeeId);
    
    // Determine user type by checking which collection the employee belongs to
// ======================================
// Detect User Type
// ======================================

let userType = "employee";

try {

    // Employee collection
    const employee = await Employee.findById(employeeId).lean();

    if (employee) {

        userType = "employee";

    } else {

        // User collection
        const user = await User.findById(employeeId).lean();

        if (user) {

            if (user.role === "intern") {
                userType = "intern";
            }

            else if (user.role === "admin") {
                userType = "admin";
            }

            else if (user.role === "hr") {
                userType = "admin";     // અથવા Attendance enum માં hr add કર
            }

            else {

                // Team Collection માં check કર
                const team = await TeamLead.findOne({
                    teamLeadUser: user._id
                }).lean();

                if (team) {
                    userType = "team lead"; // Attendance schema પ્રમાણે રાખજે
                }
            }
        }
    }

} catch (err) {

    console.error("User type error :", err);

}

    // Find or create attendance record
    const attendanceDate = date;

    let attendance = await Attendance.findOne({
      userId: employeeId,
      date: attendanceDate,
    });

    if (!attendance) {
      attendance = new Attendance({
        userId: employeeId,
        userType,
        date: attendanceDate,
        status: "present",
        approvalStatus: "approved",
        breaks: [],
      });
    } else {
      if (!attendance.userType) {
        attendance.userType = userType;
      }
    }

    if (sessions && sessions.length > 0) {
      const firstSession = sessions[0];
      const lastSession = sessions[sessions.length - 1];

      if (firstSession.checkin) {
        const checkInTime = parseTimeToDate(date, firstSession.checkin);
        if (checkInTime) {
          attendance.checkInTime = checkInTime;
          attendance.approvedCheckInTime = checkInTime;
        }
      }

      if (lastSession.checkout) {
        const checkOutTime = parseTimeToDate(date, lastSession.checkout);
        if (checkOutTime) {
          attendance.checkOutTime = checkOutTime;
        }
      }

      attendance.breaks = [];
      let totalBreakMinutes = 0;

      for (const session of sessions) {
        if (session.breakStart && session.breakEnd) {
          const breakStart = parseTimeToDate(date, session.breakStart);
          const breakEnd = parseTimeToDate(date, session.breakEnd);

          if (breakStart && breakEnd) {
            const duration = Number(
              ((breakEnd.getTime() - breakStart.getTime()) / 60000).toFixed(2)
            );
            attendance.breaks.push({
              startTime: breakStart,
              endTime: breakEnd,
              duration,
            });
            totalBreakMinutes += duration;
          }
        }
      }

      attendance.totalBreakTime = Math.min(totalBreakMinutes, 120);

      if (attendance.checkInTime && attendance.checkOutTime) {
        let totalMinutes =
          (attendance.checkOutTime.getTime() -
            attendance.checkInTime.getTime()) /
          60000;

        totalMinutes -= attendance.totalBreakTime;

        if (totalMinutes < 0) totalMinutes = 0;

        attendance.totalWorkTime = Number(
          (totalMinutes / 60).toFixed(2)
        );
      }

      attendance.status =
        attendance.totalWorkTime >= 8
          ? "present"
          : attendance.totalWorkTime >= 4
          ? "half-day"
          : "absent";

      attendance.approvalStatus = "approved";
    }

    // Save attendance
    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Attendance updated successfully.",
      data: {
        attendance,
        employeeName
      }
    });

  } catch (error) {
    console.error('Error in direct adjustment:', error);
    res.status(500).json({
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

    const attendances = await Attendance.find(query)
      .populate({
        path: "userId",
        select: "name firstName lastName uniqueID role",
      })
      .sort({ date: -1 })
      .limit(20);

 const adjustments = attendances.map((att) => ({
  _id: att._id,
  employeeId: att.userId?._id,
  employeeName:
    att.userId?.name ||
    `${att.userId?.firstName || ""} ${att.userId?.lastName || ""}`.trim() ||
    "Unknown Employee",

  date: att.date,
  checkInTime: att.checkInTime,
  checkOutTime: att.checkOutTime,

  breakStart: att.breaks?.[0]?.startTime || "",
  breakEnd: att.breaks?.[0]?.endTime || "",

  breaks: att.breaks,

  totalBreakTime: att.totalBreakTime,
  totalWorkTime: att.totalWorkTime,
  status: att.status,
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