const Attendance = require("../models/Attendance");
const User = require("../models/User");

const pad = (value) => String(value).padStart(2, "0");

const ensureTodayAttendance = async (date = getToday()) => {
  try {
    // ============================================
    // 1. Get Employees + Interns from User
    // ============================================
    const users = await User.find({
      role: {
        $in: ["employee", "intern"],
      },
    }).select("_id role");

    // ============================================
    // 2. Get Team Leads from Employee collection
    // ============================================
    const Employee = require("../models/Employee");

    const teamLeadEmployees = await Employee.find({
      isTeamLead: true,
    }).select("userId");

    // ============================================
    // 3. Create unique member map
    // ============================================
    const membersMap = new Map();

    users.forEach((user) => {
      membersMap.set(user._id.toString(), {
        _id: user._id,
        role: user.role,
      });
    });

    teamLeadEmployees.forEach((employee) => {
      if (employee.userId) {
        membersMap.set(employee.userId.toString(), {
          _id: employee.userId,
          role: "teamlead",
        });
      }
    });

    const members = Array.from(membersMap.values());

    // ============================================
    // 4. Check existing attendance
    // ============================================
    const existingAttendance = await Attendance.find({
      date,
    }).select("userId");

    const existingUserIds = new Set(
      existingAttendance.map((attendance) =>
        attendance.userId.toString()
      )
    );

    // ============================================
    // 5. Create ABSENT records
    //    for users who have no attendance
    // ============================================
    const absentRecords = [];

    for (const member of members) {
      const userId = member._id.toString();

      if (!existingUserIds.has(userId)) {
        absentRecords.push({
          userId: member._id,
          userType: member.role.toLowerCase(),
          date,

          checkInTime: null,
          approvedCheckInTime: null,
          checkOutTime: null,

          breaks: [],
          totalBreakTime: 0,
          totalWorkTime: 0,

          isLate: false,

          status: "absent",
          approvalStatus: "approved",
        });
      }
    }

    // ============================================
    // 6. Insert absent records
    // ============================================
    if (absentRecords.length > 0) {
      await Attendance.insertMany(absentRecords);
    }

    return {
      success: true,
      date,
      created: absentRecords.length,
    };
  } catch (error) {
    console.error(
      "ensureTodayAttendance Error:",
      error
    );

    throw error;
  }
};

// Get IST date parts from any date
const getISTDateParts = (date = new Date()) => {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 60 * 60000;
  const istDate = new Date(utc + istOffset);

  return { 
    year: istDate.getFullYear(),  
    month: pad(istDate.getMonth() + 1), 
    day: pad(istDate.getDate()),
    hour: pad(istDate.getHours()),
    minute: pad(istDate.getMinutes()),
    second: pad(istDate.getSeconds()),
  };
};

// Get today's date in IST format (YYYY-MM-DD)
const getToday = (date = new Date()) => {
  const parts = getISTDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

// Format time in IST (HH:MM)
const formatISTTime = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;

  return `${hour}:${minute}`;
};

// Format full date time in IST
const formatISTDateTime = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;
  const second = parts.find((p) => p.type === "second")?.value;

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

// Format attendance document for response
const formatAttendanceDocument = (attendance) => {
  if (!attendance) return attendance;

  const plainAttendance =
    attendance.toObject?.() ?? JSON.parse(JSON.stringify(attendance));

  // Add display fields for all date fields
  const formatDateField = (fieldName) => {
    if (plainAttendance[fieldName]) {
      plainAttendance[`${fieldName}Display`] = formatISTTime(
        plainAttendance[fieldName]
      );
      plainAttendance[`${fieldName}FullDisplay`] = formatISTDateTime(
        plainAttendance[fieldName]
      );
    }
  };

  formatDateField("checkInTime");
  formatDateField("checkOutTime");
  formatDateField("approvedAt");
  formatDateField("approvedCheckInTime");
  formatDateField("createdAt");
  formatDateField("updatedAt");

  if (plainAttendance.date) {
    plainAttendance.dateDisplay = plainAttendance.date;
  }

  // Format breaks
  if (plainAttendance.breaks?.length) {
    plainAttendance.breaks = plainAttendance.breaks.map((breakItem) => ({
      ...breakItem,
      startTimeDisplay: formatISTTime(breakItem.startTime),
      endTimeDisplay: formatISTTime(breakItem.endTime),
      startTimeFullDisplay: formatISTDateTime(breakItem.startTime),
      endTimeFullDisplay: formatISTDateTime(breakItem.endTime),
    }));
  }

  // Format total work time
  if (plainAttendance.totalWorkTime != null) {
    const hours = Math.floor(plainAttendance.totalWorkTime);
    const minutes = Math.round((plainAttendance.totalWorkTime - hours) * 60);
    plainAttendance.totalWorkTimeDisplay = `${hours}h ${minutes}m`;
    plainAttendance.totalWorkTimeHours = `${Number(
      plainAttendance.totalWorkTime
    ).toFixed(2)} hours`;
  }

  // Format total break time
  if (plainAttendance.totalBreakTime != null) {
    const hours = Math.floor(plainAttendance.totalBreakTime / 60);
    const minutes = Math.round(plainAttendance.totalBreakTime % 60);
    plainAttendance.totalBreakTimeDisplay = `${hours}h ${minutes}m`;
  }

  return plainAttendance;
};

