jest.mock('../models/Expense', () => ({}));
jest.mock('../models/Income', () => ({
  create: jest.fn(),
  deleteOne: jest.fn(),
}));
jest.mock('../models/Transaction', () => ({
  create: jest.fn(),
}));
jest.mock('../models/FinancialYear', () => ({
  findOne: jest.fn(),
}));
jest.mock('../models/BankAccount', () => ({
  findOne: jest.fn(),
}));
jest.mock('../services/journalEntry.service', () => ({
  createJournalEntry: jest.fn(),
  reverseJournalEntry: jest.fn(),
}));
jest.mock('../services/autoCoaMapping.service', () => ({
  ensureIncomeLedger: jest.fn(),
}));

const Income = require('../models/Income');
const Transaction = require('../models/Transaction');
const FinancialYear = require('../models/FinancialYear');
const BankAccount = require('../models/BankAccount');
const journalService = require('../services/journalEntry.service');
const { ensureIncomeLedger } = require('../services/autoCoaMapping.service');
const expenseController = require('../controllers/expenseController');

const COMPANY_ID = '6ac8a921e6b91ab589aa3001';
const BRANCH_ID = '6ac8a921e6b91ab589aa3002';
const USER_ID = '6ac8a921e6b91ab589aa3003';
const YEAR_ID = '6ac8a921e6b91ab589aa3004';
const ACCOUNT_ID = '6ac8a921e6b91ab589aa3005';
const CASH_COA_ID = '6ac8a921e6b91ab589aa3006';
const INCOME_COA_ID = '6ac8a921e6b91ab589aa3007';
const INCOME_ID = '6ac8a921e6b91ab589aa3008';

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe('Legacy income journal posting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FinancialYear.findOne.mockResolvedValue({
      _id: YEAR_ID,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      isLocked: false,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
    });
    BankAccount.findOne.mockResolvedValue({
      _id: ACCOUNT_ID,
      coaAccountId: CASH_COA_ID,
      accountType: 'Cash',
    });
    ensureIncomeLedger.mockResolvedValue({ _id: INCOME_COA_ID, name: 'Service Income', code: '4100' });
    journalService.createJournalEntry.mockResolvedValue({ _id: 'journal-id' });
    Income.create.mockImplementation(async (data) => ({
      ...data,
      _id: INCOME_ID,
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return { ...this, save: undefined, toObject: undefined };
      },
    }));
    Transaction.create.mockResolvedValue({});
  });

  test('posts an automatic balanced journal for income and links it to the record', async () => {
    const req = {
      company: { _id: COMPANY_ID },
      branchId: BRANCH_ID,
      user: { _id: USER_ID },
      body: {
        incomeType: 'service',
        title: 'Consulting',
        amount: 1250,
        receivedDate: '2026-04-10',
        paymentMode: 'cash',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await expenseController.createIncome(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(journalService.createJournalEntry).toHaveBeenCalledWith(expect.objectContaining({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      financialYearId: YEAR_ID,
      entryDate: new Date('2026-04-10'),
      lines: [
        expect.objectContaining({ accountId: CASH_COA_ID, debit: 1250, credit: 0 }),
        expect.objectContaining({ accountId: INCOME_COA_ID, debit: 0, credit: 1250 }),
      ],
    }), USER_ID);
    expect(Income.create).toHaveBeenCalledWith(expect.objectContaining({
      financialYearId: YEAR_ID,
      bankAccountId: ACCOUNT_ID,
      coaAccountId: INCOME_COA_ID,
    }));
    expect(Transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      transactionType: 'income',
      referenceId: INCOME_ID,
      amount: 1250,
    }));
  });

  test('does not save income when no compatible cash or bank account exists', async () => {
    BankAccount.findOne.mockResolvedValue(null);
    const req = {
      company: { _id: COMPANY_ID },
      branchId: BRANCH_ID,
      user: { _id: USER_ID },
      body: {
        incomeType: 'service',
        title: 'Consulting',
        amount: 1250,
        receivedDate: '2026-04-10',
        paymentMode: 'cash',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await expenseController.createIncome(req, res, next);

    expect(Income.create).not.toHaveBeenCalled();
    expect(journalService.createJournalEntry).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'PAYMENT_ACCOUNT_REQUIRED' }));
  });
});
