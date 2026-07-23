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