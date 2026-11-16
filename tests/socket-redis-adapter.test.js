jest.mock('redis', () => ({
  createClient: jest.fn(),
}));
jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn(() => 'redis-adapter'),
}));

const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const {
  initializeSocketAdapter,
  closeSocketAdapter,
} = require('../services/socket.service');

let pubClient;
let subClient;

beforeEach(() => {
  subClient = {
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    isOpen: true,
  };
  pubClient = {
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    duplicate: jest.fn(() => subClient),
    quit: jest.fn().mockResolvedValue(undefined),
    isOpen: true,
  };
  createClient.mockReturnValue(pubClient);
});

afterEach(async () => {
  await closeSocketAdapter();
  jest.clearAllMocks();
});

test('requires Redis when multi-instance Socket.IO is configured', async () => {
  await expect(initializeSocketAdapter({}, {
    redisUrl: '',
    required: true,
  })).rejects.toThrow('REDIS_URL is required');
});

test('attaches Redis pub/sub adapter and closes both clients', async () => {
  const io = { adapter: jest.fn() };

  await expect(initializeSocketAdapter(io, {
    redisUrl: 'redis://localhost:6379',
    required: true,
  })).resolves.toBe(true);

  expect(createClient).toHaveBeenCalledWith({ url: 'redis://localhost:6379' });
  expect(pubClient.connect).toHaveBeenCalledTimes(1);
  expect(subClient.connect).toHaveBeenCalledTimes(1);
  expect(createAdapter).toHaveBeenCalledWith(pubClient, subClient);
  expect(io.adapter).toHaveBeenCalledWith('redis-adapter');

  await closeSocketAdapter();

  expect(pubClient.quit).toHaveBeenCalledTimes(1);
  expect(subClient.quit).toHaveBeenCalledTimes(1);
});
