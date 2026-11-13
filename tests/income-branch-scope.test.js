jest.mock('../models/Income', () => ({ find: jest.fn() }));
jest.mock('../models/Expense', () => ({}));
jest.mock('../models/Transaction', () => ({}));
jest.mock('../models/FinancialYear', () => ({}));
jest.mock('../models/BankAccount', () => ({}));
jest.mock('../services/journalEntry.service', () => ({}));
jest.mock('../services/autoCoaMapping.service', () => ({}));

const Income = require('../models/Income');
const { getAllIncome } = require('../controllers/expenseController');

const createQuery = (records) => {
  const query = {
    populate: jest.fn(() => query),
    sort: jest.fn().mockResolvedValue(records),
  };
  return query;
};

describe('Income branch access', () => {
  test('limits income results to the branch enforced by access middleware', async () => {
    Income.find.mockReturnValue(createQuery([]));
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await getAllIncome({
      company: { _id: 'company-id' },
      branchId: 'branch-id',
    }, res, jest.fn());

    expect(Income.find).toHaveBeenCalledWith({ companyId: 'company-id', branchId: 'branch-id' });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
