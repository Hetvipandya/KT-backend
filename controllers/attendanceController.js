const Attendance = require("../models/Attendance");

// ================= HELPER =================
const getToday = () => new Date().toISOString().split("T")[0];

const OFFICE_START_TIME = "10:00";

// ================= CHECK IN =================
exports.checkIn = async (req, res) => {
  try {
    const { userId, userType  } = req.body;

    const date = getToday();

    const existing = await Attendance.findOne({
      userId,
      date,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Already checked in today",
      });
    }

    const now = new Date();

    const officeTime = new Date();

    const [hour, minute] = OFFICE_START_TIME.split(":");

    officeTime.setHours(
      Number(hour),
      Number(minute),
      0,
      0
    );

    const isLate = now > officeTime;

    const attendance = await Attendance.create({
      userId,
       userType,
      date,
      checkInTime: now,
      isLate,
       status: "present",
    });

    res.status(201).json({
      success: true,
      message: "Check-in successful",
      data: attendance,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= BREAK START =================
exports.startBreak = async (req, res) => {
  try {
    const { userId } = req.body;

    const date = getToday();

    const attendance = await Attendance.findOne({
      userId,
      date,
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

    const lastBreak =
      attendance.breaks[attendance.breaks.length - 1];

    if (lastBreak && !lastBreak.endTime) {
      return res.status(400).json({
        success: false,
        message: "Break already started",
      });
    }

    attendance.breaks.push({
      startTime: new Date(),
    });

    await attendance.save();

    res.json({
      success: true,
      message: "Break started",
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

    const date = getToday();

    const attendance = await Attendance.findOne({
      userId,
      date,
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance not found",
      });
    }

    const lastBreak =
      attendance.breaks[attendance.breaks.length - 1];

    if (!lastBreak || lastBreak.endTime) {
      return res.status(400).json({
        success: false,
        message: "No active break found",
      });
    }

    lastBreak.endTime = new Date();

    const duration =
      (lastBreak.endTime - lastBreak.startTime) /
      (1000 * 60);

    lastBreak.duration = duration;

    attendance.totalBreakTime += duration;

    await attendance.save();

    res.json({
      success: true,
      message: "Break ended",
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

    const date = getToday();

    const attendance = await Attendance.findOne({
      userId,
      date,
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

    const now = new Date();

    attendance.checkOutTime = now;

    let totalMinutes =
      (attendance.checkOutTime -
        attendance.checkInTime) /
      (1000 * 60);

    totalMinutes -= attendance.totalBreakTime;

    if (totalMinutes < 0) totalMinutes = 0;

    attendance.totalWorkTime = Number(
      (totalMinutes / 60).toFixed(2)
    );

    if (attendance.totalWorkTime >= 8) {
      attendance.status = "present";
    } else if (attendance.totalWorkTime >= 4) {
      attendance.status = "half-day";
    } else {
      attendance.status = "absent";
    }

    await attendance.save();

    res.json({
      success: true,
      message: "Check-out successful",
      data: attendance,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= ATTENDANCE REPORT =================
exports.getReport = async (req, res) => {
  try {
    const { userId, from, to } = req.query;

    const query = {};

    if (userId) {
      query.userId = userId;
    }

    if (from && to) {
      query.date = {
        $gte: from,
        $lte: to,
      };
    }

    const data = await Attendance.find(query)
      .populate(
        "userId",
        "name email uniqueID department role"
      )
      .sort({ date: -1 });

    res.json({
      success: true,
      count: data.length,
      data,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};