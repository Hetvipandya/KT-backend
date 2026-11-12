const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ChartOfAccount = require('../models/ChartOfAccount');
const { ensureExpenseLedger, ensureIncomeLedger } = require('../services/autoCoaMapping.service');

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
});

describe('automatic COA mapping', () => {
  it('creates one reusable expense ledger for a category', async () => {
    const companyId = new mongoose.Types.ObjectId();
    const first = await ensureExpenseLedger(companyId, '  Office   Supplies ');
    const second = await ensureExpenseLedger(companyId, 'office supplies');

    expect(second._id.toString()).toBe(first._id.toString());
    expect(first.name).toBe('Office Supplies');
    expect(first.type).toBe('Expense');
    expect(first.isGroup).toBe(false);
    expect(first.branchId).toBeNull();
    expect(await ChartOfAccount.countDocuments({ companyId, autoMapKey: 'expense:office supplies' })).toBe(1);
  });

  it('maps an existing matching COA ledger instead of creating a duplicate', async () => {
    const companyId = new mongoose.Types.ObjectId();
    const parent = await ChartOfAccount.create({
      companyId,
      name: 'Indirect Expenses',
      type: 'Expense',
      isGroup: true,
      code: '5200',
    });
    const existing = await ChartOfAccount.create({
      companyId,
      name: 'Rent',
      type: 'Expense',
      isGroup: false,
      parentId: parent._id,
      code: '5210',
    });

    const mapped = await ensureExpenseLedger(companyId, 'Rent');

    expect(mapped._id.toString()).toBe(existing._id.toString());
    expect(mapped.autoMapKey).toBe('expense:rent');
    expect(await ChartOfAccount.countDocuments({ companyId, type: 'Expense', name: 'Rent' })).toBe(1);
  });

  it('reuses a matching income ledger under an Income group', async () => {
    const companyId = new mongoose.Types.ObjectId();
    const productAccount = await ensureIncomeLedger(companyId, 'Consulting', 'income:product:service-id');
    const legacyAccount = await ensureIncomeLedger(companyId, 'Consulting', 'income:legacy:service:consulting');

    expect(productAccount.type).toBe('Income');
    expect(legacyAccount._id.toString()).toBe(productAccount._id.toString());
    const parent = await ChartOfAccount.findById(productAccount.parentId);
    expect(parent.isGroup).toBe(true);
    expect(parent.type).toBe('Income');
  });
});
