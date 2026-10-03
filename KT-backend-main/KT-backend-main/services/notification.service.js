const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/notification');
const ReminderConfig = require('../models/ReminderConfig');
const Alert = require('../models/Alert');
const { sendPushNotification } = require('./fcm.service');

const serviceError = (message, statusCode, errorCode) => Object.assign(new Error(message), { statusCode, errorCode });
const id = (value) => value?.toString();

const listNotifications = async (userId, filters = {}) => {
  const query = { userId };
  if (filters.read !== undefined) query.read = filters.read;
  if (filters.type) query.type = filters.type;
  if (filters.category) query.type = new RegExp(filters.category, 'i');
  if (filters.excludeAlerts) {
    query.type = { $not: /ALERT/i };
  }
  if (filters.from || filters.to) {
    query.createdAt = {};
    if (filters.from) query.createdAt.$gte = new Date(filters.from);
    if (filters.to) query.createdAt.$lte = new Date(filters.to);
  }

  const [total, unreadCount, notifications] = await Promise.all([
    Notification.countDocuments({ userId }),
    Notification.countDocuments({ userId, read: false }),
    Notification.find(query).sort({ createdAt: -1 }).lean()
  ]);

  const items = notifications.map((notification) => ({
    id: id(notification._id),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    companyId: notification.companyId ? id(notification.companyId) : null,
    read: notification.read,
    channel: notification.channel,
    meta: notification.meta || {},
    createdAt: notification.createdAt,
    readAt: notification.readAt || null
  }));

  return {
    unreadCount,
    total,
    items
  };
};

const markNotificationRead = async (notificationId, userId) => {
  if (!mongoose.isValidObjectId(notificationId)) {
    throw serviceError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
  }
  const notification = await Notification.findOne({ _id: notificationId, userId });
  if (!notification) throw serviceError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');

  if (!notification.read) {
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();
  }
  return { id: id(notification._id), read: notification.read, readAt: notification.readAt };
};

const createReminderConfig = async (data, userId) => {
  const config = await ReminderConfig.create({ ...data, createdBy: userId, updatedBy: userId });
  return {
    id: id(config._id),
    companyId: id(config.companyId),
    type: config.type,
    daysBefore: config.daysBefore,
    enabled: config.enabled,
    channels: config.channels,
    config: config.config || {},
    createdAt: config.createdAt,
    updatedAt: config.updatedAt
  };
};

const listReminders = async (companyId, filters = {}) => {
  const query = { companyId };
  if (filters.type) query.type = filters.type;
  if (filters.enabled !== undefined) query.enabled = filters.enabled;
  if (filters.from || filters.to) {
    query.createdAt = {};
    if (filters.from) query.createdAt.$gte = new Date(filters.from);
    if (filters.to) query.createdAt.$lte = new Date(filters.to);
  }

  const configs = await ReminderConfig.find(query).sort({ createdAt: -1 }).lean();
  return configs.map((config) => ({
    id: id(config._id),
    type: config.type,
    daysBefore: config.daysBefore,
    enabled: config.enabled,
    channels: config.channels,
    nextRunAt: null,
    config: config.config || {}
  }));
};

const createAlert = async ({ companyId, type, title, message, severity = 'INFO', meta = {} }) => {
  const alert = await Alert.create({
    companyId,
    type,
    title,
    message,
    severity,
    meta,
    isActive: true,
    acknowledged: false
  });
  return {
    id: id(alert._id),
    companyId: id(alert.companyId),
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    meta: alert.meta || {},
    acknowledged: alert.acknowledged,
    createdAt: alert.createdAt
  };
};

const listActiveAlerts = async (companyId, filters = {}) => {
  const query = { companyId, isActive: true, acknowledged: filters.acknowledged ?? false };
  if (filters.type) query.type = filters.type;
  if (filters.severity) query.severity = filters.severity;

  const alerts = await Alert.find(query).sort({ createdAt: -1 }).lean();
  const severityRank = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]).map((alert) => ({
    id: id(alert._id),
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    meta: alert.meta || {},
    acknowledged: alert.acknowledged,
    acknowledgedBy: alert.acknowledgedBy ? id(alert.acknowledgedBy) : null,
    acknowledgedAt: alert.acknowledgedAt || null,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt
  }));
};

const getAlert = async (alertId) => {
  if (!mongoose.isValidObjectId(alertId)) throw serviceError('Alert not found', 404, 'ALERT_NOT_FOUND');
  const alert = await Alert.findById(alertId).lean();
  if (!alert) throw serviceError('Alert not found', 404, 'ALERT_NOT_FOUND');
  return alert;
};

