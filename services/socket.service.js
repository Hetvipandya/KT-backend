const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const mongoose = require('mongoose');
const User = require('../models/User');
const Employee = require('../models/Employee');
const { verifyAccessToken } = require('../utils/jwt');
const { employeeRoom, setSocketServer } = require('../utils/notificationSocket');

let redisClients = [];

const getSocketToken = (socket) =>
  socket.handshake.auth?.token ||
  socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

const resolveSocketUser = async (token) => {
  if (!token || typeof token !== 'string') throw new Error('Authentication token is required');

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (_) {
    throw new Error('Authentication token is invalid or expired');
  }

  const identity = decoded.userId || decoded.id || decoded._id || decoded.sub;
  if (!identity) throw new Error('Authentication token has no user identifier');

  let user;
  if (mongoose.Types.ObjectId.isValid(identity)) {
    user = await User.findById(identity);
  }
  if (!user) {
    user = await User.findOne({
      $or: [
        { userId: identity },
        { uniqueID: identity },
        { email: typeof identity === 'string' ? identity.toLowerCase() : identity },
      ],
    });
  }

  if (!user) {
    const employee = await Employee.findOne({
      $or: [
        ...(mongoose.Types.ObjectId.isValid(identity) ? [{ _id: identity }] : []),
        { employeeID: identity },
        { employeeCode: typeof identity === 'string' ? identity.toUpperCase() : identity },
        ...(mongoose.Types.ObjectId.isValid(identity) ? [{ userID: identity }, { userId: identity }] : []),
      ],
    }).select('userID userId email');

    if (employee) {
      const linkedUserId = employee.userID || employee.userId;
      if (linkedUserId && mongoose.Types.ObjectId.isValid(linkedUserId)) {
        user = await User.findById(linkedUserId);
      }
      if (!user && employee.email) {
        user = await User.findOne({ email: employee.email.toLowerCase() });
      }
    }
  }

  if (!user || user.isLocked || user.isDeactivated === true ||
      (user.isActive === false && String(user.status || '').toLowerCase() === 'inactive')) {
    throw new Error('Authentication failed: User is unavailable');
  }

  if (user.role === 'employee' || user.role === 'team lead') {
    const employee = await Employee.findOne({
      $or: [
        { userID: user._id },
        { userId: user._id },
        { email: user.email ? String(user.email).trim().toLowerCase() : null },
      ].filter(Boolean),
    }).select('employeeStatus status isDeactivated');

    if (employee && (
      employee.isDeactivated ||
      (String(employee.employeeStatus || '').toLowerCase() === 'inactive' &&
        String(employee.status || '').toLowerCase() === 'inactive')
    )) {
      throw new Error('Authentication failed: User is unavailable');
    }
  }

  return user;
};

const authenticateSocket = async (socket, next) => {
  try {
    const user = await resolveSocketUser(getSocketToken(socket));
    socket.data.userId = user._id.toString();
    return next();
  } catch (error) {
    const authError = new Error(error.message || 'Authentication failed');
    authError.data = { code: 'UNAUTHORIZED' };
    return next(authError);
  }
};

const initializeSocketServer = (httpServer, options = {}) => {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    ...options,
  });

  io.use(authenticateSocket);
  io.on('connection', (socket) => {
    socket.join(employeeRoom(socket.data.userId));
  });

  setSocketServer(io);
  return io;
};

const initializeSocketAdapter = async (
  io,
  {
    redisUrl = process.env.REDIS_URL,
    required = process.env.SOCKET_REDIS_REQUIRED === 'true',
  } = {}
) => {
  if (!redisUrl) {
    if (required) {
      throw new Error('REDIS_URL is required when SOCKET_REDIS_REQUIRED=true');
    }
    console.warn('[Socket.IO] Redis adapter is not configured; events are local to this instance.');
    return false;
  }

  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();
  const onRedisError = (error) => console.error('[Socket.IO] Redis client error:', error);
  pubClient.on('error', onRedisError);
  subClient.on('error', onRedisError);

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    redisClients = [pubClient, subClient];
    return true;
  } catch (error) {
    await Promise.allSettled([
      pubClient.isOpen ? pubClient.quit() : Promise.resolve(),
      subClient.isOpen ? subClient.quit() : Promise.resolve(),
    ]);
    throw error;
  }
};

const closeSocketAdapter = async () => {
  const clients = redisClients;
  redisClients = [];
  await Promise.all(clients.map((client) => client.quit()));
};

module.exports = {
  initializeSocketServer,
  initializeSocketAdapter,
  closeSocketAdapter,
  authenticateSocket,
  resolveSocketUser,
};
