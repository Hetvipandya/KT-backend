const notificationService = require('../services/notification.service');
const { sendPushNotification } = require('../services/fcm.service');

const listNotifications = async (req, res, next) => {
  try {
    const { userId, ...filters } = req.query;
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only view your own notifications', errorCode: 'FORBIDDEN' });
    }
    const result = await notificationService.listNotifications(userId, filters);
    return res.status(200).json({
      success: true,
      data: {
        userId,
        unreadCount: result.unreadCount,
        total: result.total,
        items: result.items
      }
    });
  } catch (error) { next(error); }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const data = await notificationService.markNotificationRead(req.params.id, req.user._id);
    return res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

const createReminderConfig = async (req, res, next) => {
  try {
    const data = await notificationService.createReminderConfig(req.body, req.user._id);
    return res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
};

const listReminders = async (req, res, next) => {
  try {
    const { companyId, ...filters } = req.query;
    const items = await notificationService.listReminders(companyId, filters);
    return res.status(200).json({ success: true, data: { companyId, items } });
  } catch (error) { next(error); }
};

const createAlert = async (req, res, next) => {
  try {
    const data = await notificationService.createAlert(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
};

const listAlerts = async (req, res, next) => {
  try {
    const { companyId, ...filters } = req.query;
    const items = await notificationService.listActiveAlerts(companyId, filters);
    return res.status(200).json({ success: true, data: { companyId, items } });
  } catch (error) { next(error); }
};

const acknowledgeAlert = async (req, res, next) => {
  try {
    const data = await notificationService.acknowledgeAlert(req.params.id, req.user._id);
    return res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

const getSummary = async (req, res, next) => {
  try {
    const { userId, companyId } = req.query;
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only view your own notification summary', errorCode: 'FORBIDDEN' });
    }
    const data = await notificationService.getNotificationSummary(userId, companyId);
    return res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

const registerDeviceToken = async (req, res, next) => {
  try {
    const { userId, deviceToken } = req.body;

    if (req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only register/update device token for your own account',
        errorCode: 'FORBIDDEN'
      });
    }

    const data = await notificationService.registerDeviceToken(userId, deviceToken);
    return res.status(200).json({
      success: true,
      message: 'Device token registered successfully',
      data
    });
  } catch (error) { next(error); }
};

/**
 * Debug endpoint (non-production only).
 * Sends a test push notification to the authenticated user's registered device.
 * POST /notifications/test-push  { "title": "...", "body": "..." }
 */
const testPush = async (req, res, next) => {
  try {
    const { title = 'Test Notification', body = 'FCM is working!' } = req.body;
    const User = require('../models/User');
    const user = await User.findById(req.user._id).select('deviceToken').lean();

    if (!user?.deviceToken) {
      return res.status(400).json({
        success: false,
        message: 'No device token registered for this user. Call POST /notifications/device-token first.',
        errorCode: 'NO_DEVICE_TOKEN'
      });
    }

    const result = await sendPushNotification({ deviceToken: user.deviceToken, title, body });
    return res.status(200).json({ success: true, data: result });
  } catch (error) { next(error); }
};

const sendNotificationToRole = async (req, res, next) => {
  try {
    const { companyId, role, type, title, message, channel, meta } = req.body;
    const result = await notificationService.createNotificationForRole({
      companyId: companyId || req.companyId || req.user.companyId,
      role,
      type,
      title,
      message,
      channel,
      meta
    });
    return res.status(201).json({
      success: true,
      message: `Notification broadcasted to ${result.count} users with role '${role}'`,
      data: result
    });
  } catch (error) { next(error); }
};

module.exports = {
  listNotifications,
  markNotificationRead,
  createReminderConfig,
  listReminders,
  createAlert,
  listAlerts,
  acknowledgeAlert,
  getSummary,
  registerDeviceToken,
  sendNotificationToRole,
  testPush
};
