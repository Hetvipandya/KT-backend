const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Company = require('../models/Company');
const ChartOfAccount = require('../models/ChartOfAccount');
const customerService = require('../services/customer.service');

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
  await ChartOfAccount.deleteMany({});
  await Company.deleteMany({});
});

describe('customer linked COA fallback', () => {
  it('creates a Sundry Debtors ledger even when the company COA has not been seeded', async () => {
    const company = await Company.create({
      name: 'Acme Labs',
      gstin: '27ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      createdBy: new mongoose.Types.ObjectId(),
    });

    const coaAccountId = await customerService.createLinkedCoaAccount(company._id.toString(), 'Mohit Panchal');

    expect(coaAccountId).toBeTruthy();

    const created = await ChartOfAccount.findById(coaAccountId).lean();
    expect(created).toBeTruthy();
    expect(created.name).toBe('Mohit Panchal');
    expect(created.type).toBe('Asset');
    expect(created.companyId.toString()).toBe(company._id.toString());

    const parent = await ChartOfAccount.findOne({ companyId: company._id, code: '1230' }).lean();
    expect(parent).toBeTruthy();
    expect(parent.name).toBe('Sundry Debtors');
  });
});
