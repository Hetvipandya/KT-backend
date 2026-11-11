const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Notification = require('../models/notification');
const { employeeRoom, setSocketServer, emitNotificationOnce } = require('../utils/notificationSocket');
const { authenticateSocket } = require('../services/socket.service');
const env = require('../config/env');
const { getUserNotifications } = require('../controllers/notificarionController');
const {
  getEmployeeNotifications,
  markNotificationAsRead,
} = require('../controllers/employeePanelController');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(async () => {
  await Notification.deleteMany({});
  await User.deleteMany({});
  setSocketServer(null);
});

test('socket auth derives canonical User ID from JWT and joins only its private employee room', async () => {
  const user = await User.create({ name: 'Socket User', email: 'socket@example.com', password: 'password' });
  const token = jwt.sign({ userId: user._id.toString() }, env.JWT_ACCESS_SECRET);
  const socket = {
    handshake: { auth: { token }, headers: {} },
    data: {},
  };
  const next = jest.fn();

  await authenticateSocket(socket, next);

  expect(next).toHaveBeenCalledWith();
  expect(socket.data.userId).toBe(user._id.toString());
  expect(employeeRoom(socket.data.userId)).toBe(`employee:${user._id}`);
  expect(socket.handshake.auth.room).toBeUndefined();
});

test('notification save emits once after persistence with the minimal payload to its user room', async () => {
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  setSocketServer({ to });
  const userId = new mongoose.Types.ObjectId();
  const notification = await Notification.create({
    userId,
    title: 'Saved',
    message: 'Persisted first',
  });

  expect(await Notification.findById(notification._id)).not.toBeNull();
  expect(to).toHaveBeenCalledWith(employeeRoom(userId));
  expect(emit).toHaveBeenCalledTimes(1);
  expect(emit).toHaveBeenCalledWith('notification:new', {
    notificationId: notification._id.toString(),
  });
  expect(emitNotificationOnce(notification)).toBe(false);
  expect(emit).toHaveBeenCalledTimes(1);
});

test('notification saves without a recipient or socket remain successful', async () => {
  setSocketServer({
    to() {
      throw new Error('socket unavailable');
    },
  });

  await expect(Notification.create({
    title: 'Broadcast',
    message: 'No individual owner',
  })).resolves.toMatchObject({ userId: null });
});

test('socket delivery failure does not interrupt the existing FCM delivery', async () => {
  const fcmService = require('../services/fcm.service');
  const sendPushNotification = jest.spyOn(fcmService, 'sendPushNotification').mockResolvedValue({ success: true });
  const { createNotification } = require('../services/notification.service');
  const userId = new mongoose.Types.ObjectId();
  jest.spyOn(User, 'findById').mockReturnValue({
    select: () => ({ lean: async () => ({ deviceToken: 'existing-fcm-token' }) }),
  });
  setSocketServer({
    to() {
      throw new Error('socket unavailable');
    },
  });

  const saved = await createNotification({
    userId,
    type: 'SYSTEM',
    title: 'Independent delivery',
    message: 'FCM still runs',
    meta: { source: 'test' },
  });

  expect(sendPushNotification).toHaveBeenCalledWith({
    deviceToken: 'existing-fcm-token',
    title: 'Independent delivery',
    body: 'FCM still runs',
    data: { notificationId: saved.id, type: 'SYSTEM', source: 'test' },
  });
});

test('user notification list rejects a client-selected different user ID', async () => {
  const res = {
    statusCode: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const user = { _id: new mongoose.Types.ObjectId() };

  await getUserNotifications({
    user,
    params: { userId: new mongoose.Types.ObjectId().toString() },
  }, res);

  expect(res.statusCode).toBe(403);
  expect(res.body.success).toBe(false);
});

test('employee notification list scopes records to the user and filters role-targeted broadcasts', async () => {
  const user = { _id: new mongoose.Types.ObjectId(), role: 'employee' };
  const ownNotification = { _id: 'own', userId: user._id, type: 'LEAVE', isRead: false };
  const employeeAnnouncement = {
    _id: 'employee-announcement',
    userId: null,
    type: 'ANNOUNCEMENT',
    meta: { targetRole: 'employee' },
    isRead: false,
  };
  const adminAnnouncement = {
    _id: 'admin-announcement',
    userId: null,
    type: 'ANNOUNCEMENT',
    meta: { targetRole: 'admin' },
    isRead: false,
  };
  const systemNotification = { _id: 'system', userId: null, type: 'SYSTEM', isRead: false };
  const find = jest.spyOn(Notification, 'find').mockReturnValue({
    sort: async () => [ownNotification, employeeAnnouncement, adminAnnouncement, systemNotification],
  });
  const res = {
    statusCode: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await getEmployeeNotifications({ user }, res);

  expect(find).toHaveBeenCalledWith({ $or: [{ userId: user._id }, { userId: null }] });
  expect(res.body.data.map((notification) => notification._id)).toEqual([
    'own',
    'employee-announcement',
    'system',
  ]);
  expect(res.body.unreadCount).toBe(3);
});

test('employee mark-as-read updates only the authenticated user-owned record', async () => {
  const user = { _id: new mongoose.Types.ObjectId(), role: 'employee' };
  const findOneAndUpdate = jest.spyOn(Notification, 'findOneAndUpdate').mockResolvedValue(null);
  const res = {
    statusCode: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await markNotificationAsRead({ user, params: { id: 'foreign-notification' } }, res);

  expect(findOneAndUpdate).toHaveBeenCalledWith(
    { _id: 'foreign-notification', userId: user._id },
    { $set: { read: true, isRead: true, readAt: expect.any(Date) } },
  );
  expect(res.statusCode).toBe(200);
});
