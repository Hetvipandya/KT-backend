const Notification = require("../models/notification");
const Announcement = require("../models/announcement");
const Leave = require("../models/Leave");
const Attendance = require("../models/Attendance");
const AdjustmentRequest = require("../models/AdjustmentRequest");
const User = require("../models/User");

// ===============================
// CREATE NOTIFICATION
// ===============================
exports.createNotification = async (req, res) => {
  try {
    const notification = await Notification.create(req.body);

    return res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// GET ADMIN NOTIFICATIONS (UNIFIED FEED)
// ===============================
exports.getAdminNotifications = async (req, res) => {
  try {
    // 1. Fetch DB notifications
    const dbNotifications = await Notification.find()
      .populate("userId", "name email role uniqueID")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // 2. Fetch pending leave requests
    const pendingLeaves = await Leave.find({
      status: { $in: ["pending", "pending_admin", "pending_hr"] },
    })
      .populate("employeeId", "name email role uniqueID")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // 3. Fetch pending check-in requests
    const pendingCheckIns = await Attendance.find({
      approvalStatus: "pending",
      checkInTime: { $ne: null },
    })
      .populate("userId", "name email role uniqueID")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // 4. Fetch pending adjustment requests
    let pendingAdjustments = [];
    try {
      pendingAdjustments = await AdjustmentRequest.find({
        status: "pending",
      })
        .populate("userId", "name email role uniqueID")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
    } catch (e) {
      console.log("AdjustmentRequest fetch skipped:", e.message);
    }

    // 5. Fetch announcements
    const announcements = await Announcement.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Transform into unified notification items
    const feed = [];

    // Add DB notifications
    dbNotifications.forEach((n) => {
      feed.push({
        _id: n._id,
        id: n._id,
        title: n.title,
        message: n.message,
        type: n.type || "SYSTEM",
        category: n.type === "ANNOUNCEMENT" ? "announcement" : "system",
        isRead: n.isRead || false,
        createdAt: n.createdAt,
        user: n.userId ? { name: n.userId.name, email: n.userId.email } : null,
        link: n.metaData?.link || "/dashboard",
      });
    });

    // Add Pending Leaves
    pendingLeaves.forEach((l) => {
      const applicantName = l.employeeId?.name || "Employee";
      feed.push({
        _id: `leave_${l._id}`,
        id: `leave_${l._id}`,
        rawId: l._id,
        title: "New Leave Application",
        message: `${applicantName} applied for ${l.leaveType} leave (${l.totalDays} day${l.totalDays > 1 ? "s" : ""})`,
        type: "LEAVE_REQUEST",
        category: "request",
        isRead: false,
        createdAt: l.createdAt,
        user: l.employeeId ? { name: l.employeeId.name, email: l.employeeId.email } : null,
        link: "/attendance/leave-request",
      });
    });

    // Add Pending Check-ins
    pendingCheckIns.forEach((c) => {
      const empName = c.userId?.name || "Employee";
      const timeStr = c.checkInTime ? new Date(c.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
      feed.push({
        _id: `checkin_${c._id}`,
        id: `checkin_${c._id}`,
        rawId: c._id,
        title: "Check-In Approval Request",
        message: `${empName} requested check-in approval (${c.date} ${timeStr})`,
        type: "CHECKIN_REQUEST",
        category: "request",
        isRead: false,
        createdAt: c.checkInTime || c.createdAt,
        user: c.userId ? { name: c.userId.name, email: c.userId.email } : null,
        link: "/attendance/check-in-request",
      });
    });

    // Add Pending Adjustments
    pendingAdjustments.forEach((adj) => {
      const empName = adj.userId?.name || "Employee";
      feed.push({
        _id: `adj_${adj._id}`,
        id: `adj_${adj._id}`,
        rawId: adj._id,
        title: "Attendance Adjustment Request",
        message: `${empName} requested attendance adjustment for ${adj.date || "recent date"}`,
        type: "ADJUSTMENT_REQUEST",
        category: "request",
        isRead: false,
        createdAt: adj.createdAt,
        user: adj.userId ? { name: adj.userId.name, email: adj.userId.email } : null,
        link: "/attendance/adjustments",
      });
    });

    // Sort all by date descending
    feed.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    // Calculate unread count
    const unreadCount = feed.filter((item) => !item.isRead).length;

    return res.status(200).json({
      success: true,
      unreadCount,
      totalCount: feed.length,
      data: feed,
      announcements,
    });
  } catch (error) {
    console.error("Get Admin Notifications Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// MARK AS READ
// ===============================
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (id && !id.startsWith("leave_") && !id.startsWith("checkin_") && !id.startsWith("adj_")) {
      await Notification.findByIdAndUpdate(id, {
        isRead: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// MARK ALL AS READ
// ===============================
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ isRead: false }, { isRead: true });

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// DELETE NOTIFICATION
// ===============================
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    if (id && !id.startsWith("leave_") && !id.startsWith("checkin_") && !id.startsWith("adj_")) {
      await Notification.findByIdAndDelete(id);
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// UPDATE ANNOUNCEMENT
// ===============================
exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Announcement updated successfully",
      data: announcement,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// DELETE ANNOUNCEMENT
// ===============================
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findByIdAndDelete(id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Announcement deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// GET USER NOTIFICATIONS
// ===============================
exports.getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;

    const notifications = await Notification.find({
      $or: [{ userId }, { userId: null }],
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// CREATE ANNOUNCEMENT
// ===============================
exports.createAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.create(req.body);

    // also push as system notification
    await Notification.create({
      title: announcement.title,
      message: announcement.message,
      type: "ANNOUNCEMENT",
      userId: null,
    });

    return res.status(201).json({
      success: true,
      message: "Announcement created",
      data: announcement,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===============================
// GET ALL ANNOUNCEMENTS
// ===============================
exports.getAnnouncements = async (req, res) => {
  try {
    const rawData = await Announcement.find({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    const data = rawData.map((item) => {
      const createdDate = item.createdAt ? new Date(item.createdAt) : new Date();
      const istTime = createdDate.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const istDate = createdDate.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      return {
        ...item,
        time: istTime,
        displayTime: istTime,
        formattedTime: istTime,
        formattedDate: istDate,
        createdAtIST: `${istDate}, ${istTime}`,
      };
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};