const notificationService = require('../services/notification.service');

/**
 * Dispatch an in-app and push notification safely without throwing or blocking main response execution.
 */
const notify = async ({
  userId,
  companyId,
  role,
  title,
  message,
  type = 'SYSTEM',
  channel = 'PUSH',
  meta = {}
}) => {
  try {
    if (role && companyId) {
      await notificationService.createNotificationForRole({
        companyId,
        role,
        type,
        title,
        message,
        channel,
        meta
      });
    } else if (userId) {
      await notificationService.createNotification({
        userId,
        type,
        title,
        message,
        channel,
        companyId,
        meta
      });
    }
  } catch (err) {
    console.error('[Notification Dispatch Error]:', err.message);
  }
};

module.exports = { notify };
