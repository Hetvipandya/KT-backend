jest.mock('../models/Loan', () => ({
  create: jest.fn(),
  deleteOne: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
}));
jest.mock('../models/Branch', () => ({ findOne: jest.fn() }));
jest.mock('../models/FinancialYear', () => ({ findById: jest.fn() }));
jest.mock('../models/BankAccount', () => ({ findOne: jest.fn() }));
jest.mock('../models/ChartOfAccount', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock('../services/coa.service', () => ({ generateNextCode: jest.fn() }));
jest.mock('../services/bankAccount.service', () => ({ getAccountBalance: jest.fn() }));
jest.mock('../services/journalEntry.service', () => ({
  createJournalEntry: jest.fn(),
  reverseJournalEntry: jest.fn(),
}));
jest.mock('../services/autoCoaMapping.service', () => ({ ensureExpenseLedger: jest.fn() }));

const Loan = require('../models/Loan');
const Branch = require('../models/Branch');
const FinancialYear = require('../models/FinancialYear');
const BankAccount = require('../models/BankAccount');
const ChartOfAccount = require('../models/ChartOfAccount');
const coaService = require('../services/coa.service');
const bankAccountService = require('../services/bankAccount.service');
const journalService = require('../services/journalEntry.service');
const { ensureExpenseLedger } = require('../services/autoCoaMapping.service');
const { createLoan, createRepayment } = require('../services/loan.service');

const COMPANY_ID = '6ac8a921e6b91ab589aa3001';
const BRANCH_ID = '6ac8a921e6b91ab589aa3002';
const YEAR_ID = '6ac8a921e6b91ab589aa3003';
const BANK_ACCOUNT_ID = '6ac8a921e6b91ab589aa3004';
const BANK_COA_ID = '6ac8a921e6b91ab589aa3005';
const LOAN_ID = '6ac8a921e6b91ab589aa3006';
const LIABILITY_COA_ID = '6ac8a921e6b91ab589aa3007';
const INTEREST_COA_ID = '6ac8a921e6b91ab589aa3008';
const JOURNAL_ID = '6ac8a921e6b91ab589aa3009';
const USER_ID = '6ac8a921e6b91ab589aa3010';

const bankAccount = {
  _id: BANK_ACCOUNT_ID,
  accountName: 'Operating Bank',
  accountType: 'Current',
  coaAccountId: BANK_COA_ID,
};

const makeLoan = (overrides = {}) => ({
  _id: LOAN_ID,
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  financialYearId: YEAR_ID,
  lenderType: 'BANK',
  lenderName: 'Example Bank',
  lenderBankName: 'Example Bank',
  principalAmount: 1000,
  principalOutstanding: 1000,
  annualInterestRatePercent: 8,
  startDate: new Date('2026-04-02'),
  disbursementBankAccountId: BANK_ACCOUNT_ID,
  disbursementAccountName: bankAccount.accountName,
  liabilityAccountId: LIABILITY_COA_ID,
  initialJournalEntryId: JOURNAL_ID,
  totalPrincipalRepaid: 0,
  totalInterestPaid: 0,
  status: 'ACTIVE',
  repayments: [],
  save: jest.fn().mockResolvedValue(undefined),
  toObject() {
    return { ...this };
  },
  ...overrides,
});

const repaymentData = (overrides = {}) => ({
  companyId: COMPANY_ID,
  financialYearId: YEAR_ID,
  paymentDate: '2026-04-10',
  principalAmount: 200,
  interestAmount: 40,
  bankAccountId: BANK_ACCOUNT_ID,
  reference: 'PAY-001',
  notes: '',
  ...overrides,
});

describe('Loan accounting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Branch.findOne.mockResolvedValue({ _id: BRANCH_ID });
    FinancialYear.findById.mockResolvedValue({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      isLocked: false,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
    });
    BankAccount.findOne.mockResolvedValue(bankAccount);
    ChartOfAccount.findOne.mockImplementation(async (filter) => (
      filter.autoMapKey ? null : { _id: '6ac8a921e6b91ab589aa3011' }
    ));
    ChartOfAccount.create.mockResolvedValue({ _id: LIABILITY_COA_ID });
    coaService.generateNextCode.mockResolvedValue('2211');
    bankAccountService.getAccountBalance.mockResolvedValue(1000);
    ensureExpenseLedger.mockResolvedValue({ _id: INTEREST_COA_ID });
    journalService.createJournalEntry.mockResolvedValue({ _id: JOURNAL_ID });
    journalService.reverseJournalEntry.mockResolvedValue({});
  });

  test('records loan disbursement with balanced bank and liability lines', async () => {
    const loan = makeLoan();
    Loan.create.mockResolvedValue(loan);

    await createLoan({
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      financialYearId: YEAR_ID,
      lenderType: 'BANK',
      lenderName: 'Example Bank',
      lenderBankName: 'Example Bank',
      principalAmount: 1000,
      annualInterestRatePercent: 8,
      startDate: '2026-04-02',
      disbursementBankAccountId: BANK_ACCOUNT_ID,
    }, USER_ID);

    const journal = journalService.createJournalEntry.mock.calls[0][0];
    expect(journal.lines).toEqual([
      expect.objectContaining({ accountId: BANK_COA_ID, debit: 1000, credit: 0 }),
      expect.objectContaining({ accountId: LIABILITY_COA_ID, debit: 0, credit: 1000 }),
    ]);
    expect(journal.lines.reduce((sum, line) => sum + line.debit, 0))
      .toBe(journal.lines.reduce((sum, line) => sum + line.credit, 0));
    expect(loan.liabilityAccountId).toBe(LIABILITY_COA_ID);
    expect(loan.initialJournalEntryId).toBe(JOURNAL_ID);
  });

  test('posts principal and interest to separate accounts and updates the outstanding balance', async () => {
    const loan = makeLoan();
    Loan.findOne.mockResolvedValue(loan);
    Loan.findOneAndUpdate.mockResolvedValue(makeLoan({
      principalOutstanding: 800,
      totalPrincipalRepaid: 200,
      totalInterestPaid: 40,
      repayments: [{ _id: 'repayment-id' }],
    }));

    await createRepayment(LOAN_ID, repaymentData(), USER_ID);

    const journal = journalService.createJournalEntry.mock.calls[0][0];
    expect(journal.lines).toEqual([
      expect.objectContaining({ accountId: LIABILITY_COA_ID, debit: 200, credit: 0 }),
      expect.objectContaining({ accountId: INTEREST_COA_ID, debit: 40, credit: 0 }),
      expect.objectContaining({ accountId: BANK_COA_ID, debit: 0, credit: 240 }),
    ]);
    expect(journal.lines.reduce((sum, line) => sum + line.debit, 0))
      .toBe(journal.lines.reduce((sum, line) => sum + line.credit, 0));
    expect(Loan.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ principalOutstanding: 1000 }),
      expect.objectContaining({
        $inc: {
          principalOutstanding: -200,
          totalPrincipalRepaid: 200,
          totalInterestPaid: 40,
        },
      }),
      expect.any(Object)
    );
  });

  test.each([
    ['insufficient funds', repaymentData(), 100, 'INSUFFICIENT_FUNDS'],
    ['principal overpayment', repaymentData({ principalAmount: 1001, interestAmount: 0 }), 2000, 'PRINCIPAL_REPAYMENT_EXCEEDS_BALANCE'],
  ])('rejects %s without posting a journal', async (_label, data, balance, errorCode) => {
    Loan.findOne.mockResolvedValue(makeLoan());
    bankAccountService.getAccountBalance.mockResolvedValue(balance);

    await expect(createRepayment(LOAN_ID, data, USER_ID))
      .rejects.toMatchObject({ errorCode });
    expect(journalService.createJournalEntry).not.toHaveBeenCalled();
  });

  test('reverses the journal when a concurrent repayment changes the balance', async () => {
    Loan.findOne.mockResolvedValue(makeLoan());
    Loan.findOneAndUpdate.mockResolvedValue(null);

    await expect(createRepayment(LOAN_ID, repaymentData(), USER_ID))
      .rejects.toMatchObject({ errorCode: 'LOAN_BALANCE_CHANGED' });
    expect(journalService.reverseJournalEntry).toHaveBeenCalledWith(JOURNAL_ID, USER_ID);
  });
});
