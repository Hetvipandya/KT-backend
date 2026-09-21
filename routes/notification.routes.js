const express = require('express');
const mongoose = require('mongoose');
const authenticate = require('../middleware/authenticate');
const checkCompanyAccess = require('../middleware/companyAccess');
const requirePermission = require('../middleware/requirePermission');
const validateRequest = require('../middleware/validateRequest');
const {
  createReminderConfigSchema,
  notificationQuerySchema,
  reminderQuerySchema,
  alertQuerySchema,
  createAlertSchema,
  summaryQuerySchema,
  registerDeviceTokenSchema,
  sendToRoleSchema,
  validateQuery
} = require('../validators/notification.validators');
const notificationController = require('../controllers/notification.controller');
const Alert = require('../models/Alert');

const router = express.Router();

router.get('/notifications', authenticate, validateQuery(notificationQuerySchema), notificationController.listNotifications);
router.get('/notifications/summary', authenticate, validateQuery(summaryQuerySchema), notificationController.getSummary);
router.put('/notifications/:id/read', authenticate, notificationController.markNotificationRead);
router.post('/notifications/device-token', authenticate, validateRequest(registerDeviceTokenSchema), notificationController.registerDeviceToken);
router.post('/notifications/send-to-role', authenticate, validateRequest(sendToRoleSchema), notificationController.sendNotificationToRole);

// Debug/test endpoint for testing push notifications via Postman
// POST /api/notifications/test-push  { "title": "Hello", "body": "Test message" }
router.post('/notifications/test-push', authenticate, notificationController.testPush);

router.post('/reminders/config', authenticate, validateRequest(createReminderConfigSchema), checkCompanyAccess,
  requirePermission('NotificationConfig', 'manage'), notificationController.createReminderConfig);
router.get('/reminders/config', authenticate, validateQuery(reminderQuerySchema), checkCompanyAccess,
  requirePermission('NotificationConfig', 'view'), notificationController.listReminders);
router.get('/reminders', authenticate, validateQuery(reminderQuerySchema), checkCompanyAccess,
  requirePermission('NotificationConfig', 'view'), notificationController.listReminders);

router.post('/alerts', authenticate, validateRequest(createAlertSchema), checkCompanyAccess,
  requirePermission('NotificationConfig', 'manage'), notificationController.createAlert);
router.get('/alerts', authenticate, validateQuery(alertQuerySchema), checkCompanyAccess,
  requirePermission('NotificationConfig', 'view'), notificationController.listAlerts);

const loadAlertCompany = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Alert not found', errorCode: 'ALERT_NOT_FOUND' });
    }
    const alert = await Alert.findById(req.params.id).select('companyId');
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found', errorCode: 'ALERT_NOT_FOUND' });
    req.company = { _id: alert.companyId };
    next();
  } catch (error) { next(error); }
};

router.put('/alerts/:id/acknowledge', authenticate, loadAlertCompany,
  requirePermission('NotificationConfig', 'manage'), notificationController.acknowledgeAlert);

module.exports = router;
