const mongoose = require("mongoose");
const Session = require("../models/Session");
const User = require("../models/User");

// ================= START SESSION =================
exports.startSession = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required to start a session",
      });
    }

    const { sessionId, attendanceId, deviceInfo, status } = req.body;

    // Terminate any existing active sessions for this user
    await Session.updateMany(
      { userId, status: { $in: ["active", "break"] } },
      { $set: { status: "terminated", endTime: new Date() } }
    );

    const session = await Session.create({
      sessionId: sessionId || undefined,
      userId,
      attendanceId: attendanceId || null,
      deviceInfo: deviceInfo || req.headers["user-agent"] || "",
      status: status || "active",
      startTime: new Date(),
      lastActiveTime: new Date(),
    });

    if (deviceInfo) {
      await User.findByIdAndUpdate(userId, { deviceId: deviceInfo, lastLogin: new Date() });
    }

    return res.status(201).json({
      success: true,
      message: "Session started successfully",
      session,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET ACTIVE / CURRENT SESSION =================
exports.getSession = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || req.query.userId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    let session = await Session.findOne({
      userId,
      status: { $in: ["active", "break"] },
    }).sort({ createdAt: -1 });

    if (session) {
      session.lastActiveTime = new Date();
      await session.save();
    }

    const user = await User.findById(userId).select("deviceId lastLogin name email role").lean();

    return res.status(200).json({
      success: true,
      active: !!session,
      session: session || {
        deviceId: user?.deviceId || null,
        lastLogin: user?.lastLogin || null,
      },
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= UPDATE SESSION STATUS / HEARTBEAT =================
exports.updateSessionStatus = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || req.body.userId;
    const { sessionId, status, attendanceId } = req.body;

    const query = { userId };
    if (sessionId) {
      query.$or = [{ sessionId }, { _id: mongoose.Types.ObjectId.isValid(sessionId) ? sessionId : null }];
    } else {
      query.status = { $in: ["active", "break"] };
    }

    const session = await Session.findOne(query).sort({ createdAt: -1 });
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Active session not found",
      });
    }

    if (status) session.status = status;
    if (attendanceId) session.attendanceId = attendanceId;
    session.lastActiveTime = new Date();

    if (["terminated", "auto_checkout"].includes(status)) {
      session.endTime = new Date();
    }

    await session.save();

    return res.status(200).json({
      success: true,
      message: `Session status updated to ${session.status}`,
      session,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= REMOVE / END SESSION =================
exports.removeSession = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || req.body.userId;
    const sessionId = req.params.id || req.body.sessionId;

    if (userId) {
      await User.findByIdAndUpdate(userId, { deviceId: null, refreshToken: null });
    }

    const query = { userId };
    if (sessionId) {
      query.$or = [{ sessionId }, { _id: mongoose.Types.ObjectId.isValid(sessionId) ? sessionId : null }];
    } else {
      query.status = { $in: ["active", "break"] };
    }

    const session = await Session.findOne(query).sort({ createdAt: -1 });

    if (session) {
      session.status = "terminated";
      session.endTime = new Date();
      await session.save();
    }

    return res.status(200).json({
      success: true,
      message: "Session removed/terminated successfully",
      session,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= LIST ALL USER SESSIONS =================
exports.listUserSessions = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || req.query.userId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const sessions = await Session.find({ userId })
      .populate("attendanceId")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: sessions.length,
      sessions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};