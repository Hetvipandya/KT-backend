const Attendance = require("../models/Attendance");

// ================= HELPER FUNCTIONS =================

// Get IST date parts from any date
const getISTDateParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
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

// Get current time in IST as Date object
const getISTNow = () => {
  const now = new Date();
  const parts = getISTDateParts(now);
  
  // Create date in IST with +05:30 offset
  const istDate = new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000+05:30`);
  return istDate;
};

// Get office time at 10:10 AM IST
const getOfficeTimeIST = () => {
  const now = new Date();
  const parts = getISTDateParts(now);
  
  // Create office time at 10:10 AM IST
  const officeDate = new Date(`${parts.year}-${parts.month}-${parts.day}T10:10:00.000+05:30`);
  return officeDate;
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
    const { attendanceId, adminId } = req.body;

    if (!attendanceId || !adminId) {
      return res.status(400).json({
        success: false,
        message: "attendanceId and adminId are required",
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

    // Get current time in IST
    const now = getISTNow();
    const officeTime = getOfficeTimeIST();
    const isLate = now.getTime() > officeTime.getTime();

    // Log for debugging
    console.log("=== APPROVAL DEBUG ===");
    console.log("Current IST time:", now.toISOString());
    console.log("Current IST display:", formatISTTime(now));
    console.log("Office time IST:", officeTime.toISOString());
    console.log("Office display:", formatISTTime(officeTime));
    console.log("Is late:", isLate);

    // Update attendance
    attendance.approvalStatus = "approved";
    attendance.approvedBy = adminId;
    attendance.approvedAt = now;
    attendance.checkInTime = now;
    attendance.isLate = isLate;
    attendance.status = "present";

    await attendance.save();

    return res.status(200).json({
      success: true,
      message: isLate
        ? `Attendance Approved. Employee checked in as Late. (Checked in at ${formatISTTime(now)})`
        : "Attendance Approved. Employee checked in successfully.",
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