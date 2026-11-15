jest.mock('../models/Income', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/Expense', () => ({}));
jest.mock('../models/Transaction', () => ({}));
jest.mock('../models/FinancialYear', () => ({}));
jest.mock('../models/BankAccount', () => ({}));
jest.mock('../services/journalEntry.service', () => ({
  reverseJournalEntry: jest.fn(),
}));
jest.mock('../services/autoCoaMapping.service', () => ({}));

const Income = require('../models/Income');
const journalEntryService = require('../services/journalEntry.service');
const { deleteIncome, getAllIncome } = require('../controllers/expenseController');

const createQuery = (records) => {
  const query = {
    populate: jest.fn(() => query),
    sort: jest.fn().mockResolvedValue(records),
  };
  return query;
};

describe('Income branch access', () => {
  beforeEach(() => jest.clearAllMocks());

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

    expect(Income.find).toHaveBeenCalledWith({
      companyId: 'company-id',
      branchId: 'branch-id',
      isVoided: { $ne: true },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('reverses and voids an income entry instead of deleting its accounting history', async () => {
    const income = {
      journalEntryId: 'journal-id',
      save: jest.fn().mockResolvedValue(true),
    };
    Income.findOne.mockResolvedValue(income);
    journalEntryService.reverseJournalEntry.mockResolvedValue({
      reversal: { _id: 'reversal-id' },
    });
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await deleteIncome({
      params: { id: 'income-id' },
      company: { _id: 'company-id' },
      user: { _id: 'user-id' },
    }, res, next);

    expect(journalEntryService.reverseJournalEntry).toHaveBeenCalledWith('journal-id', 'user-id');
    expect(income.isVoided).toBe(true);
    expect(income.reversalJournalEntryId).toBe('reversal-id');
    expect(income.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});
