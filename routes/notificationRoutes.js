const express = require("express");
const router = express.Router();

const notificationController = require("../controllers/notificarionController");

// ===============================
// NOTIFICATION ROUTES
// ===============================
router.post("/create", notificationController.createNotification);

router.get("/user/:userId", notificationController.getUserNotifications);

router.put("/read/:id", notificationController.markAsRead);

// ===============================
// ANNOUNCEMENT ROUTES
// ===============================
router.post("/announcement/create", notificationController.createAnnouncement);

router.get("/announcement/all", notificationController.getAnnouncements);

module.exports = router;