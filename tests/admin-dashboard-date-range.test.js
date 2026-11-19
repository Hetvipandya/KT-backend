const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Purchase = require('../models/Purchase');
const Expense = require('../models/Expense');
const Salary = require('../models/Salary');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Employee = require('../models/Employee');
const Product = require('../models/Product');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const BankAccount = require('../models/BankAccount');
const { getAdminDashboard } = require('../controllers/adminDashboard.controller');

const createQuery = () => {
  const query = {
    sort: () => query,
    limit: () => query,
    populate: () => query,
    lean: jest.fn().mockResolvedValue([]),
  };
  return query;
};

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

describe('Finance dashboard date range', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('applies the selected date range to finance aggregates and recent records', async () => {
    const companyId = new mongoose.Types.ObjectId();
    [Invoice, Purchase, Expense, Salary].forEach((model) => {
      jest.spyOn(model, 'aggregate').mockResolvedValue([]);
    });
    [Customer, Supplier, Employee, Product, User].forEach((model) => {
      jest.spyOn(model, 'countDocuments').mockResolvedValue(0);
    });
    [Invoice, Purchase, Expense, Salary, AuditLog, BankAccount].forEach((model) => {
      jest.spyOn(model, 'find').mockReturnValue(createQuery());
    });

    const res = createResponse();
    await getAdminDashboard({
      company: { _id: companyId, name: 'Test Company' },
      query: { startDate: '2026-03-01', endDate: '2026-03-31' },
    }, res, jest.fn());

    const expectedStart = new Date('2026-03-01T00:00:00.000Z');
    const expectedEnd = new Date('2026-03-31T23:59:59.999Z');
    const hasRange = (match, field) => (
      match[field]?.$gte?.getTime() === expectedStart.getTime() &&
      match[field]?.$lte?.getTime() === expectedEnd.getTime()
    );
    expect(Invoice.aggregate.mock.calls.some(([pipeline]) => hasRange(pipeline[0].$match, 'invoiceDate'))).toBe(true);
    expect(Purchase.aggregate.mock.calls.some(([pipeline]) => hasRange(pipeline[0].$match, 'billDate'))).toBe(true);
    expect(Expense.aggregate.mock.calls.some(([pipeline]) => hasRange(pipeline[0].$match, 'expenseDate'))).toBe(true);
    expect(Salary.aggregate.mock.calls.some(([pipeline]) => hasRange(pipeline[0].$match, 'periodStart'))).toBe(true);
    [Invoice, Purchase, Expense, Salary].forEach((model) => {
      expect(model.aggregate).toHaveBeenCalledTimes(1);
    });
    expect(res.body.data).toMatchObject({
      expenseBreakdown: [],
      branchPerformance: [],
      recentActivity: { expenses: [], salaries: [] },
    });
  });

  it('rejects invalid calendar dates before querying records', async () => {
    const aggregate = jest.spyOn(Invoice, 'aggregate');
    const res = createResponse();

    await getAdminDashboard({
      company: { _id: new mongoose.Types.ObjectId(), name: 'Test Company' },
      query: { startDate: '2026-02-31', endDate: '2026-03-31' },
    }, res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe('INVALID_DATE_RANGE');
    expect(aggregate).not.toHaveBeenCalled();
  });

  it('calculates dashboard facets from one aggregation per transaction collection', async () => {
    const companyId = new mongoose.Types.ObjectId();
    const branchId = new mongoose.Types.ObjectId();
    jest.spyOn(Invoice, 'aggregate').mockResolvedValue([{
      sales: [{ totalAmount: 1000, totalReceived: 600, count: 2 }],
      receivables: [{ totalAmount: 400, count: 1 }],
      branchSales: [{ _id: branchId, totalAmount: 1000 }],
      branchReceivables: [{ _id: branchId, totalAmount: 400 }]
    }]);
    jest.spyOn(Purchase, 'aggregate').mockResolvedValue([{
      purchases: [{ totalAmount: 200, count: 1 }],
      payables: [{ totalAmount: 50, count: 1 }],
      branchPurchases: [{ _id: branchId, totalAmount: 200 }]
    }]);
    jest.spyOn(Expense, 'aggregate').mockResolvedValue([{
      expenses: [{ totalAmount: 100, count: 1 }],
      categories: [{ _id: 'Travel', totalAmount: 100 }],
      branchExpenses: [{ _id: branchId, totalAmount: 100 }]
    }]);
    jest.spyOn(Salary, 'aggregate').mockResolvedValue([{
      salaries: [{ totalAmount: 300, count: 1 }],
      branchSalaries: [{ _id: branchId, totalAmount: 300 }]
    }]);
    [Customer, Supplier, Employee, Product, User].forEach((model) => {
      jest.spyOn(model, 'countDocuments').mockResolvedValue(0);
    });
    [Invoice, Purchase, Expense, Salary, AuditLog, BankAccount].forEach((model) => {
      jest.spyOn(model, 'find').mockReturnValue(createQuery());
    });

    const res = createResponse();
    await getAdminDashboard({
      company: { _id: companyId, name: 'Test Company' },
      query: {},
    }, res, jest.fn());

    expect(Invoice.aggregate).toHaveBeenCalledTimes(1);
    expect(Purchase.aggregate).toHaveBeenCalledTimes(1);
    expect(Expense.aggregate).toHaveBeenCalledTimes(1);
    expect(Salary.aggregate).toHaveBeenCalledTimes(1);
    expect(res.body.data.statistics).toMatchObject({
      sales: { totalAmount: 1000, totalReceived: 600, count: 2 },
      purchases: { totalAmount: 200, count: 1 },
      expenses: { totalAmount: 100, count: 1 },
      salaries: { totalAmount: 300, count: 1 },
      receivables: { totalAmount: 400, count: 1 },
      payables: { totalAmount: 50, count: 1 },
      netProfit: 400
    });
    expect(res.body.data.branchPerformance).toHaveLength(1);
    expect(res.body.data.branchPerformance[0]).toMatchObject({
      branchId: branchId.toString(),
      revenue: 1000,
      purchases: 200,
      expenses: 100,
      salaries: 300,
      receivables: 400,
      netProfit: 400
    });
  });
});
