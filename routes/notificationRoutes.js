const express = require("express");
const router = express.Router();

const notificationController = require("../controllers/notificarionController");

// ===============================
// NOTIFICATION ROUTES
// ===============================
router.post("/create", notificationController.createNotification);

// Admin Unified Notifications
router.get("/admin/all", notificationController.getAdminNotifications);
router.put("/read-all", notificationController.markAllAsRead);

router.get("/user/:userId", notificationController.getUserNotifications);
router.put("/read/:id", notificationController.markAsRead);
router.delete("/:id", notificationController.deleteNotification);

// ===============================
// ANNOUNCEMENT ROUTES
// ===============================
router.post("/announcement/create", notificationController.createAnnouncement);
router.put("/announcement/:id", notificationController.updateAnnouncement);
router.delete("/announcement/:id", notificationController.deleteAnnouncement);

router.get("/announcement/all", notificationController.getAnnouncements);

module.exports = router;