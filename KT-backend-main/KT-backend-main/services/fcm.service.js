const { getMessaging } = require('../config/firebase');

/**
 * Send a push notification to a single device via Firebase Cloud Messaging.
 *
 * @param {object} params
 * @param {string}  params.deviceToken  - FCM registration token stored on the User document
 * @param {string}  params.title        - Notification title
 * @param {string}  params.body         - Notification body text
 * @param {object}  [params.data]       - Optional key-value payload delivered to the app
 * @param {string}  [params.imageUrl]   - Optional image URL shown in the notification
 *
 * @returns {Promise<{ sent: boolean; messageId?: string; reason?: string }>}
 */
const sendPushNotification = async ({ deviceToken, title, body, data = {}, imageUrl }) => {
  const messaging = getMessaging();

  if (!messaging) {
    // FCM not configured – log in dev, silently skip in production
    if (process.env.NODE_ENV !== 'production') {
      console.log('[FCM disabled] push skipped –', { deviceToken, title, body });
    }
    return { sent: false, reason: 'FCM_NOT_CONFIGURED' };
  }

  if (!deviceToken) {
    return { sent: false, reason: 'NO_DEVICE_TOKEN' };
  }

  const message = {
    token: deviceToken,
    notification: {
      title,
      body,
      ...(imageUrl && { imageUrl })
    },
    // data values must all be strings
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1
        }
      }
    }
  };

  try {
    const messageId = await messaging.send(message);
    return { sent: true, messageId };
  } catch (err) {
    // Log but never crash the caller – a push failure must not break the API
    console.error('[FCM] send error:', err.code || err.message);
    return { sent: false, reason: err.code || err.message };
  }
};

/**
 * Send the same notification to multiple device tokens in one batch call.
 * Returns a summary of successes and failures.
 *
 * @param {string[]} deviceTokens
 * @param {string}   title
 * @param {string}   body
 * @param {object}   [data]
 *
 * @returns {Promise<{ successCount: number; failureCount: number; responses: object[] }>}
 */
const sendMulticastPushNotification = async (deviceTokens, title, body, data = {}) => {
  const messaging = getMessaging();

  if (!messaging || !deviceTokens.length) {
    return { successCount: 0, failureCount: deviceTokens.length, responses: [] };
  }

  const message = {
    tokens: deviceTokens,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: { priority: 'high' }
  };

  try {
    const batchResponse = await messaging.sendEachForMulticast(message);
    return {
      successCount: batchResponse.successCount,
      failureCount: batchResponse.failureCount,
      responses: batchResponse.responses
    };
  } catch (err) {
    console.error('[FCM] multicast error:', err.code || err.message);
    return { successCount: 0, failureCount: deviceTokens.length, responses: [] };
  }
};

module.exports = {
  sendPushNotification,
  sendMulticastPushNotification
};
