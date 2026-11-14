jest.mock('../models/Expense', () => ({
  create: jest.fn(),
  deleteOne: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock('../models/FinancialYear', () => ({ findOne: jest.fn() }));
jest.mock('../models/Branch', () => ({ findOne: jest.fn() }));
jest.mock('../models/ChartOfAccount', () => ({ findOne: jest.fn() }));
jest.mock('../models/BankAccount', () => ({ findOne: jest.fn() }));
jest.mock('../services/bankAccount.service', () => ({ getAccountBalance: jest.fn() }));
jest.mock('../services/journalEntry.service', () => ({
  createJournalEntry: jest.fn(),
  reverseJournalEntry: jest.fn(),
}));
jest.mock('../services/autoCoaMapping.service', () => ({ ensureExpenseLedger: jest.fn() }));

const Expense = require('../models/Expense');
const FinancialYear = require('../models/FinancialYear');
const Branch = require('../models/Branch');
const ChartOfAccount = require('../models/ChartOfAccount');
const BankAccount = require('../models/BankAccount');
const bankAccountService = require('../services/bankAccount.service');
const journalService = require('../services/journalEntry.service');
const expenseService = require('../services/expense.service');

const COMPANY_ID = '6ac8a921e6b91ab589aa3001';
const BRANCH_ID = '6ac8a921e6b91ab589aa3002';
const YEAR_ID = '6ac8a921e6b91ab589aa3003';
const EXPENSE_ID = '6ac8a921e6b91ab589aa3004';
const REPLACEMENT_ID = '6ac8a921e6b91ab589aa3005';
const BANK_ACCOUNT_ID = '6ac8a921e6b91ab589aa3006';
const BANK_COA_ID = '6ac8a921e6b91ab589aa3007';
const EXPENSE_COA_ID = '6ac8a921e6b91ab589aa3008';
const JOURNAL_ID = '6ac8a921e6b91ab589aa3009';
const REVERSAL_ID = '6ac8a921e6b91ab589aa3010';
const USER_ID = '6ac8a921e6b91ab589aa3011';

const makeExistingExpense = (overrides = {}) => ({
  _id: EXPENSE_ID,
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  financialYearId: YEAR_ID,
  bankAccountId: BANK_ACCOUNT_ID,
  expenseAccountId: EXPENSE_COA_ID,
  amount: 180,
  taxAmount: 20,
  totalAmount: 200,
  journalEntryId: JOURNAL_ID,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const expenseData = (overrides = {}) => ({
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  financialYearId: YEAR_ID,
  expenseDate: '2026-04-10',
  category: 'Travel',
  description: 'Taxi',
  amount: 225,
  taxRateId: null,
  taxAmount: 25,
  totalAmount: 250,
  paymentMode: 'BANK',
  bankAccountId: BANK_ACCOUNT_ID,
  expenseAccountId: EXPENSE_COA_ID,
  vendorId: null,
  reference: '',
  notes: '',
  ...overrides,
});

describe('Finance expense edit and delete accounting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Branch.findOne.mockResolvedValue({ _id: BRANCH_ID });
    FinancialYear.findOne.mockResolvedValue({
      _id: YEAR_ID,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      isLocked: false,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
    });
    ChartOfAccount.findOne.mockResolvedValue({ _id: EXPENSE_COA_ID, name: 'Travel' });
    BankAccount.findOne.mockResolvedValue({
      _id: BANK_ACCOUNT_ID,
      coaAccountId: BANK_COA_ID,
      accountName: 'Operating Bank',
    });
    bankAccountService.getAccountBalance.mockResolvedValue(100);
    journalService.createJournalEntry.mockResolvedValue({ _id: REPLACEMENT_ID });
    journalService.reverseJournalEntry.mockResolvedValue({ reversal: { _id: REVERSAL_ID } });
    Expense.create.mockImplementation(async (data) => ({
      ...data,
      _id: REPLACEMENT_ID,
      save: jest.fn().mockResolvedValue(undefined),
    }));
    Expense.findById.mockReturnValue({
      populate() { return this; },
      lean: jest.fn().mockResolvedValue({
        _id: REPLACEMENT_ID,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        financialYearId: YEAR_ID,
        bankAccountId: { _id: BANK_ACCOUNT_ID, accountName: 'Operating Bank' },
        expenseAccountId: { _id: EXPENSE_COA_ID, name: 'Travel', code: '5100' },
        vendorId: null,
        amount: 225,
        taxAmount: 25,
        totalAmount: 250,
        journalEntryId: REPLACEMENT_ID,
      }),
    });
  });

  test('updates an expense by posting a replacement and reversing the previous journal', async () => {
    const existing = makeExistingExpense();
    Expense.findOne.mockResolvedValue(existing);

    await expenseService.update(EXPENSE_ID, expenseData(), USER_ID);

    expect(bankAccountService.getAccountBalance).toHaveBeenCalledWith(BANK_COA_ID);
    expect(journalService.createJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        financialYearId: YEAR_ID,
        lines: expect.arrayContaining([
          expect.objectContaining({ accountId: EXPENSE_COA_ID, debit: 225, credit: 0 }),
          expect.objectContaining({ accountId: BANK_COA_ID, debit: 0, credit: 250 }),
        ]),
      }),
      USER_ID,
    );
    expect(journalService.reverseJournalEntry).toHaveBeenCalledWith(JOURNAL_ID, USER_ID);
    expect(existing.isVoided).toBe(true);
    expect(existing.reversalJournalEntryId).toBe(REVERSAL_ID);
    expect(existing.save).toHaveBeenCalled();
  });

  test('deletes by reversing the journal and soft-voiding the expense record', async () => {
    const existing = makeExistingExpense();
    Expense.findOne.mockResolvedValue(existing);

    const result = await expenseService.remove(EXPENSE_ID, COMPANY_ID, BRANCH_ID, USER_ID);

    expect(Expense.findOne).toHaveBeenCalledWith({
      _id: EXPENSE_ID,
      companyId: COMPANY_ID,
      isVoided: { $ne: true },
      branchId: BRANCH_ID,
    });
    expect(journalService.reverseJournalEntry).toHaveBeenCalledWith(JOURNAL_ID, USER_ID);
    expect(existing.isVoided).toBe(true);
    expect(existing.reversalJournalEntryId).toBe(REVERSAL_ID);
    expect(Expense.deleteOne).not.toHaveBeenCalled();
    expect(result).toEqual({ id: EXPENSE_ID, reversalJournalEntryId: REVERSAL_ID });
  });

  test('does not void an expense when its journal reversal is rejected', async () => {
    const existing = makeExistingExpense();
    Expense.findOne.mockResolvedValue(existing);
    journalService.reverseJournalEntry.mockRejectedValue(
      Object.assign(new Error('Financial year is locked'), { statusCode: 400 }),
    );

    await expect(expenseService.remove(EXPENSE_ID, COMPANY_ID, BRANCH_ID, USER_ID))
      .rejects.toThrow('Financial year is locked');

    expect(existing.isVoided).toBeUndefined();
    expect(existing.save).not.toHaveBeenCalled();
  });

  test('restores the expense posting if saving its voided state fails after reversal', async () => {
    const existing = makeExistingExpense({
      save: jest.fn()
        .mockRejectedValueOnce(new Error('Expense save failed'))
        .mockResolvedValueOnce(undefined),
    });
    Expense.findOne.mockResolvedValue(existing);

    await expect(expenseService.remove(EXPENSE_ID, COMPANY_ID, BRANCH_ID, USER_ID))
      .rejects.toThrow('Expense save failed');

    expect(journalService.createJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY_ID,
        lines: expect.arrayContaining([
          expect.objectContaining({ accountId: EXPENSE_COA_ID, debit: 180, credit: 0 }),
          expect.objectContaining({ accountId: BANK_COA_ID, debit: 0, credit: 200 }),
        ]),
      }),
      USER_ID,
    );
    expect(existing.isVoided).toBe(false);
    expect(existing.journalEntryId).toBe(REPLACEMENT_ID);
    expect(existing.save).toHaveBeenCalledTimes(2);
  });
});