// Convert IST parts to a UTC Date object representing the same instant
const getISTDateFromParts = ({ year, month, day, hour, minute, second }) => {
  const utcHour = Number(hour) - 5;
  const utcMinute = Number(minute) - 30;
  return new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    utcHour,
    utcMinute,
    Number(second)
  ));
};

// Get current time in IST as a Date object representing the current instant
const getISTNow = () => {
  const now = new Date();
  const parts = getISTDateParts(now);
  return getISTDateFromParts(parts);
};

// Get office time at 10:10 AM IST
const getOfficeTimeIST = () => {
  const now = new Date();
  const parts = getISTDateParts(now);
  return getISTDateFromParts({
    ...parts,
    hour: "10",
    minute: "10",
    second: "00",
  });
};

// Check if current time is late (after 10:10 AM IST)
const isLateCheck = () => {
  const now = getISTNow();
  const officeTime = getOfficeTimeIST();
  return now.getTime() > officeTime.getTime();
};

// Get working hours between two dates
const getWorkingHours = (checkIn, checkOut, breakTime = 0) => {
  if (!checkIn || !checkOut) return 0;
  
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  let totalMinutes = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60);
  
  // Deduct break time (max 60 minutes)
  const breakMinutes = Math.min(breakTime || 0, 60);
  totalMinutes -= breakMinutes;
  
  return Math.max(0, totalMinutes / 60);
};

const OFFICE_START_TIME = "10:10";

// ================= CHECK IN =================
// ================= CHECK IN =================
exports.checkIn = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    // ============================================
    // 1. Find User
    // ============================================
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userType = user.role.trim().toLowerCase();
    const date = getToday();

    // ============================================
    // 2. Make sure today's attendance exists
    // ============================================
    await ensureTodayAttendance();

    // ============================================
    // 3. Find today's attendance
    // ============================================
    let attendance = await Attendance.findOne({
      userId,
      date,
    });

    // ============================================
    // 4. If attendance doesn't exist, create it
    // ============================================
    if (!attendance) {
      attendance = await Attendance.create({
        userId,
        userType,
        date,

        checkInTime: null,
        approvedCheckInTime: null,
        checkOutTime: null,

        breaks: [],
        totalBreakTime: 0,
        totalWorkTime: 0,

        isLate: false,

        status: "absent",
        approvalStatus: "approved",
      });
    }

    // ============================================
    // 5. Already checked in / pending request
    // ============================================

    if (
      attendance.approvalStatus === "pending" &&
      attendance.checkInTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Your check-in request is already pending admin approval.",
      });
    }

    if (
      attendance.approvalStatus === "approved" &&
      attendance.checkInTime
    ) {
      return res.status(400).json({
        success: false,
        message: "You have already checked in today.",
      });
    }

    // ============================================
    // 6. ACTUAL CHECK-IN TIME
    // ============================================
    // IMPORTANT:
    // Check-in time is captured HERE,
    // not when admin approves the request.
    const checkInTime = getISTNow();

    // ============================================
    // 7. Create today's time limits
    // ============================================

    // 10:10 AM = Late Coming start
    const officeStartTime = getISTDateFromParts({
      ...getISTDateParts(checkInTime),
      hour: "10",
      minute: "10",
      second: "00",
    });

    // 10:30 AM = Absent cutoff
    const absentCutoffTime = getISTDateFromParts({
      ...getISTDateParts(checkInTime),
      hour: "10",
      minute: "30",
      second: "00",
    });

    // ============================================
    // 8. Calculate Late / Absent
    // ============================================

    const checkInTimestamp = checkInTime.getTime();

    const isLate =
      checkInTimestamp > officeStartTime.getTime();

    const isAbsentDueToLate =
      checkInTimestamp > absentCutoffTime.getTime();

    // ============================================
    // 9. Update attendance
    // ============================================

    attendance.userType = userType;

    // Save ACTUAL check-in time
    attendance.checkInTime = checkInTime;

    // Approval will set this later
    attendance.approvedCheckInTime = null;

    attendance.checkOutTime = null;

    attendance.breaks = [];
    attendance.totalBreakTime = 0;
    attendance.totalWorkTime = 0;

    // Late flag
    attendance.isLate = isLate;

    // ============================================
    // 10. Status
    // ============================================

    if (isAbsentDueToLate) {
      // After 10:30 AM
      attendance.status = "absent";
    } else {
      // 10:30 AM or before
      attendance.status = "present";
    }

    // Request goes for admin/HR approval
    attendance.approvalStatus = "pending";

    await attendance.save();

    // ============================================
    // 11. Response message
    // ============================================

    let message;

    if (isAbsentDueToLate) {
      message =
        `Check-in request sent. You are marked ABSENT because ` +
        `you checked in after 10:30 AM. ` +
        `(Check-in: ${formatISTTime(checkInTime)})`;
    } else if (isLate) {
      message =
        `Check-in request sent. You are marked as LATE. ` +
        `(Check-in: ${formatISTTime(checkInTime)})`;
    } else {
      message =
        `Check-in request sent successfully. ` +
        `(Check-in: ${formatISTTime(checkInTime)})`;
    }

    // ============================================
    // 12. Response
    // ============================================

    return res.status(201).json({
      success: true,
      message,

      data: formatAttendanceDocument(attendance),
    });

  } catch (err) {
    console.error("CheckIn Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
      error: err,
    });
  }
};

