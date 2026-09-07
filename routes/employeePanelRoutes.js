const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const {
  getEmployeeDashboard,
  getEmployeeAttendanceTimeline,
  startAttendanceSession,
  sessionHeartbeat,
  endAttendanceSession,
  uploadScreenshot,
  getScreenshotSettings,
  updateScreenshotSettings,
  getScreenshotsForAdmin,
  logInactivityAlert,
  respondInactivityAlert,
  getInactivityEventsForAdmin,
  getAssignedProjectsAndTasks,
  submitBatchDailyReport,
  getEmployeeDailyReportHistory,
  getEmployeeTaskManagement,
  updateEmployeeTaskDetails,
  getEmployeeLeaveOverview,
  applyEmployeeLeaveRequest,
  getEmployeeNotifications,
  markNotificationAsRead,
} = require("../controllers/employeePanelController");

// All routes require authentication
router.use(protect);

// 1. Dashboard
router.get("/dashboard", getEmployeeDashboard);

// 2. Attendance & Timeline
router.get("/attendance/timeline", getEmployeeAttendanceTimeline);

// 3. Attendance Session & Heartbeat
router.post("/session/start", startAttendanceSession);
router.post("/session/heartbeat", sessionHeartbeat);
router.post("/session/end", endAttendanceSession);

// 4. Background Screenshot Monitoring
router.post("/monitoring/screenshot", uploadScreenshot);
router.get("/monitoring/settings", authorizeRoles("admin", "hr"), getScreenshotSettings);
router.post("/monitoring/settings", authorizeRoles("admin", "hr"), updateScreenshotSettings);
router.get("/monitoring/admin/screenshots", authorizeRoles("admin", "hr"), getScreenshotsForAdmin);

// 5. Inactivity Alert & Detection
router.post("/inactivity/alert", logInactivityAlert);
router.post("/inactivity/respond", respondInactivityAlert);
router.get("/inactivity/admin/events", authorizeRoles("admin", "hr"), getInactivityEventsForAdmin);

// 6. Daily Report Module
router.get("/daily-report/assigned-meta", getAssignedProjectsAndTasks);
router.post("/daily-report/submit", submitBatchDailyReport);
router.get("/daily-report/history", getEmployeeDailyReportHistory);

// 7. Task Management Module
router.get("/tasks", getEmployeeTaskManagement);
router.put("/tasks/:taskId", updateEmployeeTaskDetails);

// 8. Leave Management Module
router.get("/leaves/overview", getEmployeeLeaveOverview);
router.post("/leaves/apply", applyEmployeeLeaveRequest);

// 9. Notification Center
router.get("/notifications", getEmployeeNotifications);
router.put("/notifications/:id/read", markNotificationAsRead);

module.exports = router;
