const Attendance = require("../models/Attendance");

// Helper: get today's date string
const getToday = () => new Date().toISOString().split("T")[0];

const OFFICE_START_TIME = "10:00"; // configurable

// ================= CHECK IN =================
exports.checkIn = async (req, res) => {
  try {
    const { userId, userType } = req.body;

    const date = getToday();

    const existing =
      await Attendance.findOne({
        userId,
        date,
      });

    if (existing) {
      return res.status(400).json({
        success: false,
        message:
          "Already checked in today",
      });
    }

    const now = new Date();

    // Office timing = 10:10 AM
    const officeTime =
      new Date();

    officeTime.setHours(
      10, // hour
      10, // minute
      0,
      0
    );

    // 10:11 pachi late
    const isLate =
      now.getTime() >
      officeTime.getTime();

    const attendance =
      await Attendance.create({
        userId,
        userType,
        date,
        checkInTime: now,
        isLate,
        status: isLate
          ? "late-coming"
          : "present",
      });

    res.json({
      success: true,
      message:
        "Check-in successful",
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

    const attendance = await Attendance.findOne({ userId, date });

    if (!attendance) {
      return res.status(404).json({ message: "Check-in not found" });
    }

    attendance.breaks.push({
      startTime: new Date(),
    });

    await attendance.save();

    res.json({ success: true, message: "Break started" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= BREAK END =================
exports.endBreak = async (req, res) => {
  try {
    const { userId } = req.body;
    const date = getToday();

    const attendance = await Attendance.findOne({ userId, date });

    const lastBreak = attendance.breaks[attendance.breaks.length - 1];

    if (!lastBreak || lastBreak.endTime) {
      return res.status(400).json({ message: "No active break" });
    }

    lastBreak.endTime = new Date();

    const duration =
      (lastBreak.endTime - lastBreak.startTime) / 60000;

    lastBreak.duration = duration;

    attendance.totalBreakTime += duration;

    await attendance.save();

    res.json({ success: true, message: "Break ended" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= CHECK OUT =================
exports.checkOut = async (req, res) => {
  try {
    const { userId } = req.body;
    const date = getToday();

    const attendance = await Attendance.findOne({ userId, date });

    if (!attendance) {
      return res.status(404).json({ message: "Attendance not found" });
    }

    const now = new Date();

    attendance.checkOutTime = now;

    const totalWork =
      (attendance.checkOutTime - attendance.checkInTime) / 60000 -
      attendance.totalBreakTime;

    attendance.totalWorkTime = totalWork;
    attendance.status = "completed";

    await attendance.save();

    res.json({
      success: true,
      message: "Check-out successful",
      data: attendance,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= REPORT =================
exports.getReport = async (req, res) => {
  try {
    const { userId, from, to } = req.query;

    const query = { userId };

    if (from && to) {
      query.date = { $gte: from, $lte: to };
    }

    const data = await Attendance.find(query).sort({ date: -1 });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};