exports.getAllAttendanceForAdmin = async (req, res) => {
  try {
    // Fetch only attendance records where user has actually checked in
    // (either pending approval or already approved with check-in time)
    const attendance = await Attendance.find({
      $or: [
        { approvalStatus: "pending" },
        { 
          approvalStatus: "approved",
          checkInTime: { $ne: null }
        }
      ]
    })
    .populate({
      path: "userId",
      select: "name uniqueID role email department",
    })
    .populate({
      path: "approvedBy",
      select: "name uniqueID role",
    })
    .sort({ createdAt: -1 });

    const formatted = attendance.map((item) => {
      const data = formatAttendanceDocument(item);

      return {
        _id: data._id,

        employee: {
          _id: data.userId?._id,
          name: data.userId?.name || "",
          uniqueID: data.userId?.uniqueID || "",
          email: data.userId?.email || "",
          department: data.userId?.department || "",
          role: data.userId?.role || data.userType,
        },

        date: data.date,
        dateDisplay: data.dateDisplay,

        checkInTime: data.checkInTime,
        checkInTimeDisplay: data.checkInTimeDisplay,
        checkInTimeFullDisplay: data.checkInTimeFullDisplay,

        approvedCheckInTime: data.approvedCheckInTime,
        approvedCheckInTimeDisplay:
          data.approvedCheckInTimeDisplay,
        approvedCheckInTimeFullDisplay:
          data.approvedCheckInTimeFullDisplay,

        checkOutTime: data.checkOutTime,
        checkOutTimeDisplay: data.checkOutTimeDisplay,
        checkOutTimeFullDisplay: data.checkOutTimeFullDisplay,

        breaks: data.breaks,

        totalBreakTime: data.totalBreakTime,
        totalBreakTimeDisplay:
          data.totalBreakTimeDisplay,

        totalWorkTime: data.totalWorkTime,
        totalWorkTimeDisplay:
          data.totalWorkTimeDisplay,

        isLate: data.isLate,

        status: data.status,

        approvalStatus: data.approvalStatus,

        approvedAt: data.approvedAt,
        approvedAtDisplay: data.approvedAtDisplay,
        approvedAtFullDisplay:
          data.approvedAtFullDisplay,

        approvedBy: data.approvedBy
          ? {
              _id: data.approvedBy._id,
              name: data.approvedBy.name,
              uniqueID: data.approvedBy.uniqueID,
              role: data.approvedBy.role,
            }
          : null,

        createdAt: data.createdAt,
        createdAtDisplay: data.createdAtDisplay,

        updatedAt: data.updatedAt,
        updatedAtDisplay: data.updatedAtDisplay,
      };
    });

    return res.status(200).json({
      success: true,
      count: formatted.length,
      attendance: formatted,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= BREAK START =================
exports.startBreak = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const attendance = await Attendance.findOne({
      userId,
      date: getToday(),
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Please check in first",
      });
    }

    if (attendance.approvalStatus !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Your check-in request is not approved yet. Please wait for admin approval.",
      });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: "Already checked out",
      });
    }

    if (!attendance.checkInTime) {
      return res.status(400).json({
        success: false,
        message: "Please check in first",
      });
    }

    const activeBreak = attendance.breaks.find((b) => !b.endTime);

    if (activeBreak) {
      return res.status(400).json({
        success: false,
        message: "Break already started",
      });
    }

    attendance.breaks.push({
      startTime: getISTNow(),
    });

    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Break started successfully",
      data: formatAttendanceDocument(attendance),
    });

  } catch (err) {
    console.error("StartBreak Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= BREAK END =================
exports.endBreak = async (req, res) => {
  try {
    const { userId } = req.body;
    
    const activeBreak = attendance.breaks.find((b) => !b.endTime);
    
    if (!activeBreak) {
      return res.status(400).json({
        success: false,
        message: "No active break found",
      });
    }
    
    const endTime = getISTNow();
    activeBreak.endTime = endTime;
    
    // Break ની duration calculate થાય છે
    const duration = (endTime - activeBreak.startTime) / (1000 * 60);
    activeBreak.duration = Number(duration.toFixed(2));
    
    attendance.totalBreakTime = (attendance.totalBreakTime || 0) + Number(duration.toFixed(2));
    
    await attendance.save();
    
    res.status(200).json({
      success: true,
      message: "Break ended successfully",
      totalBreakTime: attendance.totalBreakTime,
      data: formatAttendanceDocument(attendance),
    });
    
  } catch (err) {
    console.error("EndBreak Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= CHECK OUT =================
exports.checkOut = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const attendance = await Attendance.findOne({
      userId,
      date: getToday(),
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance not found",
      });
    }

    if (attendance.approvalStatus !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Your check-in request is not approved yet. Please wait for admin approval.",
      });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: "Already checked out",
      });
    }

    const checkInTime = attendance.approvedCheckInTime || attendance.checkInTime;

    if (!checkInTime) {
      return res.status(400).json({
        success: false,
        message: "Check-in time not found.",
      });
    }

    // Set checkout time
    attendance.checkOutTime = getISTNow();

    // Calculate working hours
 const totalHours = getWorkingHours(
  checkInTime,
  attendance.checkOutTime,
  attendance.totalBreakTime
);

