const { Server } = require('socket.io');
const mongoose = require('mongoose');
const User = require('../models/User');
const Employee = require('../models/Employee');
const { verifyAccessToken } = require('../utils/jwt');
const { employeeRoom, setSocketServer } = require('../utils/notificationSocket');

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

module.exports = { initializeSocketServer, authenticateSocket, resolveSocketUser };
