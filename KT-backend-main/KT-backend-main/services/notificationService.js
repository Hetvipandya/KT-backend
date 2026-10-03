const User = require("../models/User");
const Employee = require("../models/Employee");
const { firebaseApp, initializeFirebase, isFirebaseInitialized, getMessaging } = require("../config/firebase");

/**
 * Helper to resolve the User document for a given identifier (User ID or Employee ID)
 */
const resolveUser = async (userId) => {
  if (!userId) return null;

  // 1. Direct User lookup
  let user = await User.findById(userId);
  if (user) return user;

  // 2. Lookup by Employee ID if not directly a User ID
  const employee = await Employee.findById(userId);
  if (employee && employee.userID) {
    user = await User.findById(employee.userID);
    if (user) return user;
  }

  // 3. Fallback: match by email if employee found
  if (employee && employee.email) {
    user = await User.findOne({ email: employee.email });
    if (user) return user;
  }

  return null;
};

/**
 * Format data dictionary so all values are strings (required by Firebase FCM)
 */
const sanitizeDataPayload = (dataObj) => {
  if (!dataObj || typeof dataObj !== "object") return {};
  const sanitized = {};
  for (const [key, value] of Object.entries(dataObj)) {
    if (value !== undefined && value !== null) {
      sanitized[key] = typeof value === "string" ? value : JSON.stringify(value);
    }
  }
  return sanitized;
};

/**
 * Clean up expired / unregistered tokens from user document
 */
const cleanInvalidTokens = async (userId, invalidTokens) => {
  if (!invalidTokens || invalidTokens.length === 0) return;
  try {
    await User.findByIdAndUpdate(userId, {
      $pull: {
        notificationTokens: { token: { $in: invalidTokens } },
      },
    });
    console.log(`🧹 [FCM] Cleaned up ${invalidTokens.length} invalid token(s) for user: ${userId}`);
  } catch (err) {
    console.error("❌ [FCM] Error cleaning invalid tokens:", err.message);
  }
};

/**
 * Send FCM Push Notification to a single User across all their registered devices
 * @param {string|ObjectId} userId - User ID or Employee ID
 * @param {Object} notification - { title: string, body: string, data?: object }
 */
const sendNotificationToUser = async (userId, notification) => {
  try {
    if (!userId || !notification) {
      console.warn("⚠️ [FCM] sendNotificationToUser called with missing userId or notification payload.");
      return { success: false, message: "Missing required parameters" };
    }

    // Check Firebase initialization
    const firebaseAdmin = initializeFirebase();
    if (!firebaseAdmin || !isFirebaseInitialized()) {
      console.warn("⚠️ [FCM] Firebase is not configured/initialized. Skipping push notification.");
      return { success: false, message: "Firebase not initialized" };
    }

    // Resolve user
    const user = await resolveUser(userId);
    if (!user) {
      console.warn(`⚠️ [FCM] User not found for ID: ${userId}`);
      return { success: false, message: "User not found" };
    }

    // Extract user tokens
    const userTokens = user.notificationTokens || [];
    const validTokens = [
      ...new Set(
        userTokens
          .map((item) => (typeof item === "string" ? item : item?.token))
          .filter((t) => typeof t === "string" && t.trim().length > 0)
      ),
    ];

    if (validTokens.length === 0) {
      console.log(`ℹ️ [FCM] No registered device tokens found for user: ${user.name || user.email} (${user._id})`);
      return { success: false, message: "No registered device tokens for this user" };
    }

    const payloadData = sanitizeDataPayload(notification.data);

    const message = {
      tokens: validTokens,
      notification: {
        title: notification.title || "Notification",
        body: notification.body || "",
      },
      data: payloadData,
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "high_importance_channel",
          priority: "high",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            contentAvailable: true,
          },
        },
      },
    };

    console.log(`🚀 [FCM] Sending push notification to ${validTokens.length} device(s) for user: ${user.name || user.email}`);

    // Multicast send
    const messaging =
      typeof getMessaging === "function"
        ? getMessaging(firebaseAdmin)
        : firebaseAdmin.messaging();
    let response;

    if (typeof messaging.sendEachForMulticast === "function") {
      response = await messaging.sendEachForMulticast(message);
    } else if (typeof messaging.sendMulticast === "function") {
      response = await messaging.sendMulticast(message);
    } else {
      // Fallback to sending individually
      const results = await Promise.allSettled(
        validTokens.map((token) =>
          messaging.send({
            token,
            notification: message.notification,
            data: message.data,
            android: message.android,
            apns: message.apns,
          })
        )
      );
      response = {
        successCount: results.filter((r) => r.status === "fulfilled").length,
        failureCount: results.filter((r) => r.status === "rejected").length,
        responses: results.map((r) => ({
          success: r.status === "fulfilled",
          error: r.status === "rejected" ? r.reason : null,
        })),
      };
    }

    console.log(`✅ [FCM] Delivery Summary for user ${user._id}: ${response.successCount} sent, ${response.failureCount} failed.`);

    // Handle invalid / expired tokens
    if (response.failureCount > 0 && response.responses) {
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code || "";
          const errorMessage = resp.error?.message || "";
          console.warn(`⚠️ [FCM] Token delivery error [${validTokens[idx]}]: ${errorCode} - ${errorMessage}`);

          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/invalid-argument" ||
            errorMessage.includes("not registered")
          ) {
            invalidTokens.push(validTokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await cleanInvalidTokens(user._id, invalidTokens);
      }
    }

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error("❌ [FCM] Error in sendNotificationToUser:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification to multiple users
 * @param {Array<string|ObjectId>} userIds
 * @param {Object} notification
 */
const sendNotificationToUsers = async (userIds, notification) => {
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  try {
    await Promise.allSettled(
      userIds.map((uid) => sendNotificationToUser(uid, notification))
    );
  } catch (err) {
    console.error("❌ [FCM] Error in sendNotificationToUsers:", err.message);
  }
};

/**
 * Send push notification to all active registered users (for announcements)
 * @param {Object} notification
 */
const sendNotificationToAll = async (notification) => {
  try {
    const users = await User.find({
      isActive: true,
      "notificationTokens.0": { $exists: true },
    }).select("_id notificationTokens name");

    for (const user of users) {
      await sendNotificationToUser(user._id, notification);
    }
  } catch (err) {
    console.error("❌ [FCM] Error in sendNotificationToAll:", err.message);
  }
};

module.exports = {
  sendNotificationToUser,
  sendNotificationToUsers,
  sendNotificationToAll,
  resolveUser,
};