const acknowledgeAlert = async (alertId, userId) => {
  if (!mongoose.isValidObjectId(alertId)) throw serviceError('Alert not found', 404, 'ALERT_NOT_FOUND');
  const alert = await Alert.findById(alertId);
  if (!alert) throw serviceError('Alert not found', 404, 'ALERT_NOT_FOUND');
  if (!alert.acknowledged) {
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;
    await alert.save();
  }
  return { id: id(alert._id), acknowledged: alert.acknowledged, acknowledgedBy: id(alert.acknowledgedBy), acknowledgedAt: alert.acknowledgedAt };
};

const getNotificationSummary = async (userId, companyId) => {
  const unreadFeed = await Notification.countDocuments({ userId, read: false });

  let activeAlerts = 0;
  let activeReminders = 0;

  if (companyId && mongoose.isValidObjectId(companyId)) {
    activeAlerts = await Alert.countDocuments({ companyId, isActive: true, acknowledged: false });
    activeReminders = await ReminderConfig.countDocuments({ companyId, enabled: true });
  }

  return {
    unreadFeed,
    activeAlerts,
    activeReminders
  };
};

const createNotification = async ({
  userId,
  type,
  title,
  message,
  channel = 'PUSH',
  companyId,
  meta = {}
}) => {
  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    channel,
    ...(companyId && { companyId }),
    meta,
    read: false
  });

  try {
    const user = await User.findById(userId).select('deviceToken').lean();
    if (user?.deviceToken) {
      await sendPushNotification({
        deviceToken: user.deviceToken,
        title,
        body: message,
        data: { notificationId: id(notification._id), type, ...meta }
      });
    }
  } catch (pushErr) {
    console.error('[FCM] push failed for userId', id(userId), pushErr.message);
  }

  return {
    id: id(notification._id),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    companyId: notification.companyId ? id(notification.companyId) : null,
    read: notification.read,
    channel: notification.channel,
    meta: notification.meta || {},
    createdAt: notification.createdAt,
    readAt: null
  };
};

const createNotificationForRole = async ({
  companyId,
  role,
  type,
  title,
  message,
  channel = 'PUSH',
  meta = {}
}) => {
  if (!role) throw serviceError('Role is required', 400, 'ROLE_REQUIRED');

  const roleRegex = new RegExp(`^${role.trim()}$`, 'i');

  const userQuery = {
    $or: [
      { role: roleRegex },
      {
        companyAccess: {
          $elemMatch: {
            ...(companyId && { companyId: new mongoose.Types.ObjectId(companyId) }),
            role: roleRegex,
            isActive: true
          }
        }
      }
    ]
  };

  if (companyId && mongoose.isValidObjectId(companyId)) {
    userQuery.$or.push({ companyId: new mongoose.Types.ObjectId(companyId), role: roleRegex });
  }

  const users = await User.find(userQuery).select('_id name email deviceToken').lean();

  if (!users.length) {
    return { count: 0, notifications: [] };
  }

  const notifications = [];
  const deviceTokens = [];

  for (const user of users) {
    const notif = await Notification.create({
      userId: user._id,
      type,
      title,
      message,
      channel,
      ...(companyId && { companyId }),
      meta,
      read: false
    });

    notifications.push({
      id: id(notif._id),
      userId: id(user._id),
      userName: user.name,
      userEmail: user.email,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      channel: notif.channel,
      meta: notif.meta || {},
      createdAt: notif.createdAt
    });

    if (user.deviceToken) {
      deviceTokens.push(user.deviceToken);
    }
  }

  if (deviceTokens.length > 0) {
    try {
      const { sendMulticastPushNotification } = require('./fcm.service');
      await sendMulticastPushNotification(deviceTokens, title, message, { type, ...meta });
    } catch (pushErr) {
      console.error('[FCM] Role multicast push error:', pushErr.message);
    }
  }

  return { count: notifications.length, notifications };
};

const registerDeviceToken = async (userId, deviceToken) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw serviceError('User not found', 404, 'USER_NOT_FOUND');
  }
  const user = await User.findById(userId);
  if (!user) throw serviceError('User not found', 404, 'USER_NOT_FOUND');

  user.deviceToken = deviceToken;
  await user.save();

  return { userId: id(user._id), deviceToken: user.deviceToken };
};

module.exports = {
  listNotifications,
  markNotificationRead,
  createReminderConfig,
  listReminders,
  createAlert,
  listActiveAlerts,
  getAlert,
  acknowledgeAlert,
  getNotificationSummary,
  createNotification,
  createNotificationForRole,
  registerDeviceToken
};
