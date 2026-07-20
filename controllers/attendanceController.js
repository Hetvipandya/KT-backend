const Attendance = require("../models/Attendance");
const User = require("../models/User");

const pad = (value) => String(value).padStart(2, "0");

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
exports.checkIn = async (req, res) => {
  try {
    const { userId, userType } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const date = getToday();

    // Check if already checked in today
    const existing = await Attendance.findOne({
      userId,
      date,
    });

    if (existing) {
      let message = "You have already checked in today.";
      if (existing.approvalStatus === "pending") {
        message = "Your check-in request is already pending admin approval.";
      } else if (existing.approvalStatus === "approved") {
        message = "You have already checked in today.";
      }
      return res.status(400).json({
        success: false,
        message,
      });
    }

    // Create attendance request
    const attendance = await Attendance.create({
      userId,
      userType: userType || "employee",
      date,
      checkInTime: null,
      isLate: false,
      status: "absent",
      approvalStatus: "pending",
      totalBreakTime: 0,
      totalWorkTime: 0,
      breaks: [],
    });

    return res.status(201).json({
      success: true,
      message: "Check-in request has been sent to the admin. Please wait for approval.",
      data: formatAttendanceDocument(attendance),
    });

  } catch (err) {
    console.error("CheckIn Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    }); 
  }
};

exports.getAllAttendanceForAdmin = async (req, res) => {
  try {
    const attendance = await Attendance.find()
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

    const activeBreak = attendance.breaks.find((b) => !b.endTime);

    if (!activeBreak) {
      return res.status(400).json({
        success: false,
        message: "No active break found",
      });
    }

    const endTime = getISTNow();
    activeBreak.endTime = endTime;

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

    // Determine attendance status based on total working hours
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

    if (!attendanceId || !approvedBy) {
      return res.status(400).json({
        success: false,
        message: "attendanceId and approvedBy are required",
      });
    }

    // Check approver
    const approver = await User.findById(approvedBy);

    if (!approver) {
      return res.status(404).json({
        success: false,
        message: "Approver not found",
      });
    }

    // Only Admin or HR can approve
    if (!["admin", "hr"].includes(approver.role.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: "Only Admin or HR can approve attendance",
      });
    }

    const attendance = await Attendance.findById(attendanceId);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance request not found",
      });
    }

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

    // Current IST Time
    const now = getISTNow();
    const officeTime = getOfficeTimeIST();
    const isLate = now.getTime() > officeTime.getTime();

    attendance.approvalStatus = "approved";
    attendance.approvedBy = approver._id;
    attendance.approvedAt = now;
    attendance.checkInTime = now;
    attendance.approvedCheckInTime = now;
    attendance.isLate = isLate;
    attendance.status = "present";

    await attendance.save();

    return res.status(200).json({
      success: true,
      message: isLate
        ? `Attendance Approved by ${approver.role}. Employee checked in as Late. (Checked in at ${formatISTTime(now)})`
        : `Attendance Approved by ${approver.role}. Employee checked in successfully.`,
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