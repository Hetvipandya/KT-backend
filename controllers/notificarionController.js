const Notification = require("../models/notification");
const Announcement = require("../models/announcement");


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
// MARK AS READ
// ===============================
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    await Notification.findByIdAndUpdate(id, {
      isRead: true,
    });

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
    const data = await Announcement.find({ isActive: true }).sort({
      createdAt: -1,
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