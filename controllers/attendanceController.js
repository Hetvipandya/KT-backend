const Attendance = require("../models/Attendance");

// ================= HELPER =================
const getToday = () => new Date().toISOString().split("T")[0];

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
      data: attendance,
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
      startTime: new Date(),
    });

    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Break started successfully",
      data: attendance,
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

    activeBreak.endTime = new Date();

    const duration =
      (activeBreak.endTime - activeBreak.startTime) /
      (1000 * 60);

    activeBreak.duration = Number(duration.toFixed(2));

    attendance.totalBreakTime += Number(
      duration.toFixed(2)
    );

    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Break ended successfully",
      totalBreakTime: attendance.totalBreakTime,
      data: attendance,
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
    attendance.checkOutTime = new Date();

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
      data: attendance,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

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
      data: attendance,
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
data
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

    // Current UTC Time
    const now = new Date();

    // Current IST Time
    const istNow = new Date(
      now.toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
      })
    );

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
      data: attendance,
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
      data: attendance,
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
      data: attendance,
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
      data: attendance,
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
      data: attendance,
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }
};