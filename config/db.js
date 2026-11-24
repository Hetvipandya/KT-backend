const mongoose = require('mongoose');
const pino = require('pino');
const dns = require('dns');

// Optional: only override DNS if explicitly requested in environment
if (process.env.USE_CUSTOM_DNS === 'true') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (_) {}
}

const isDev = (process.env.NODE_ENV || 'development') === 'development';
const logger = pino({
  transport: isDev ? { target: 'pino-pretty' } : undefined
});

let connectionPromise = null;

const getPoolSize = (name, fallback, allowZero = false) => {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue.trim() === '') {
    return fallback;
  }

  if (!/^\d+$/.test(rawValue.trim())) {
    throw new Error(`${name} must be a ${allowZero ? 'non-negative' : 'positive'} integer`);
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || (!allowZero && value === 0)) {
    throw new Error(`${name} must be a ${allowZero ? 'non-negative' : 'positive'} integer`);
  }

  return value;
};

const connectDB = async (customUri = null) => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = customUri || process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    logger.error('❌ MONGODB_URI or MONGO_URI is missing!');
    throw new Error('Database URI missing');
  }

  connectionPromise = (async () => {
    try {
      const maxPoolSize = getPoolSize('MONGO_MAX_POOL_SIZE', 50);
      const minPoolSize = getPoolSize('MONGO_MIN_POOL_SIZE', 0, true);
      const waitQueueTimeoutMS = getPoolSize('MONGO_WAIT_QUEUE_TIMEOUT_MS', 10000, true);

      if (minPoolSize > maxPoolSize) {
        throw new Error('MONGO_MIN_POOL_SIZE cannot be greater than MONGO_MAX_POOL_SIZE');
      }

      const conn = await mongoose.connect(uri, {
        maxPoolSize,
        minPoolSize,
        maxConnecting: 2,
        waitQueueTimeoutMS,
      });

      if (process.env.RUN_STARTUP_MAINTENANCE !== 'false') {
        // Run index migrations on one designated instance when scaling out.
        const User = require('../models/User');
        let userIndexes = [];
        try {
          userIndexes = await User.collection.indexes();
        } catch (error) {
          if (error.code !== 26 && error.codeName !== 'NamespaceNotFound') {
            throw error;
          }

          logger.info('User collection does not exist yet; initializing indexes.');
        }

        for (const obsoleteIndex of ['phoneNumber_1', 'phone_1', 'uniqueID_1']) {
          if (userIndexes.some((index) => index.name === obsoleteIndex)) {
            await User.collection.dropIndex(obsoleteIndex);
            logger.info(`Removed obsolete User index: ${obsoleteIndex}`);
          }
        }
        await User.createIndexes();
        const Employee = require('../models/Employee');
        const TaskManagement = require('../models/taskModel');
        const Leave = require('../models/Leave');
        const Contact = require('../models/Contact');
        const JournalEntry = require('../models/JournalEntry');
        const Expense = require('../models/Expense');
        const Payment = require('../models/Payment');
        const SupplierPayment = require('../models/SupplierPayment');
        const Salary = require('../models/Salary');
        const Invoice = require('../models/Invoice');
        const Purchase = require('../models/Purchase');
        await Promise.all([
          Employee.createIndexes(),
          TaskManagement.createIndexes(),
          Leave.createIndexes(),
          Contact.createIndexes(),
          JournalEntry.createIndexes(),
          Expense.createIndexes(),
          Payment.createIndexes(),
          SupplierPayment.createIndexes(),
          Salary.createIndexes(),
          Invoice.createIndexes(),
          Purchase.createIndexes()
        ]);
      }

      logger.info(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (error) {
      logger.error(`❌ MongoDB Connection Error: ${error.message}`);

      if (error.reason && error.reason.servers) {
        logger.error('🔍 ===== MONGO SERVER SELECTION DEBUG TRACE =====');
        logger.error(`Topology Type: ${error.reason.type || 'Unknown'}`);

        const serverEntries = error.reason.servers instanceof Map
          ? Array.from(error.reason.servers.entries())
          : Object.entries(error.reason.servers);

        for (const [address, server] of serverEntries) {
          const errorDetail = server?.error
            ? `${server.error.name || 'Error'}: ${server.error.message || server.error}`
            : 'No specific error reported';
          logger.error(`📍 Node: ${address} | Status: ${server?.type || 'Unknown'} | Cause: ${errorDetail}`);
        }
        logger.error('=================================================');
      }

      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw error;
    }
  })();

  try {
    return await connectionPromise;
  } finally {
    connectionPromise = null;
  }
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  try {
    await mongoose.disconnect();
    logger.info('🔌 MongoDB Disconnected');
  } catch (error) {
    logger.error(`❌ MongoDB Disconnection Error: ${error.message}`);
    throw error;
  }
};

module.exports = {
  connectDB,
  disconnectDB,
  mongoose
};