attendance.totalWorkTime = Number(totalHours.toFixed(2));

if (attendance.totalWorkTime >= 8) {
  attendance.status = "present";
} else if (attendance.totalWorkTime >= 4) {
  attendance.status = "half-day";
} else {
  attendance.status = "absent";
}

    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Check-Out Successful",
      totalWorkTime: attendance.totalWorkTime,
      totalBreakTime: attendance.totalBreakTime,
      data: formatAttendanceDocument(attendance),
    });

  } catch (err) {
    console.error("CheckOut Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= ATTENDANCE REPORT =================
exports.getAttendanceById = async (req, res) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findById(id)
      .populate("userId", "name email phoneNumber uniqueID department role")
      .populate("approvedBy", "name email role uniqueID");

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance not found",
      });
    }

    res.status(200).json({
      success: true,
      data: formatAttendanceDocument(attendance),
    });

  } catch (err) {
    console.error("GetAttendanceById Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= GET PENDING ATTENDANCE =================
exports.getPendingAttendance = async (req, res) => { 
  try {
    const data = await Attendance.find({
      approvalStatus: "pending",
    }).populate("userId", "name uniqueID role");

    res.json({
      success: true,
      count: data.length,
      data: data.map(formatAttendanceDocument),
    });
  } catch (err) {
    console.error("GetPendingAttendance Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= APPROVE ATTENDANCE =================
exports.approveAttendance = async (req, res) => {
  try {
    const { attendanceId, approvedBy } = req.body;

    // ============================================
    // 1. Validate request
    // ============================================
    if (!attendanceId || !approvedBy) {
      return res.status(400).json({
        success: false,
        message: "attendanceId and approvedBy are required",
      });
    }

    // ============================================
    // 2. Check approver
    // ============================================
    const approver = await User.findById(approvedBy);

    if (!approver) {
      return res.status(404).json({
        success: false,
        message: "Approver not found",
      });
    }

    // ============================================
    // 3. Only Admin / HR can approve
    // ============================================
    if (!["admin", "hr"].includes(approver.role.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: "Only Admin or HR can approve attendance",
      });
    }

    // ============================================
    // 4. Find attendance request
    // ============================================
    const attendance = await Attendance.findById(attendanceId);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance request not found",
      });
    }

    // ============================================
    // 5. Check current approval status
    // ============================================
    if (attendance.approvalStatus === "approved") {
      return res.status(400).json({
        success: false,
        message: "Attendance already approved",
      });
    }

    if (attendance.approvalStatus === "rejected") {
      return res.status(400).json({
        success: false,
        message: "Attendance request has already been rejected",
      });
    }

    // ============================================
    // 6. Actual employee check-in time
    // ============================================
    const checkInTime = attendance.checkInTime;

    if (!checkInTime) {
      return res.status(400).json({
        success: false,
        message: "Employee check-in time not found",
      });
    }

    // ============================================
    // 7. Approval time
    // ============================================
    const approvalTime = getISTNow();

    // ============================================
    // 8. Create time limits
    // ============================================

    // 10:10 AM = Late Coming
    const officeStartTime = getISTDateFromParts({
      ...getISTDateParts(checkInTime),
      hour: "10",
      minute: "10",
      second: "00",
    });

    // 10:30 AM = Absent cutoff
    const absentCutoffTime = getISTDateFromParts({
      ...getISTDateParts(checkInTime),
      hour: "10",
      minute: "30",
      second: "00",
    });

    // ============================================
    // 9. Calculate status using ACTUAL check-in
    // ============================================

    const checkInTimestamp =
      new Date(checkInTime).getTime();

    const isLate =
      checkInTimestamp > officeStartTime.getTime();

    const isAbsentDueToLate =
      checkInTimestamp > absentCutoffTime.getTime();

    // ============================================
    // 10. Approve attendance
    // ============================================

    attendance.approvalStatus = "approved";

    attendance.approvedBy = approver._id;

    attendance.approvedAt = approvalTime;

    // IMPORTANT:
    // Do NOT replace checkInTime with approval time.
    //
    // Employee actual check-in time remains unchanged.
    attendance.checkInTime = checkInTime;

    // Store the same actual check-in time
    // as approved check-in time.
    attendance.approvedCheckInTime = checkInTime;

    attendance.isLate = isLate;

    // ============================================
    // 11. Set final attendance status
    // ============================================

    if (isAbsentDueToLate) {
      // After 10:30 AM
      attendance.status = "absent";
    } else {
      // 10:30 AM or before
      attendance.status = "present";
    }

    await attendance.save();

    // ============================================
    // 12. Response message
    // ============================================

    let message;

    if (isAbsentDueToLate) {
      message =
        `Attendance Approved, but employee is marked ABSENT ` +
        `because check-in was after 10:30 AM. ` +
        `(Checked in at ${formatISTTime(checkInTime)})`;
    } else if (isLate) {
      message =
        `Attendance Approved by ${approver.role}. ` +
        `Employee checked in as Late. ` +
        `(Checked in at ${formatISTTime(checkInTime)})`;
    } else {
      message =
        `Attendance Approved by ${approver.role}. ` +
        `Employee checked in successfully. ` +
        `(Checked in at ${formatISTTime(checkInTime)})`;
    }

    // ============================================
    // 13. Response
    // ============================================

    return res.status(200).json({
      success: true,
      message,

      data: formatAttendanceDocument(attendance),
    });

  } catch (err) {
    console.error("ApproveAttendance Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= REJECT ATTENDANCE =================
exports.rejectAttendance = async (req, res) => {
  try {
    const { attendanceId } = req.body;

    if (!attendanceId) {
      return res.status(400).json({
        success: false,
        message: "attendanceId is required",
      });
    }

    const attendance = await Attendance.findById(attendanceId);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance not found",
      });
    }

    if (attendance.approvalStatus === "approved") {
      return res.status(400).json({
        success: false,
        message: "Attendance already approved, cannot reject",
      });
    }

    attendance.approvalStatus = "rejected";
    await attendance.save();

    res.json({
      success: true,
      message: "Attendance Rejected",
      data: formatAttendanceDocument(attendance),
    });
  } catch (err) {
    console.error("RejectAttendance Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= GET MY ATTENDANCE HISTORY =================
exports.getMyAttendanceHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const attendance = await Attendance.find({ userId })
      .populate("userId", "name email uniqueID role department")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance.map(formatAttendanceDocument),
    });
  } catch (err) {
    console.error("GetMyAttendanceHistory Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= GET ATTENDANCE BY DATE =================
exports.getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "date is required (YYYY-MM-DD)",
      });
    }

    const attendance = await Attendance.find({ date })
      .populate("userId", "name uniqueID role department");

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance.map(formatAttendanceDocument),
    });
  } catch (err) {
    console.error("GetAttendanceByDate Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= GET SINGLE ATTENDANCE =================
exports.getSingleAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findById(id)
      .populate("userId", "name email uniqueID role department");

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance not found",
      });
    }

    res.status(200).json({
      success: true,
      data: formatAttendanceDocument(attendance),
    });
  } catch (err) {
    console.error("GetSingleAttendance Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= GET MONTHLY ATTENDANCE =================
exports.getMonthlyAttendance = async (req, res) => {
  try {
    const { userId, month } = req.params;

    if (!userId || !month) {
      return res.status(400).json({
        success: false,
        message: "userId and month are required (YYYY-MM)",
      });
    }

    const attendance = await Attendance.find({
      userId,
      date: {
        $regex: `^${month}`,
      },
    }).sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance.map(formatAttendanceDocument),
    });
  } catch (err) {
    console.error("GetMonthlyAttendance Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= ADMIN DASHBOARD STATISTICS =================
exports.getAttendanceStats = async (req, res) => {
  try {
    const today = getToday();

    const stats = await Attendance.aggregate([
      {
        $match: {
          date: today,
        },
      },
      {
        $group: {
          _id: "$approvalStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0,
    };

    stats.forEach((item) => {
      result[item._id] = item.count;
      result.total += item.count;
    });

    // Get present/absent counts for today
    const presentCount = await Attendance.countDocuments({
      date: today,
      approvalStatus: "approved",
      status: "present",
    });

    const absentCount = await Attendance.countDocuments({
      date: today,
      approvalStatus: "approved",
      status: "absent",
    });

    const halfDayCount = await Attendance.countDocuments({
      date: today,
      approvalStatus: "approved",
      status: "half-day",
    });

    res.status(200).json({
      success: true,
      data: {
        ...result,
        present: presentCount,
        absent: absentCount,
        halfDay: halfDayCount,
      },
    });
  } catch (err) {
    console.error("GetAttendanceStats Error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= GET ABSENT ATTENDANCE =================
exports.getAbsentAttendance = async (req, res) => {
  try {
    const { date } = req.params;
    
    // ============================================
    // 1. Build query
    // ============================================
    const query = {};
    
    // If date is provided, filter by date
    if (date) {
      query.date = date;
    } else {
      // Default to today's date
      query.date = getToday();
    }
    
    // Status "absent" - both approvalStatus and status should be considered
    query.$or = [
      { 
        approvalStatus: "approved", 
        status: "absent" 
      },
      { 
        approvalStatus: "pending", 
        status: "absent" 
      }
    ];
    
    // ============================================
    // 2. Fetch absent attendance records
    // ============================================
    const absentRecords = await Attendance.find(query)
      .populate({
        path: "userId",
        select: "name uniqueID role email department phoneNumber",
      })
      .populate({
        path: "approvedBy",
        select: "name uniqueID role",
      })
      .sort({ createdAt: -1 });

    // ============================================
    // 3. Format response
    // ============================================
    const formatted = absentRecords.map((item) => {
      const data = formatAttendanceDocument(item);

      return {
        _id: data._id,

        employee: {
          _id: data.userId?._id,
          name: data.userId?.name || "",
          uniqueID: data.userId?.uniqueID || "",
          email: data.userId?.email || "",
          department: data.userId?.department || "",
          phoneNumber: data.userId?.phoneNumber || "",
          role: data.userId?.role || data.userType,
        },

        date: data.date,
        dateDisplay: data.dateDisplay,

        checkInTime: data.checkInTime,
        checkInTimeDisplay: data.checkInTimeDisplay,
        checkInTimeFullDisplay: data.checkInTimeFullDisplay,

        approvedCheckInTime: data.approvedCheckInTime,
        approvedCheckInTimeDisplay: data.approvedCheckInTimeDisplay,
        approvedCheckInTimeFullDisplay: data.approvedCheckInTimeFullDisplay,

        checkOutTime: data.checkOutTime,
        checkOutTimeDisplay: data.checkOutTimeDisplay,
        checkOutTimeFullDisplay: data.checkOutTimeFullDisplay,

        breaks: data.breaks,
        totalBreakTime: data.totalBreakTime,
        totalBreakTimeDisplay: data.totalBreakTimeDisplay,

        totalWorkTime: data.totalWorkTime,
        totalWorkTimeDisplay: data.totalWorkTimeDisplay,

        isLate: data.isLate,
        status: data.status,
        approvalStatus: data.approvalStatus,

        approvedAt: data.approvedAt,
        approvedAtDisplay: data.approvedAtDisplay,
        approvedAtFullDisplay: data.approvedAtFullDisplay,

        approvedBy: data.approvedBy
          ? {
              _id: data.approvedBy._id,
              name: data.approvedBy.name,
              uniqueID: data.approvedBy.uniqueID,
              role: data.approvedBy.role,
            }
          : null,

        createdAt: data.createdAt,
        createdAtDisplay: data.createdAtDisplay,

        updatedAt: data.updatedAt,
        updatedAtDisplay: data.updatedAtDisplay,
      };
    });

    // ============================================
    // 4. Statistics
    // ============================================
    const totalAbsent = formatted.length;
    
    const pendingAbsent = absentRecords.filter(
      (record) => record.approvalStatus === "pending"
    ).length;
    
    const approvedAbsent = absentRecords.filter(
      (record) => record.approvalStatus === "approved"
    ).length;

    // Role-wise breakdown
    const roleWise = {
      employee: 0,
      intern: 0,
      teamlead: 0,
      other: 0,
    };

    formatted.forEach((record) => {
      const role = record.employee?.role?.toLowerCase() || "other";
      if (role === "employee") roleWise.employee++;
      else if (role === "intern") roleWise.intern++;
      else if (role === "teamlead" || role === "team lead") roleWise.teamlead++;
      else roleWise.other++;
    });

    // ============================================
    // 5. Response
    // ============================================
    return res.status(200).json({
      success: true,
      message: `Absent attendance records for ${query.date}`,
      
      summary: {
        total: totalAbsent,
        pending: pendingAbsent,
        approved: approvedAbsent,
        date: query.date,
        roleWise,
      },
      
      data: formatted,
    });

  } catch (err) {
    console.error("GetAbsentAttendance Error:", err);
    
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= GET ABSENT ATTENDANCE BY DATE RANGE =================
exports.getAbsentAttendanceByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // ============================================
    // 1. Validate dates
    // ============================================
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required (YYYY-MM-DD)",
      });
    }

    // ============================================
    // 2. Build query
    // ============================================
    const query = {
      date: {
        $gte: startDate,
        $lte: endDate,
      },
      $or: [
        { 
          approvalStatus: "approved", 
          status: "absent" 
        },
        { 
          approvalStatus: "pending", 
          status: "absent" 
        }
      ]
    };

    // ============================================
    // 3. Fetch absent attendance records
    // ============================================
    const absentRecords = await Attendance.find(query)
      .populate({
        path: "userId",
        select: "name uniqueID role email department phoneNumber",
      })
      .populate({
        path: "approvedBy",
        select: "name uniqueID role",
      })
      .sort({ date: -1, createdAt: -1 });

    // ============================================
    // 4. Format response
    // ============================================
    const formatted = absentRecords.map((item) => {
      const data = formatAttendanceDocument(item);

      return {
        _id: data._id,

        employee: {
          _id: data.userId?._id,
          name: data.userId?.name || "",
          uniqueID: data.userId?.uniqueID || "",
          email: data.userId?.email || "",
          department: data.userId?.department || "",
          phoneNumber: data.userId?.phoneNumber || "",
          role: data.userId?.role || data.userType,
        },

        date: data.date,
        dateDisplay: data.dateDisplay,

        checkInTime: data.checkInTime,
        checkInTimeDisplay: data.checkInTimeDisplay,
        checkInTimeFullDisplay: data.checkInTimeFullDisplay,

        approvedCheckInTime: data.approvedCheckInTime,
        approvedCheckInTimeDisplay: data.approvedCheckInTimeDisplay,
        approvedCheckInTimeFullDisplay: data.approvedCheckInTimeFullDisplay,

        checkOutTime: data.checkOutTime,
        checkOutTimeDisplay: data.checkOutTimeDisplay,
        checkOutTimeFullDisplay: data.checkOutTimeFullDisplay,

        breaks: data.breaks,
        totalBreakTime: data.totalBreakTime,
        totalBreakTimeDisplay: data.totalBreakTimeDisplay,

        totalWorkTime: data.totalWorkTime,
        totalWorkTimeDisplay: data.totalWorkTimeDisplay,

        isLate: data.isLate,
        status: data.status,
        approvalStatus: data.approvalStatus,

        approvedAt: data.approvedAt,
        approvedAtDisplay: data.approvedAtDisplay,
        approvedAtFullDisplay: data.approvedAtFullDisplay,

        approvedBy: data.approvedBy
          ? {
              _id: data.approvedBy._id,
              name: data.approvedBy.name,
              uniqueID: data.approvedBy.uniqueID,
              role: data.approvedBy.role,
            }
          : null,

        createdAt: data.createdAt,
        createdAtDisplay: data.createdAtDisplay,

        updatedAt: data.updatedAt,
        updatedAtDisplay: data.updatedAtDisplay,
      };
    });

    // ============================================
    // 5. Daily breakdown
    // ============================================
    const dailyBreakdown = {};
    
    formatted.forEach((record) => {
      const date = record.date;
      if (!dailyBreakdown[date]) {
        dailyBreakdown[date] = {
          date,
          count: 0,
          pending: 0,
          approved: 0,
          employees: [],
        };
      }
      dailyBreakdown[date].count++;
      
      if (record.approvalStatus === "pending") {
        dailyBreakdown[date].pending++;
      } else if (record.approvalStatus === "approved") {
        dailyBreakdown[date].approved++;
      }
      
      dailyBreakdown[date].employees.push({
        _id: record.employee._id,
        name: record.employee.name,
        uniqueID: record.employee.uniqueID,
        role: record.employee.role,
      });
    });

    // ============================================
    // 6. Response
    // ============================================
    return res.status(200).json({
      success: true,
      message: `Absent attendance records from ${startDate} to ${endDate}`,
      
      summary: {
        total: formatted.length,
        startDate,
        endDate,
        dateRange: `${startDate} to ${endDate}`,
      },
      
      dailyBreakdown: Object.values(dailyBreakdown),
      
      data: formatted,
    });

  } catch (err) {
    console.error("GetAbsentAttendanceByDateRange Error:", err);
    
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= GET USER'S ABSENT ATTENDANCE =================
exports.getAllAbsentAttendance = async (req, res) => {
  try {
    const { date, month } = req.query;

    // ============================================
    // 1. Target Date
    // ============================================
    const targetDate = date || getToday();

    // ============================================
    // 2. Get all active employees/interns/teamleads
    // ============================================
    const users = await User.find({
      role: {
        $in: ["employee", "intern", "teamlead"],
      },
    }).select(
      "_id name uniqueID role email department phoneNumber"
    );

    // ============================================
    // 3. Get attendance records for target date
    // ============================================
    const attendanceRecords = await Attendance.find({
      date: targetDate,
    })
      .populate({
        path: "userId",
        select: "name uniqueID role email department phoneNumber",
      })
      .populate({
        path: "approvedBy",
        select: "name uniqueID role",
      })
      .sort({ createdAt: -1 });

    // ============================================
    // 4. Create attendance map by userId
    // ============================================
    const attendanceMap = new Map();

    attendanceRecords.forEach((attendance) => {
      if (attendance.userId?._id) {
        attendanceMap.set(
          attendance.userId._id.toString(),
          attendance
        );
      }
    });

    // ============================================
    // 5. Find users who did NOT check in
    // ============================================
    const absentUsers = [];

    users.forEach((user) => {
      const userId = user._id.toString();
      const attendance = attendanceMap.get(userId);

      // --------------------------------------------
      // No attendance record = ABSENT
      // --------------------------------------------
      if (!attendance) {
        absentUsers.push({
          _id: null,

          employee: {
            _id: user._id,
            name: user.name || "",
            uniqueID: user.uniqueID || "",
            email: user.email || "",
            department: user.department || "",
            phoneNumber: user.phoneNumber || "",
            role: user.role || "",
          },

          date: targetDate,

          dateDisplay: targetDate,

          checkInTime: null,
          checkInTimeDisplay: null,
          checkInTimeFullDisplay: null,

          approvedCheckInTime: null,
          approvedCheckInTimeDisplay: null,
          approvedCheckInTimeFullDisplay: null,

          checkOutTime: null,
          checkOutTimeDisplay: null,
          checkOutTimeFullDisplay: null,

          breaks: [],
          totalBreakTime: 0,
          totalBreakTimeDisplay: "0 minutes",

          totalWorkTime: 0,
          totalWorkTimeDisplay: "0 hours",

          isLate: false,

          status: "absent",

          // No attendance record exists
          approvalStatus: "not_checked_in",

          approvedAt: null,
          approvedAtDisplay: null,
          approvedAtFullDisplay: null,

          approvedBy: null,

          createdAt: null,
          createdAtDisplay: null,

          updatedAt: null,
          updatedAtDisplay: null,
        });

        return;
      }

      // --------------------------------------------
      // Attendance exists but no check-in
      // --------------------------------------------
      const hasCheckIn =
        attendance.checkInTime ||
        attendance.approvedCheckInTime;

      if (!hasCheckIn) {
        const data = formatAttendanceDocument(attendance);

        absentUsers.push({
          _id: data._id,

          employee: {
            _id: data.userId?._id,
            name: data.userId?.name || user.name || "",
            uniqueID:
              data.userId?.uniqueID || user.uniqueID || "",
            email:
              data.userId?.email || user.email || "",
            department:
              data.userId?.department || user.department || "",
            phoneNumber:
              data.userId?.phoneNumber ||
              user.phoneNumber ||
              "",
            role:
              data.userId?.role ||
              data.userType ||
              user.role ||
              "",
          },

          date: data.date || targetDate,
          dateDisplay: data.dateDisplay || targetDate,

          checkInTime: data.checkInTime,
          checkInTimeDisplay: data.checkInTimeDisplay,
          checkInTimeFullDisplay: data.checkInTimeFullDisplay,

          approvedCheckInTime: data.approvedCheckInTime,
          approvedCheckInTimeDisplay:
            data.approvedCheckInTimeDisplay,
          approvedCheckInTimeFullDisplay:
            data.approvedCheckInTimeFullDisplay,

          checkOutTime: data.checkOutTime,
          checkOutTimeDisplay: data.checkOutTimeDisplay,
          checkOutTimeFullDisplay:
            data.checkOutTimeFullDisplay,

          breaks: data.breaks,
          totalBreakTime: data.totalBreakTime,
          totalBreakTimeDisplay:
            data.totalBreakTimeDisplay,

          totalWorkTime: data.totalWorkTime,
          totalWorkTimeDisplay:
            data.totalWorkTimeDisplay,

          isLate: data.isLate,
          status: "absent",
          approvalStatus:
            data.approvalStatus || "pending",

          approvedAt: data.approvedAt,
          approvedAtDisplay:
            data.approvedAtDisplay,
          approvedAtFullDisplay:
            data.approvedAtFullDisplay,

          approvedBy: data.approvedBy
            ? {
                _id: data.approvedBy._id,
                name: data.approvedBy.name,
                uniqueID: data.approvedBy.uniqueID,
                role: data.approvedBy.role,
              }
            : null,

          createdAt: data.createdAt,
          createdAtDisplay:
            data.createdAtDisplay,

          updatedAt: data.updatedAt,
          updatedAtDisplay:
            data.updatedAtDisplay,
        });
      }
    });

    // ============================================
    // 6. Month filter
    // ============================================
    let finalData = absentUsers;

    if (month) {
      finalData = absentUsers.filter(
        (record) =>
          record.date &&
          record.date.startsWith(month)
      );
    }

    // ============================================
    // 7. Role-wise breakdown
    // ============================================
    const roleWise = {
      employee: 0,
      intern: 0,
      teamlead: 0,
      other: 0,
    };

    finalData.forEach((record) => {
      const role =
        record.employee?.role?.toLowerCase() || "other";

      if (role === "employee") {
        roleWise.employee++;
      } else if (role === "intern") {
        roleWise.intern++;
      } else if (
        role === "teamlead" ||
        role === "team lead"
      ) {
        roleWise.teamlead++;
      } else {
        roleWise.other++;
      }
    });

    // ============================================
    // 8. Pending / Approved
    // ============================================
    const pendingAbsent = finalData.filter(
      (record) =>
        record.approvalStatus === "pending"
    ).length;

    const approvedAbsent = finalData.filter(
      (record) =>
        record.approvalStatus === "approved"
    ).length;

    const notCheckedIn = finalData.filter(
      (record) =>
        record.approvalStatus === "not_checked_in"
    ).length;

    // ============================================
    // 9. Response
    // ============================================
    return res.status(200).json({
      success: true,

      message: "Date-wise absent attendance records",

      summary: {
        total: finalData.length,

        pending: pendingAbsent,

        approved: approvedAbsent,

        notCheckedIn: notCheckedIn,

        roleWise,

        date: targetDate,

        ...(month && {
          month,
        }),
      },

      data: finalData,
    });
  } catch (err) {
    console.error(
      "GetAllAbsentAttendance Error:",
      err
    );

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};