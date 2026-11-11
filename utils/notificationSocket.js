const ROOM_PREFIX = 'employee:';
const emittedNotificationIds = new Set();
const emittedNotificationOrder = [];
const MAX_REMEMBERED_NOTIFICATIONS = 10000;

let io;

const employeeRoom = (userId) => `${ROOM_PREFIX}${userId}`;

const setSocketServer = (socketServer) => {
  io = socketServer;
};

const emitNotificationOnce = (notification) => {
  const notificationId = notification?._id?.toString();
  const userId = notification?.userId?.toString();

  if (!notificationId || !userId || emittedNotificationIds.has(notificationId)) return false;
  emittedNotificationIds.add(notificationId);
  emittedNotificationOrder.push(notificationId);

  if (emittedNotificationOrder.length > MAX_REMEMBERED_NOTIFICATIONS) {
    emittedNotificationIds.delete(emittedNotificationOrder.shift());
  }

  try {
    io?.to(employeeRoom(userId)).emit('notification:new', { notificationId });
  } catch (error) {
    console.error('[Socket.IO] Notification emit failed:', error.message);
  }
  return true;
};

module.exports = { employeeRoom, setSocketServer, emitNotificationOnce };
