const Attendance = require("../models/Attendance");

// ================= HELPER =================
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

const getToday = (date = new Date()) => {
  const parts = getISTDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

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

const formatAttendanceDocument = (attendance) => {
  if (!attendance) return attendance;

  const plainAttendance =
    attendance.toObject?.() ?? JSON.parse(JSON.stringify(attendance));

  const formatDateField = (fieldName) => {
    if (plainAttendance[fieldName] != null) {
      const formattedValue = formatISTTime(plainAttendance[fieldName]);
      plainAttendance[`${fieldName}Display`] = formattedValue;
      plainAttendance[fieldName] = formattedValue;
    }
  };

  formatDateField("checkInTime");
  formatDateField("checkOutTime");
  formatDateField("approvedAt");
  formatDateField("approvedCheckInTime");

  if (plainAttendance.breaks?.length) {
    plainAttendance.breaks = plainAttendance.breaks.map((breakItem) => {
      const formattedBreak = {
        ...breakItem,
        startTimeDisplay: formatISTTime(breakItem.startTime),
        endTimeDisplay: formatISTTime(breakItem.endTime),
      };

      if (breakItem.startTime) {
        formattedBreak.startTime = formatISTTime(breakItem.startTime);
      }

      if (breakItem.endTime) {
        formattedBreak.endTime = formatISTTime(breakItem.endTime);
      }

      return formattedBreak;
    });
  }

  if (plainAttendance.totalBreakTime != null) {
    plainAttendance.totalBreakTimeDisplay = `${Number(
      plainAttendance.totalBreakTime
    ).toFixed(2)} minutes`;
  }

  if (plainAttendance.totalWorkTime != null) {
    plainAttendance.totalWorkTimeDisplay = `${Number(
      plainAttendance.totalWorkTime
    ).toFixed(2)} hours`;
  }

  return plainAttendance;
};

const getISTNow = () => {
  const parts = getISTDateParts(new Date());
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+05:30`;
};

const parseStoredISTTime = (value) => {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const OFFICE_START_TIME = "10:10";

// ================= CHECK IN =================
exports.checkIn = async (req, res) => {
  try {
    const { userId, userType } = req.body;

    const date = getToday();

    // Already requested today?
    const existing = await Attendance.findOne({
      userId,
      date,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message:
          existing.approvalStatus === "pending"
            ? "Your check-in request is already pending admin approval."
            : "You have already checked in today.",
      });
    }

    // Only create request
    const attendance = await Attendance.create({
      userId,
      userType,
      date,

      // Check-in will be set after admin approval
      checkInTime: null,

      // Late will also be calculated after approval
      isLate: false,

      // Employee is not present until approval
      status: "absent",

      approvalStatus: "pending",
    });

    return res.status(201).json({
      success: true,
      message:
        "Check-in request has been sent to the admin. Please wait for approval.",
      data: formatAttendanceDocument(attendance),
    });

  } catch (err) {
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

    if (attendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: "Already checked out",
      });
    }

    const activeBreak = attendance.breaks.find(
      (b) => !b.endTime
    );

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

    const activeBreak = attendance.breaks.find(
      (b) => !b.endTime
    );

    if (!activeBreak) {
      return res.status(400).json({
        success: false,
        message: "No active break found",
      });
    }

    activeBreak.endTime = getISTNow();

    const startTimeValue = parseStoredISTTime(activeBreak.startTime);
    const endTimeValue = parseStoredISTTime(activeBreak.endTime);

    const duration =
      (endTimeValue - startTimeValue) / (1000 * 60);

    activeBreak.duration = Number(duration.toFixed(2));

    attendance.totalBreakTime += Number(
      duration.toFixed(2)
    );

    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Break ended successfully",
      totalBreakTime: attendance.totalBreakTime,
      data: formatAttendanceDocument(attendance),
    });

  } catch (err) {
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

    if (attendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: "Already checked out",
      });
    }

    // Check-In Validation
    const checkInTime =
      attendance.approvedCheckInTime ||
      attendance.checkInTime;

    if (!checkInTime) {
      return res.status(400).json({
        success: false,
        message: "Check-in time not found.",
      });
    }

    // Current Checkout Time
    attendance.checkOutTime = getISTNow();

    // Total Minutes
    let totalMinutes =
      (attendance.checkOutTime.getTime() -
        new Date(checkInTime).getTime()) /
      (1000 * 60);

    // Deduct Break Time (Maximum 60 Minutes)
    const breakMinutes = Math.min(
      attendance.totalBreakTime || 0,
      60
    );

    totalMinutes -= breakMinutes;

    if (totalMinutes < 0) {
      totalMinutes = 0;
    }

    // Total Working Hours
    attendance.totalWorkTime = Number(
      (totalMinutes / 60).toFixed(2)
    );

    // Attendance Status
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
      .populate(
        "userId",
        "name email phoneNumber uniqueID department role"
      )
      .populate(
        "approvedBy",
        "name email role uniqueID"
      );

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
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

  exports.getPendingAttendance = async(req,res)=>{

const data = await Attendance.find({
approvalStatus:"pending"
})
.populate("userId","name uniqueID role");

res.json({
success:true,
data: data.map(formatAttendanceDocument),
});

}

exports.approveAttendance = async (req, res) => {
  try {
    const { attendanceId, adminId } = req.body;

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

    const now = getISTNow();
    const istNow = new Date(now);

    // Office Grace Time (10:10 AM IST)
    const officeTime = new Date(istNow);
    officeTime.setHours(10, 10, 0, 0);

    // Calculate Late Status
    const isLate = istNow > officeTime;

    // ================= APPROVAL =================
    attendance.approvalStatus = "approved";
    attendance.approvedBy = adminId;
    attendance.approvedAt = now;

    // ================= ACTUAL CHECK-IN =================
    attendance.checkInTime = now;
    attendance.isLate = isLate;
    attendance.status = "present";

    await attendance.save();

    return res.status(200).json({
      success: true,
      message: isLate
        ? "Attendance Approved. Employee checked in as Late."
        : "Attendance Approved. Employee checked in successfully.",
      data: formatAttendanceDocument(attendance),
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.rejectAttendance = async(req,res)=>{

const {attendanceId}=req.body;

const attendance=
await Attendance.findById(attendanceId);

attendance.approvalStatus="rejected";

await attendance.save();

res.json({
success:true,
message:"Attendance Rejected"
});

}

exports.getMyAttendanceHistory = async (req, res) => {
  try {

    const { userId } = req.params;

    const attendance = await Attendance.find({
      userId,
    })
      .populate(
        "userId",
        "name email uniqueID role department"
      )
      .sort({
        date: -1,
      });

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance.map(formatAttendanceDocument),
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }
};

exports.getAttendanceByDate = async (req, res) => {
  try {

    const { date } = req.params;

    const attendance = await Attendance.find({
      date,
    }).populate(
      "userId",
      "name uniqueID role department"
    );

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance.map(formatAttendanceDocument),
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }
};

exports.getSingleAttendance = async (req, res) => {
  try {

    const attendance =
      await Attendance.findById(req.params.id)
        .populate(
          "userId",
          "name email uniqueID role department"
        );

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

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }
};

exports.getMonthlyAttendance = async (req, res) => {
  try {

    const { userId, month } = req.params;

    const attendance = await Attendance.find({
      userId,
      date: {
        $regex: `^${month}`,
      },
    }).sort({
      date: -1,
    });

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance.map(formatAttendanceDocument),
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }
};