jest.mock('mongoose', () => ({
  connection: { readyState: 0 },
  connect: jest.fn(),
  disconnect: jest.fn()
}));

describe('MongoDB connection pooling', () => {
  const originalEnv = {
    MONGODB_URI: process.env.MONGODB_URI,
    NODE_ENV: process.env.NODE_ENV,
    RUN_STARTUP_MAINTENANCE: process.env.RUN_STARTUP_MAINTENANCE,
    MONGO_MAX_POOL_SIZE: process.env.MONGO_MAX_POOL_SIZE,
    MONGO_MIN_POOL_SIZE: process.env.MONGO_MIN_POOL_SIZE,
    MONGO_WAIT_QUEUE_TIMEOUT_MS: process.env.MONGO_WAIT_QUEUE_TIMEOUT_MS
  };

  beforeEach(() => {
    jest.resetModules();
    process.env.MONGODB_URI = 'mongodb://localhost/test';
    process.env.NODE_ENV = 'test';
    process.env.RUN_STARTUP_MAINTENANCE = 'false';
    process.env.MONGO_MAX_POOL_SIZE = '20';
    process.env.MONGO_MIN_POOL_SIZE = '3';
    process.env.MONGO_WAIT_QUEUE_TIMEOUT_MS = '2500';
  });

  afterAll(() => {
    Object.keys(originalEnv).forEach((key) => {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });
  });

  it('shares concurrent connection attempts and applies pool settings', async () => {
    const mongoose = require('mongoose');
    const { connectDB, disconnectDB } = require('../config/db');
    const connection = { connection: { host: 'localhost', name: 'test' } };
    let resolveConnection;
    mongoose.connect.mockImplementation(() => new Promise((resolve) => {
      resolveConnection = resolve;
    }));

    const firstConnect = connectDB();
    const secondConnect = connectDB();

    expect(mongoose.connect).toHaveBeenCalledTimes(1);
    expect(mongoose.connect).toHaveBeenCalledWith('mongodb://localhost/test', {
      maxPoolSize: 20,
      minPoolSize: 3,
      maxConnecting: 2,
      waitQueueTimeoutMS: 2500
    });

    mongoose.connection.readyState = 1;
    resolveConnection(connection);
    await expect(Promise.all([firstConnect, secondConnect])).resolves.toEqual([
      connection,
      connection
    ]);

    mongoose.disconnect.mockImplementation(async () => {
      mongoose.connection.readyState = 0;
    });
    await disconnectDB();
    mongoose.connect.mockResolvedValue(connection);

    await expect(connectDB()).resolves.toBe(connection);
    expect(mongoose.connect).toHaveBeenCalledTimes(2);
  });

  it('rejects a minimum pool size greater than the maximum', async () => {
    process.env.MONGO_MIN_POOL_SIZE = '21';
    const mongoose = require('mongoose');
    const { connectDB } = require('../config/db');

    await expect(connectDB()).rejects.toThrow(
      'MONGO_MIN_POOL_SIZE cannot be greater than MONGO_MAX_POOL_SIZE'
    );
    expect(mongoose.connect).not.toHaveBeenCalled();
  });
});
