const mongoose = require("mongoose");
const Session = require("../models/Session");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const {
  validateAttendanceGeofence,
  OFFICE_LOCATION,
  isBreakStartActive,
} = require("../utils/geofence");
 
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
      { userId, status: { $in: ["active", "break", "break-start", "break_start", "on_break"] } },
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
      status: { $in: ["active", "break", "break-start", "break_start", "on_break"] },
    }).sort({ createdAt: -1 });

    if (session) {
      session.lastActiveTime = new Date();
      await session.save();

      const user = await User.findById(userId).select("deviceId lastLogin name email role").lean();
      return res.status(200).json({
        success: true,
        active: true,
        autoCheckedOut: false,
        shouldLogout: false,
        session,
        user,
      });
    }

    const lastSession = await Session.findOne({ userId }).sort({ createdAt: -1 });
    const user = await User.findById(userId).select("deviceId lastLogin name email role").lean();
    const isAutoCheckedOut = lastSession?.status === "auto_checkout";

    return res.status(200).json({
      success: true,
      active: false,
      autoCheckedOut: isAutoCheckedOut,
      autoLogout: isAutoCheckedOut || lastSession?.status === "terminated",
      shouldLogout: true,
      session: lastSession || {
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
      query.status = { $in: ["active", "break", "break-start", "break_start", "on_break"] };
    }

    const session = await Session.findOne(query).sort({ createdAt: -1 });
    if (!session) {
      const lastSession = await Session.findOne({ userId }).sort({ createdAt: -1 });
      const isAutoCheckedOut = lastSession?.status === "auto_checkout";
      return res.status(200).json({
        success: true,
        active: false,
        autoCheckedOut: isAutoCheckedOut,
        autoLogout: true,
        shouldLogout: true,
        message: "Active session not found. Please log in again.",
      });
    }

    // Check geofence if coordinates or distance are provided
    if (
      req.body.latitude !== undefined ||
      req.body.lat !== undefined ||
      req.body.location ||
      req.body.distance !== undefined ||
      req.body.distanceFromOffice !== undefined
    ) {
      const geofenceResult = validateAttendanceGeofence(req.body);
      if (
        !geofenceResult.isInside &&
        geofenceResult.distance !== null &&
        geofenceResult.distance > OFFICE_LOCATION.radiusMeters
      ) {
        // Find attendance record
        let attendance = null;
        if (attendanceId) {
          attendance = await Attendance.findById(attendanceId);
        }
        if (!attendance) {
          attendance = await Attendance.findOne({
            userId,
            checkInTime: { $ne: null },
            checkOutTime: null,
          }).sort({ createdAt: -1 });
        }

        const isOnBreak = isBreakStartActive(attendance, session, req.body);

        // If status is break-start / on break, DO NOT auto checkout!
        if (isOnBreak) {
          session.lastActiveTime = new Date();
          if (status) session.status = status;
          await session.save();
          return res.status(200).json({
            success: true,
            isInside: false,
            distance: geofenceResult.distance,
            allowedRadius: OFFICE_LOCATION.radiusMeters,
            isOnBreak: true,
            status: "break-start",
            autoCheckedOut: false,
            message: `Device is outside 70m office radius (${geofenceResult.distance}m away), but status is break-start. Auto-checkout skipped.`,
            session,
          });
        }

        // Active working session outside 70m -> auto checkout
        if (attendance && attendance.checkInTime && !attendance.checkOutTime) {
          session.status = "auto_checkout";
          session.endTime = new Date();
          await session.save();

          attendance.isActiveSession = false;
          attendance.checkOutTime = new Date();
          attendance.checkOutLocation = {
            latitude: geofenceResult.latitude,
            longitude: geofenceResult.longitude,
            distanceFromOffice: geofenceResult.distance,
          };
          const checkIn = new Date(
            attendance.approvedCheckInTime || attendance.checkInTime
          );
          const checkOut = new Date(attendance.checkOutTime);
          let totalMin = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60);
          totalMin -= Math.min(attendance.totalBreakTime || 0, 60);
          const hours = Math.max(0, totalMin / 60);
          attendance.totalWorkTime = Number(hours.toFixed(2));

          if (attendance.totalWorkTime >= 8) attendance.status = "present";
          else if (attendance.totalWorkTime >= 4) attendance.status = "half-day";
          else attendance.status = "absent";

          await attendance.save();

          return res.status(200).json({
            success: true,
            isInside: false,
            autoCheckedOut: true,
            distance: geofenceResult.distance,
            allowedRadius: OFFICE_LOCATION.radiusMeters,
            isOnBreak: false,
            message: `Auto-checkout triggered: Device is outside 70m office radius (${geofenceResult.distance}m away).`,
            session,
          });
        }
      }
    }

    if (status) session.status = status;
    if (attendanceId) session.attendanceId = attendanceId;
    session.lastActiveTime = new Date();

    if (["terminated", "auto_checkout"].includes(status)) {
      session.endTime = new Date();
    }

    await session.save();

    const isAutoCheckedOut = session.status === "auto_checkout";

    return res.status(200).json({
      success: true,
      active: ["active", "break"].includes(session.status),
      autoCheckedOut: isAutoCheckedOut,
      shouldLogout: ["terminated", "auto_checkout"].includes(session.status),
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
      query.status = { $in: ["active", "break", "break-start", "break_start", "on_break"] };
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