const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Company = require('../models/Company');
const User = require('../models/User');
const { createCompany } = require('../controllers/company.controller');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    Company.deleteMany({}),
    User.deleteMany({})
  ]);
});

describe('company creation idempotency', () => {
  it('returns the existing company for the same user instead of rejecting a retry', async () => {
    const user = await User.create({
      name: 'Test User',
      email: 'testuser@example.com',
      password: 'Password123!',
      role: 'admin'
    });

    const existingCompany = await Company.create({
      name: 'Kevalon Labs',
      gstin: '27ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      createdBy: user._id
    });

    const req = {
      user: { _id: user._id, role: 'admin' },
      body: {
        name: 'Kevalon Labs',
        gstin: '27ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        address: 'Ahmedabad',
        city: 'Ahmedabad',
        state: 'Gujarat',
        country: 'India',
        email: 'testuser@example.com',
        phone: '9876543210'
      }
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await createCompany(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          _id: existingCompany._id,
          createdBy: user._id
        })
      })
    );
  });
});
