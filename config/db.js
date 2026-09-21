const mongoose = require('mongoose');
const pino = require('pino');

const isDev = (process.env.NODE_ENV || 'development') === 'development';
const logger = pino({
  transport: isDev ? { target: 'pino-pretty' } : undefined
});

let isConnected = false;

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
    const conn = await mongoose.connect(uri);

    // Remove indexes left by the old User schema before creating the current ones.
    const User = require('../models/User');
    const userIndexes = await User.collection.indexes();
    for (const obsoleteIndex of ['phoneNumber_1', 'phone_1']) {
      if (userIndexes.some((index) => index.name === obsoleteIndex)) {
        await User.collection.dropIndex(obsoleteIndex);
        logger.info(`Removed obsolete User index: ${obsoleteIndex}`);
      }
    }
    await User.createIndexes();

    isConnected = true;
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    logger.error(`❌ MongoDB Connection Error: ${error.message}`);
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
