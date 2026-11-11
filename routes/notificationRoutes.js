const express = require("express");
const router = express.Router();

const notificationController = require("../controllers/notificarionController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

// ===============================
// FCM DEVICE TOKEN ROUTES
// ===============================
router.post("/register-token", protect, notificationController.registerDeviceToken);
router.post("/remove-token", protect, notificationController.removeDeviceToken);

// ===============================
// NOTIFICATION ROUTES 
// ===============================
router.post("/create", protect, notificationController.createNotification);

// Admin Unified Notifications
router.get("/admin/all", protect, authorizeRoles("admin", "hr"), notificationController.getAdminNotifications);
router.put("/read-all", protect, notificationController.markAllAsRead);

router.get("/user/:userId", protect, notificationController.getUserNotifications);
router.put("/read/:id", protect, notificationController.markAsRead);
router.delete("/delete-all", protect, notificationController.deleteAllNotifications);
router.delete("/user/:userId/delete-all", protect, notificationController.deleteAllNotifications);
router.delete("/:id", protect, notificationController.deleteNotification);

// ===============================
// ANNOUNCEMENT ROUTES
// ===============================
router.get(
  "/announcement/recipients",
  protect,
  authorizeRoles("admin", "hr"),
  notificationController.getAnnouncementRecipients
);
router.post("/announcement/create", protect, authorizeRoles("admin", "hr"), notificationController.createAnnouncement);
router.put("/announcement/:id", protect, authorizeRoles("admin", "hr"), notificationController.updateAnnouncement);
router.delete("/announcement/:id", protect, authorizeRoles("admin", "hr"), notificationController.deleteAnnouncement);

router.get("/announcement/all", protect, notificationController.getAnnouncements);

module.exports = router;