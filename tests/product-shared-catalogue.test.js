const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('../utils/sendNotification', () => ({
  notify: jest.fn()
}));

const Product = require('../models/Product');
const { createProduct, listProducts } = require('../controllers/product.controller');

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
  await Product.deleteMany({});
});

describe('shared product and service catalogue', () => {
  const companyId = new mongoose.Types.ObjectId();
  const firstBranchId = new mongoose.Types.ObjectId();
  const secondBranchId = new mongoose.Types.ObjectId();

  test('creates catalogue entries without a branch association', async () => {
    const userId = new mongoose.Types.ObjectId();
    const req = {
      body: {
        companyId: companyId.toString(),
        branchId: firstBranchId.toString(),
        name: 'Shared service',
        type: 'SERVICE'
      },
      user: { _id: userId }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await createProduct(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    const product = await Product.findOne({ companyId, name: 'Shared service' });
    expect(product.branchId).toBeNull();
  });

  test('lists catalogue entries from every branch in a branch-scoped request context', async () => {
    await Product.create([
      { companyId, branchId: firstBranchId, name: 'Branch one item' },
      { companyId, branchId: secondBranchId, name: 'Branch two item' },
      { companyId, name: 'Shared item' }
    ]);

    const req = {
      query: { companyId: companyId.toString() },
      branchId: firstBranchId.toString()
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await listProducts(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.items).toHaveLength(3);
  });
});
