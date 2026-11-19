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

let isConnected = false;
const maxPoolSize = Number.parseInt(process.env.MONGO_MAX_POOL_SIZE, 10);
const minPoolSize = Number.parseInt(process.env.MONGO_MIN_POOL_SIZE, 10);

const connectDB = async (customUri = null) => {
  if (isConnected) {
    return;
  }

  const uri = customUri || process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    logger.error('❌ MONGODB_URI or MONGO_URI is missing!');
    throw new Error('Database URI missing');
  }

  try {
    const conn = await mongoose.connect(uri, {
      maxPoolSize: Number.isInteger(maxPoolSize) && maxPoolSize > 0
        ? maxPoolSize
        : 50,
      minPoolSize: Number.isInteger(minPoolSize) && minPoolSize >= 0
        ? minPoolSize
        : 0,
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

    isConnected = true;
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
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
};

const disconnectDB = async () => {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
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
